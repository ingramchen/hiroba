import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  escapeHtml,
  type SysAuditEntry,
  type SysChatter,
  type SysForbidden,
  type SysJoinRecord,
} from '@hiroba/shared';
import { asc, count, eq, lte } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { Database } from '../db/client.js';
import { sysSession } from '../db/schema.js';
import { applyForbid, emit, refreshTiers } from './effects.js';
import { JOIN_RECORD_RETENTION_MS } from './scheduler.js';
import { SYSTEM_NICKNAME, SYSTEM_PUBLIC_ID, clientAddress } from './http.js';
import type { Services } from './types.js';
import { ClientAndGlobalLimiter, retryAfterSeconds } from './rateLimit.js';
import {
  SYS_AUDIT_DEFAULT_LIMIT,
  SysAuditLog,
  sessionLabel,
  type SysActor,
  type SysAuditWrite,
} from './sysAudit.js';
import { SYS_IMAGE_FEED_MAX, deleteStoredImage, deleteThumbObject } from './sysImages.js';
import { SysStats, boundDays } from './sysStats.js';

export { DELETE_MEDIA_PREFIX } from './sysImages.js';

export const SYS_COOKIE = 'hiroba.sys';
export const SYS_COOKIE_PATH = '/api/sys';
export const SYS_SESSION_TTL_MS = 30 * 60 * 1000;
export const SYS_SESSION_MAX = 32;
export const SYS_AUTH_WINDOW_MS = 15 * 60 * 1000;
export const SYS_AUTH_LOCK_MS = 15 * 60 * 1000;
export const SYS_AUTH_CLIENT_FAILURES = 5;
export const SYS_AUTH_GLOBAL_FAILURES = 20;

export interface SystemCommand {
  redirect: boolean;
  reconnect: boolean;
  message: string;
}

export function parseSystemCommand(raw: string): SystemCommand {
  const lowered = raw.toLowerCase();
  if (lowered === 'reconnect') {
    return { redirect: false, reconnect: true, message: '' };
  }
  if (lowered === 'redirect') {
    return { redirect: true, reconnect: false, message: '' };
  }
  return { redirect: false, reconnect: false, message: escapeHtml(raw) };
}

export class SysSessions {
  constructor(
    private readonly db: Database,
    private readonly ttlMs: number = SYS_SESSION_TTL_MS,
    private readonly max: number = SYS_SESSION_MAX,
  ) {}

  get size(): number {
    return this.db.select({ n: count() }).from(sysSession).get()?.n ?? 0;
  }

  create(now: number): string {
    return this.db.transaction(() => {
      this.purgeExpired(now);
      while (this.size >= this.max) {
        const soonest = this.db
          .select({ id: sysSession.id })
          .from(sysSession)
          .orderBy(asc(sysSession.expiresAt))
          .limit(1)
          .get();
        if (soonest === undefined) {
          break;
        }
        this.db.delete(sysSession).where(eq(sysSession.id, soonest.id)).run();
      }
      const id = randomBytes(24).toString('base64url');
      this.db
        .insert(sysSession)
        .values({ id, expiresAt: new Date(now + this.ttlMs) })
        .run();
      return id;
    });
  }

  purgeExpired(now: number): number {
    return this.db
      .delete(sysSession)
      .where(lte(sysSession.expiresAt, new Date(now)))
      .returning({ id: sysSession.id })
      .all().length;
  }

  touch(id: string | undefined, now: number): boolean {
    if (id === undefined) {
      return false;
    }
    const row = this.db.select().from(sysSession).where(eq(sysSession.id, id)).get();
    if (row === undefined) {
      return false;
    }
    if (row.expiresAt.getTime() <= now) {
      this.db.delete(sysSession).where(eq(sysSession.id, id)).run();
      return false;
    }
    this.db
      .update(sysSession)
      .set({ expiresAt: new Date(now + this.ttlMs) })
      .where(eq(sysSession.id, id))
      .run();
    return true;
  }
}

