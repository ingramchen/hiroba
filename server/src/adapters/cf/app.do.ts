import { DurableObject } from 'cloudflare:workers';
import { gt } from 'drizzle-orm';
import type { Hono } from 'hono';
import { createApp } from '../../core/app.js';
import { requireValue } from '../../core/config.js';
import { bootServices } from '../../core/boot.js';
import { systemTimers } from '../../core/room/types.js';
import { BufferedOutbox, type FlushResult, type SquareTransport } from '../../core/room/outbox.js';
import { Scheduler } from '../../core/scheduler.js';
import { readTimeZone, timeZoneConfigured } from '../../core/timeZone.js';
import type { Services } from '../../core/types.js';
import type { Database } from '../../db/client.js';
import { squareLive } from '../../db/schema.js';
import { SiteWipe } from '../../core/wipe.js';
import { SCHEDULER_TICK_MS, armAlarm, runAlarm } from './alarm.js';
import { cfRemoteAddress } from './clientAddress.js';
import { openDurableDatabase, type DurableObjectStorageLike } from './db.js';
import { buildCfMediaServices, wipeBuckets } from './media.build.js';
import { migrationBundle } from './migrations.generated.js';
import type { Env } from './platform.js';
import { stringVars, vpcClassifierFetch } from './platform.js';
import { flushingTimers, RealtimeApp, type InboundResult, type SocketTuple } from './realtime.js';

interface Booted {
  services: Services;
  app: Hono;
  realtime: RealtimeApp;
  scheduler: Scheduler;
}

const RESTART_DELAY_MS = 1500;

export class AppDO extends DurableObject<Env> {
  private booted: Promise<Booted> | null = null;
  private restartPending = false;

  private async resetDatabase(): Promise<void> {
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.deleteAlarm();
    this.booted = null;
    this.restartPending = true;
  }

  private restartIfPending(): void {
    if (!this.restartPending) {
      return;
    }
    this.restartPending = false;
    // The abort has to wait until the answer has left the object. A zero delay was measured on
    // the real edge (2026-09-12) to fire while the sys response was still streaming back to the
    // fronting Worker, which turned a finished wipe into a 500 for the caller; the RPC return
    // value has the same window. Anything served during the wait already runs on services
    // rebooted over the empty storage (`booted` was cleared), so the delay costs nothing.
    setTimeout(() => {
      this.ctx.abort('wiped');
    }, RESTART_DELAY_MS);
  }

  private squares(): Env['SQUARE'] {
    return this.env.SQUARE;
  }

  private transport(): SquareTransport {
    const namespace = this.squares();
    return {
      deliver: async (topic, batch) => {
        await namespace.get(namespace.idFromName(topic)).deliver(batch);
      },
    };
  }

  private start(): Promise<Booted> {
    this.booted ??= this.boot();
    return this.booted;
  }

  private async boot(): Promise<Booted> {
    const vars = stringVars(this.env);
    const moderationFetcher = vpcClassifierFetch(this.env, vars);
    let live: string[] = [];
    const outbox = new BufferedOutbox(this.transport());
    const media = await buildCfMediaServices(vars);
    const store = openDurableDatabase(
      this.ctx.storage as unknown as DurableObjectStorageLike,
      migrationBundle,
    );
    const services = await bootServices({
      store,
      beforeReset: (db: Database) => {
        live = db
          .select({ topic: squareLive.topic })
          .from(squareLive)
          .where(gt(squareLive.crowd, 0))
          .all()
          .map((row) => row.topic);
      },
      tokenSecret: requireValue(vars, 'TOKEN_SECRET'),
      env: vars,
      ...(moderationFetcher === undefined ? {} : { moderationFetcher }),
      timers: flushingTimers(systemTimers, outbox),
      media,
      wipe: new SiteWipe({
        blobs: media?.blobs ?? null,
        buckets: wipeBuckets(vars, media?.config ?? null),
        resetDatabase: () => this.resetDatabase(),
      }),
    });
    const timeZone = readTimeZone(vars);
    const app = createApp(services, {
      remoteAddress: cfRemoteAddress,
      sysPassword: this.env.SYS_PASSWORD ?? null,
      timeZone,
      timeZoneConfigured: timeZoneConfigured(vars),
    });
    const booted: Booted = {
      services,
      app,
      realtime: new RealtimeApp(services, outbox),
      scheduler: new Scheduler(services, () => services.clock.now(), undefined, timeZone),
    };
    await armAlarm(this.ctx.storage, services.clock.now(), SCHEDULER_TICK_MS);
    await this.readmit(booted, live);
    return booted;
  }

  private async readmit(booted: Booted, topics: readonly string[]): Promise<void> {
    const namespace = this.squares();
    const held = await Promise.all(
      topics.map((topic) => namespace.get(namespace.idFromName(topic)).tuples()),
    );
    const tuples = held.flat();
    if (tuples.length > 0) {
      await booted.realtime.readmit(tuples);
    }
  }

  async inbound(tuple: SocketTuple, raw: string): Promise<InboundResult> {
    const { realtime } = await this.start();
    return realtime.inbound(tuple, raw);
  }

  async disconnect(tuple: SocketTuple): Promise<FlushResult> {
    const { realtime } = await this.start();
    return realtime.disconnect(tuple);
  }

  async alarm(): Promise<void> {
    const booted = await this.start();
    await runAlarm(
      this.ctx.storage,
      () => booted.realtime.turn(undefined, () => booted.scheduler.tick()),
      () => booted.services.clock.now(),
      SCHEDULER_TICK_MS,
    );
  }

  async wipe(): Promise<{ deleted: number }> {
    const { services } = await this.start();
    const result = services.wipe === null ? { deleted: 0 } : await services.wipe.run();
    this.restartIfPending();
    return result;
  }

  async fetch(request: Request): Promise<Response> {
    const { realtime, app } = await this.start();
    const { result } = await realtime.turn(undefined, () => app.fetch(request));
    this.ctx.waitUntil(realtime.deliverVerdicts());
    this.restartIfPending();
    return result;
  }
}