function matches(expected: string | null, given: unknown): boolean {
  if (expected === null || typeof given !== 'string') {
    return false;
  }
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(given, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readBody(c: Context): Promise<Record<string, unknown>> {
  return (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
}

function topicOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isBlank(topic: string): boolean {
  return topic.trim().length === 0;
}

export type { SysChatter as SecretChatter, SysForbidden };

export function createSysApp(
  services: Services,
  password: string | null,
  timeZone?: string,
  timeZoneConfigured?: boolean,
): Hono {
  const sessions = new SysSessions(services.db);
  const failures = new ClientAndGlobalLimiter(
    { windowMs: SYS_AUTH_WINDOW_MS, max: SYS_AUTH_CLIENT_FAILURES, lockMs: SYS_AUTH_LOCK_MS },
    { windowMs: SYS_AUTH_WINDOW_MS, max: SYS_AUTH_GLOBAL_FAILURES, lockMs: SYS_AUTH_LOCK_MS },
  );
  const sys = new Hono();
  const audit = new SysAuditLog(services.db);
  const stats =
    timeZone === undefined
      ? new SysStats(services.db, services.hub)
      : new SysStats(services.db, services.hub, timeZone, timeZoneConfigured ?? true);

  const actorOf = (c: Context): SysActor => ({
    address: clientAddress(c),
    session: sessionLabel(getCookie(c, SYS_COOKIE)),
  });

  const log = (c: Context, write: SysAuditWrite): void => {
    audit.record(actorOf(c), write, services.clock.now());
  };

  const requireSys: MiddlewareHandler = async (c, next) => {
    if (!sessions.touch(getCookie(c, SYS_COOKIE), services.clock.now())) {
      return c.json({ error: 'NOT_AUTHENTICATED' }, 401);
    }
    await next();
    return;
  };

  const broadcastTo = (topic: string, command: SystemCommand): void => {
    if (!services.hub.has(topic)) {
      return;
    }
    services.hub.get(topic).broadcast({
      t: 'event',
      event: {
        eventType: 'SYSTEM_MESSAGE',
        senderPublicId: SYSTEM_PUBLIC_ID,
        senderNickName: SYSTEM_NICKNAME,
        senderColorToken: null,
        anchorUsername: '',
        content: command.message,
        date: services.clock.now(),
        payload: { ...command },
      },
    });
  };

  sys.post('/authenticate', async (c) => {
    const now = services.clock.now();
    const client = clientAddress(c);
    const verdict = failures.peek(client, now);
    if (!verdict.allowed) {
      return c.json({ error: 'TOO_MANY_ATTEMPTS' }, 429, {
        'retry-after': retryAfterSeconds(verdict),
      });
    }
    const body = await readBody(c);
    if (!matches(password, body['password'])) {
      failures.hit(client, now);
      audit.record(
        { address: client, session: '' },
        { action: 'authenticate.refused', targetType: 'none', target: '' },
        now,
      );
      return c.json({ error: 'NOT_AUTHENTICATED' }, 401);
    }
    const session = sessions.create(now);
    setCookie(c, SYS_COOKIE, session, {
      httpOnly: true,
      sameSite: 'Lax',
      path: SYS_COOKIE_PATH,
    });
    audit.record(
      { address: client, session: sessionLabel(session) },
      { action: 'authenticate', targetType: 'none', target: '' },
      now,
    );
    return c.json({ ok: true });
  });

  sys.get('/session', requireSys, (c) => c.json({ ok: true }));

  sys.get('/squares', requireSys, (c) => {
    const topics = services.hub.topics();
    log(c, {
      action: 'squares.read',
      targetType: 'none',
      target: '',
      detail: { count: topics.length },
    });
    return c.json({ topics });
  });

  sys.get('/squares/:topic/chatters', requireSys, (c) => {
    const topic = topicOf(c.req.param('topic'));
    if (isBlank(topic) || !services.hub.has(topic)) {
      log(c, {
        action: 'chatters.read',
        targetType: 'topic',
        target: topic,
        topic,
        detail: { count: 0 },
      });
      return c.json({ topic, chatters: [] });
    }
    const crowd = services.hub.get(topic).crowdView();
    const records = services.joinRecords.findAll(
      topic,
      crowd.map((chatter) => chatter.publicId),
    );
    const states = services.chatters.loadAll(
      [...records.values()].map((record) => record.privateId).filter((id) => id.length > 0),
    );
    const chatters: SysChatter[] = crowd.map((chatter) => {
      const record = records.get(chatter.publicId) ?? null;
      const privateId = record?.privateId ?? '';
      return {
        publicId: chatter.publicId,
        privateId,
        nickname: chatter.nickname,
        colorToken: chatter.colorToken,
        ips: record?.ips ?? '',
        address: record?.address ?? '',
        kermaForbidForever: states.get(privateId)?.kermaForbidForever ?? false,
      };
    });
    log(c, {
      action: 'chatters.read',
      targetType: 'topic',
      target: topic,
      topic,
      detail: { count: chatters.length },
    });
    return c.json({ topic, chatters });
  });

  sys.post('/broadcast', requireSys, async (c) => {
    const body = await readBody(c);
    const raw = typeof body['content'] === 'string' ? body['content'] : '';
    if (raw.trim().length === 0) {
      return c.json({ error: 'EMPTY_CONTENT' }, 400);
    }
    const command = parseSystemCommand(raw);
    const topic = topicOf(body['topic']);
    const targets = isBlank(topic) ? services.hub.topics() : [topic];
    for (const target of targets) {
      broadcastTo(target, command);
    }
    const reached = targets.filter((target) => services.hub.has(target));
    log(c, {
      action: 'broadcast',
      targetType: isBlank(topic) ? 'none' : 'topic',
      target: topic,
      topic,
      detail: {
        content: raw,
        reconnect: command.reconnect,
        redirect: command.redirect,
        reached: reached.length,
      },
    });
    return c.json({ topics: reached });
  });

  sys.post('/squares/remove', requireSys, async (c) => {
    const body = await readBody(c);
    const topic = topicOf(body['topic']);
    if (isBlank(topic)) {
      return c.json({ error: 'INVALID_TOPIC' }, 400);
    }
    const permanent = body['permanent'] === true;
    if (permanent) {
      const orphan = services.squares.removePermanent(topic);
      if (orphan !== null && services.media !== null) {
        await deleteThumbObject(services.media, orphan);
      }
    }
    services.squares.removeLive(topic);
    broadcastTo(topic, { redirect: true, reconnect: false, message: '' });
    services.hub.remove(topic);
    log(c, {
      action: permanent ? 'square.delete' : 'square.remove',
      targetType: 'topic',
      target: topic,
      topic,
    });
    return c.json({ topic, permanent });
  });

  sys.post('/wipe', requireSys, async (c) => {
    const body = await readBody(c);
    if (body['confirm'] !== 'wipe') {
      return c.json({ error: 'CONFIRM_REQUIRED' }, 400);
    }
    const wipe = services.wipe;
    if (wipe === null || !wipe.available) {
      return c.json({ error: 'WIPE_UNAVAILABLE' }, 501);
    }
    const { deleted } = await wipe.run();
    return c.json({ ok: true, deleted });
  });

  sys.post('/squares/seal', requireSys, async (c) => {
    const body = await readBody(c);
    const topic = topicOf(body['topic']);
    if (isBlank(topic)) {
      return c.json({ error: 'INVALID_TOPIC' }, 400);
    }
    services.squares.seal(topic);
    log(c, { action: 'square.seal', targetType: 'topic', target: topic, topic });
    return c.json({ topic, sealed: true });
  });

  sys.post('/forbid', requireSys, async (c) => {
    const body = await readBody(c);
    const topic = topicOf(body['topic']);
    const unforbid = body['unforbid'] === true;
    const targetPublicId = String(body['targetPublicId'] ?? '');
    const actor = actorOf(c);
    const forbidden = services.db.transaction(() => {
      const applied = applyForbid(
        services,
        topic,
        targetPublicId,
        SYSTEM_NICKNAME,
        unforbid,
        services.clock.now(),
      );
      audit.record(
        actor,
        {
          action: unforbid ? 'unforbid' : 'forbid',
          targetType: 'publicId',
          target: targetPublicId,
          topic,
          detail: { affected: applied.result.length },
        },
        services.clock.now(),
      );
      return applied;
    });
    emit(services, forbidden.pending);
    const affected: SysForbidden[] = forbidden.result.map((chatter) => ({
      publicId: chatter.publicId,
      nickname: chatter.nickname,
    }));
    return c.json({ affected });
  });

  sys.post('/ban', requireSys, async (c) => {
    const body = await readBody(c);
    const privateId = typeof body['privateId'] === 'string' ? body['privateId'].trim() : '';
    if (privateId.length === 0) {
      return c.json({ error: 'INVALID_TARGET' }, 400);
    }
    const unban = body['unban'] === true;
    const actor = actorOf(c);
    const publicId = services.identities.publicId(privateId);
    const updated = services.db.transaction(() => {
      const state = services.chatters.setForbidForever(privateId, !unban);
      if (state === null) {
        return null;
      }
      audit.record(
        actor,
        {
          action: unban ? 'unban' : 'ban',
          targetType: 'privateId',
          target: privateId,
          detail: { publicId },
        },
        services.clock.now(),
      );
      return state;
    });
    if (updated === null) {
      return c.json({ error: 'NO_SUCH_CHATTER' }, 400);
    }
    for (const topic of services.hub.topics()) {
      if (!unban) {
        services.hub.get(topic).setForbidden([publicId], true);
      }
      refreshTiers(services, topic, [publicId]);
    }
    return c.json({ privateId, publicId, forbidForever: !unban });
  });

  sys.get('/join-records', requireSys, (c) => {
    const raw = Number(c.req.query('limit'));
    const limit = Number.isFinite(raw) && raw > 0 ? Math.min(Math.trunc(raw), 500) : 200;
    const criteria = {
      address: (c.req.query('address') ?? '').trim(),
      publicId: (c.req.query('publicId') ?? '').trim(),
      topic: (c.req.query('topic') ?? '').trim(),
    };
    const records: SysJoinRecord[] = services.joinRecords.search(criteria, limit).map((row) => ({
      topic: row.topic,
      publicId: row.publicId,
      privateId: row.privateId,
      nickname: row.nickname,
      ips: row.ips,
      address: row.address,
      joinTime: row.joinTime.getTime(),
      forbid: row.forbid,
    }));
    log(c, {
      action: 'join-records.read',
      targetType: criteria.publicId.length > 0 ? 'publicId' : 'none',
      target: criteria.publicId,
      topic: criteria.topic,
      detail: { ...criteria, limit, returned: records.length },
    });
    return c.json({ records, retentionMs: JOIN_RECORD_RETENTION_MS });
  });

  sys.get('/images', requireSys, (c) => {
    const raw = Number(c.req.query('limit'));
    const limit = Number.isFinite(raw) && raw > 0 ? raw : SYS_IMAGE_FEED_MAX;
    const images = services.sysImages.recent(limit);
    log(c, {
      action: 'images.read',
      targetType: 'none',
      target: '',
      detail: { limit, returned: images.length },
    });
    return c.json({ images, startedAt: services.sysImages.startedAt });
  });

  sys.post('/images/delete', requireSys, async (c) => {
    const body = await readBody(c);
    const url = topicOf(body['url']);
    const topic = topicOf(body['topic']);
    const senderPublicId = topicOf(body['senderPublicId']);
    const deleted = await deleteStoredImage(services, { url, topic, senderPublicId });
    if (!deleted.ok) {
      return c.json({ error: deleted.error }, deleted.status);
    }
    log(c, {
      action: 'image.delete',
      targetType: 'publicId',
      target: senderPublicId,
      topic,
      detail: { url, bucket: deleted.bucket, key: deleted.key },
    });
    return c.json({ url, deleted: true });
  });

  sys.get('/stats', requireSys, (c) => {
    const days = boundDays(c.req.query('days'));
    log(c, { action: 'stats.read', targetType: 'none', target: '', detail: { days } });
    return c.json(stats.read(days, services.clock.now()));
  });

  sys.get('/audit', requireSys, (c) => {
    const raw = Number(c.req.query('limit'));
    const limit = Number.isFinite(raw) && raw > 0 ? raw : SYS_AUDIT_DEFAULT_LIMIT;
    const entries: SysAuditEntry[] = audit.recent(limit);
    log(c, {
      action: 'audit.read',
      targetType: 'none',
      target: '',
      detail: { limit, returned: entries.length },
    });
    return c.json({ entries });
  });

  return sys;
}
