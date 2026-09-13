import {
  KERMA_COST,
  MIN_KERMA_LEVELS,
  bestNickname,
  calculateColor,
  canonicalTopic,
  chatroomType,
  isKermaEnough,
  isChatFreeze,
  mediaBaseFor,
  rgbHex,
  unknownNicknameLabel,
  washGuardAllowance,
  type ChatterAuth,
  type KermaShopItem,
  type VoteView,
  type VotingGoalType,
} from '@hiroba/shared';
import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { SESSION_COOKIE } from '../account.js';
import { AnchorError } from '../anchor.js';
import { ShopError } from '../chatter.js';
import {
  applyBurn,
  applyForbid,
  applyMinKerma,
  applyPoster,
  emit,
  type PendingBroadcast,
  buildVotingInput,
  isForbiddenCaster,
  isFreeSquare,
  preparePosterFromRequest,
  wasPresentAtCreate,
} from '../effects.js';
import {
  PermissionDenied,
  SYSTEM_NICKNAME,
  accountIdOf,
  clientIps,
  refuse,
  requirePermission,
  systemEvent,
} from '../http.js';
import { accountPrivateId } from '../identity.js';
import { asPosterDto } from '../poster.js';
import { requestOrigin } from '../storage/routes.js';
import type { Services } from '../types.js';
import { VoteError, type Creator } from '../vote.js';

export function registerSquareRoutes(app: Hono, services: Services): void {
  app.post('/api/square/start', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const topic = canonicalTopic(typeof body['topic'] === 'string' ? body['topic'] : '');
    if (topic.length === 0) {
      return c.json({ error: 'INVALID_TOPIC' }, 400);
    }
    const now = services.clock.now();
    services.squares.ensure(topic, now);
    const ips = clientIps(c);
    const ipsHash = services.identities.ipsHash(topic, ips);
    const accountId = accountIdOf(services, getCookie(c, SESSION_COOKIE));
    const loggedIn = accountId === null ? null : services.accounts.byId(accountId);

    const chatter =
      loggedIn === null
        ? services.chatters.startAnonymous(
            typeof body['anonymousId'] === 'string' ? body['anonymousId'] : undefined,
            now,
          )
        : services.chatters.load(accountPrivateId(loggedIn.accountUuid));
    if (chatter === null) {
      return c.json({ error: 'NO_SUCH_CHATTER' }, 400);
    }
    const started = services.chatters.grow(chatter.privateId, now) ?? chatter;
    const publicId = services.identities.publicId(started.privateId);
    const anchorContext = services.anchors.contextFor(
      topic,
      accountId,
      loggedIn !== null && loggedIn.usernameFolded !== null,
    );
    const anchor = anchorContext.anchor;
    const anchorable = anchorContext.isAnchorable;
    const info = services.squares.info(topic);
    const minKermaValue = anchor === null ? (info?.minKermaValue ?? 0) : 0;
    const kermaEnough =
      anchor !== null ||
      isKermaEnough(started.kermaValue, minKermaValue, started.kermaForbidForever);
    const chatFreeze =
      anchor === null &&
      isChatFreeze(minKermaValue, started.kermaValue) &&
      !started.kermaForbidForever
        ? true
        : anchor === null && started.kermaForbidForever
          ? true
          : anchor === null && isChatFreeze(minKermaValue, started.kermaValue);
    const anchorUsername = anchorable && loggedIn !== null ? (loggedIn.username ?? '') : '';
    const nickname = bestNickname(typeof body['nickname'] === 'string' ? body['nickname'] : '', {
      unknownLabel: unknownNicknameLabel(body['locale']),
      ipsHash,
    });

    services.joinRecords.save({
      topic,
      publicId,
      privateId: started.privateId,
      nickname: nickname.nickname,
      ips,
      colorToken: started.colorToken,
      now,
    });

    const forbidden = started.kermaForbidForever
      ? true
      : services.joinRecords.isForbidden(topic, ips, publicId);

    const permit = services.permissions.issue(
      {
        topic,
        privateId: started.privateId,
        publicId,
        startIps: ips,
        kermaEnough,
        anchor: anchorContext.isAnchor,
        anchorable,
        anchorSquare: anchor !== null,
        anchorUsername,
        chatterCreateTime: started.createTime,
      },
      now,
    );

    const auth: ChatterAuth = {
      publicId,
      colorToken: started.colorToken,
      anchorUsername,
      kermaEnough,
      chatFreeze,
      anchorSquare: anchor !== null,
    };

    return c.json({
      topic,
      anonymousId: loggedIn === null ? started.privateId.slice('ANONYMOUS_'.length) : null,
      publicId,
      colorToken: started.colorToken,
      colorHex: rgbHex(calculateColor(publicId, started.colorToken)),
      nickname: nickname.nickname,
      generatedNickname: nickname.generated,
      ipsHash,
      sealed: info?.sealed === true || anchor?.sealed === true,
      serverTime: now,
      token: services.identities.sign(auth, topic, now),
      permit,
      kerma: started.kermaValue,
      minKermaValue: anchor === null ? minKermaValue : null,
      chatroomType: chatroomType({
        anchorSquare: anchor !== null,
        minValue: anchor === null ? minKermaValue : null,
        myValue: started.kermaValue,
      }),
      kermaEnough,
      chatFreeze,
      forbidden,
      washGuardAllowance: washGuardAllowance(anchorable),
      anchorSquare: anchor,
      coAnchors: anchorContext.coAnchors,
      account:
        loggedIn === null ? null : { username: loggedIn.username, nickname: loggedIn.nickname },
      forbidFromChatDuration: Math.max(0, started.forbidFromChatUntil - now),
      showColorDuration: Math.max(0, started.showColorUntil - now),
      moderation: services.moderation?.statesFor(topic) ?? {},
      poster: services.posters.findSticky(topic, now, mediaBaseFor(requestOrigin(c))),
    });
  });

  app.post('/api/kerma/grow', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const topic = canonicalTopic(typeof body['topic'] === 'string' ? body['topic'] : '');
    const ips = clientIps(c);
    const permission = requirePermission(services, body['permit'], topic, ips);
    const now = services.clock.now();
    services.permissions.renew(permission.id, now);
    const grown = services.chatters.grow(permission.privateId, now);
    if (grown === null) {
      return c.json({ error: 'NO_SUCH_CHATTER' }, 400);
    }
    return c.json({ kerma: grown.kermaValue, serverTime: now });
  });

  app.post('/api/kerma/shop', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const topic = canonicalTopic(typeof body['topic'] === 'string' ? body['topic'] : '');
    const ips = clientIps(c);
    const permission = requirePermission(services, body['permit'], topic, ips);
    const item = body['item'];
    if (typeof item !== 'string' || !(item in KERMA_COST)) {
      return c.json({ error: 'NO_SUCH_ITEM' }, 400);
    }
    const now = services.clock.now();
    const minKerma = permission.anchorSquare ? 0 : services.squares.minKerma(topic);
    try {
      const state = services.chatters.buy(
        permission.privateId,
        item as KermaShopItem,
        now,
        minKerma,
      );
      if (item === 'euroSpray' && services.hub.has(topic)) {
        services.hub.get(topic).broadcast({
          t: 'event',
          event: systemEvent('SUCK_EURO_AIR_MESSAGE', '', now, {
            sucker: {
              publicId: permission.publicId,
              nickname: typeof body['nickname'] === 'string' ? body['nickname'] : '',
              colorToken: state.colorToken,
            },
          }),
        });
      }
      return c.json({
        kerma: state.kermaValue,
        colorToken: state.colorToken,
        colorHex: rgbHex(calculateColor(permission.publicId, state.colorToken)),
        forbidFromChatDuration: Math.max(0, state.forbidFromChatUntil - now),
        showColorDuration: Math.max(0, state.showColorUntil - now),
      });
    } catch (error) {
      if (error instanceof ShopError) {
        return refuse(c, error.code);
      }
      throw error;
    }
  });

  app.post('/api/vote/create', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const topic = canonicalTopic(typeof body['topic'] === 'string' ? body['topic'] : '');
    const ips = clientIps(c);
    const permission = requirePermission(services, body['permit'], topic, ips);
    const goal = body['goal'];
    if (typeof goal !== 'string') {
      return c.json({ error: 'INVALID_GOAL' }, 400);
    }
    if (permission.anchorSquare && !permission.anchorable) {
      throw new PermissionDenied('NOT_ANCHOR');
    }
    if (permission.anchorSquare && goal !== 'NORMAL') {
      throw new PermissionDenied('NOT_PERMITTED');
    }
    const creator: Creator = {
      publicId: permission.publicId,
      nickname: typeof body['nickname'] === 'string' ? body['nickname'] : '',
      colorToken: typeof body['colorToken'] === 'string' ? body['colorToken'] : null,
    };
    if (goal === 'POSTER') {
      if (!isFreeSquare(services, topic, permission)) {
        return c.json({ error: 'NOT_PERMITTED' }, 403);
      }
      const prepared = await preparePosterFromRequest(
        services,
        topic,
        creator,
        body,
        requestOrigin(c),
      );
      if (prepared === null) {
        return refuse(c, 'INVALID_POSTER');
      }
      body['poster'] = prepared;
    }
    if (goal === 'MIN_KERMA') {
      const chatter = services.chatters.load(permission.privateId);
      const level = Number(body['kerma'] ?? 0);
      const mine = chatter === null ? 0 : chatter.kermaValue;
      if (!MIN_KERMA_LEVELS.includes(level as (typeof MIN_KERMA_LEVELS)[number])) {
        return refuse(c, 'INVALID_GOAL');
      }
      if (level > mine) {
        return refuse(c, 'NOT_ENOUGH_KERMA');
      }
    }
    try {
      const input = buildVotingInput(goal as VotingGoalType, topic, creator, body);
      const id = services.votes.create(input, permission);
      return c.json({ votingId: id });
    } catch (error) {
      if (error instanceof VoteError) {
        return refuse(c, error.code);
      }
      throw error;
    }
  });

  app.post('/api/vote/cast', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const topic = canonicalTopic(typeof body['topic'] === 'string' ? body['topic'] : '');
    const ips = clientIps(c);
    const permission = requirePermission(services, body['permit'], topic, ips);
    const options = Array.isArray(body['options']) ? (body['options'] as string[]) : [];
    const votingId = String(body['votingId'] ?? '');
    if (isForbiddenCaster(services, permission, ips)) {
      throw new PermissionDenied('FORBIDDEN');
    }
    if (!wasPresentAtCreate(services, topic, votingId, permission.publicId)) {
      throw new PermissionDenied('NOT_PRESENT');
    }
    try {
      services.votes.cast(topic, votingId, options, permission, ips);
      return c.json({ ok: true });
    } catch (error) {
      if (error instanceof VoteError) {
        return refuse(c, error.code);
      }
      throw error;
    }
  });

  app.post('/api/vote/apply', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const topic = canonicalTopic(typeof body['topic'] === 'string' ? body['topic'] : '');
    const ips = clientIps(c);
    const permission = requirePermission(services, body['permit'], topic, ips);
    const votingId = String(body['votingId'] ?? '');
    const unforbid = body['unforbid'] === true;
    const payload = services.votes.loadForCreatorApply(topic, votingId, permission);
    if (payload === null || payload.goal === 'NORMAL') {
      return c.json({ applied: false });
    }
    if (!services.votes.hasReachedQuorum(payload, unforbid)) {
      return c.json({ applied: false });
    }
    const now = services.clock.now();
    const nickname =
      typeof body['nickname'] === 'string' ? body['nickname'] : payload.creator.nickname;
    const pending = services.db.transaction((): PendingBroadcast[] => {
      let broadcasts: PendingBroadcast[];
      switch (payload.goal) {
        case 'FORBID':
          broadcasts = applyForbid(
            services,
            topic,
            payload.goalDetail.targetPublicId,
            nickname,
            unforbid,
            now,
          ).pending;
          break;
        case 'BURN':
          broadcasts = applyBurn(
            services,
            topic,
            payload.goalDetail.targetPublicId,
            nickname,
            now,
          ).pending;
          break;
        case 'MIN_KERMA':
          broadcasts = applyMinKerma(services, topic, payload.goalDetail.kerma, now).pending;
          break;
        case 'POSTER': {
          const prepared = asPosterDto(payload.goalDetail.poster);
          if (prepared === null) {
            throw new PermissionDenied('INVALID_POSTER');
          }
          broadcasts = applyPoster(services, prepared, now).pending;
          break;
        }
        default: {
          const unhandled: never = payload;
          throw new PermissionDenied(`UNHANDLED_VOTE_GOAL_${String((unhandled as VoteView).goal)}`);
        }
      }
      services.votes.markApplied(votingId);
      return broadcasts;
    });
    emit(services, pending);
    return c.json({ applied: true });
  });

  app.post('/api/poster/create', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const topic = canonicalTopic(typeof body['topic'] === 'string' ? body['topic'] : '');
    const ips = clientIps(c);
    const permission = requirePermission(services, body['permit'], topic, ips);
    if (!permission.anchorSquare || !permission.anchorable) {
      return c.json({ error: 'NOT_PERMITTED' }, 403);
    }
    const creator: Creator = {
      publicId: permission.publicId,
      nickname: typeof body['nickname'] === 'string' ? body['nickname'] : '',
      colorToken: typeof body['colorToken'] === 'string' ? body['colorToken'] : null,
    };
    const prepared = await preparePosterFromRequest(
      services,
      topic,
      creator,
      body,
      requestOrigin(c),
    );
    if (prepared === null) {
      return refuse(c, 'INVALID_POSTER');
    }
    emit(services, applyPoster(services, prepared, services.clock.now()).pending);
    return c.json({ poster: prepared });
  });

  app.get('/api/poster', (c) => {
    const topic = canonicalTopic(c.req.query('topic') ?? '');
    if (topic.length === 0) {
      return c.json({ error: 'INVALID_TOPIC' }, 400);
    }
    return c.json({
      topic,
      poster: services.posters.findSticky(
        topic,
        services.clock.now(),
        mediaBaseFor(requestOrigin(c)),
      ),
    });
  });

  app.get('/api/vote/recent', (c) => {
    const topic = canonicalTopic(c.req.query('topic') ?? '');
    if (topic.length === 0) {
      return c.json({ error: 'INVALID_TOPIC' }, 400);
    }
    return c.json({ topic, votings: services.votes.listRecent(topic) });
  });
  app.post('/api/anchor/create', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const topic = canonicalTopic(typeof body['topic'] === 'string' ? body['topic'] : '');
    const accountId = accountIdOf(services, getCookie(c, SESSION_COOKIE));
    try {
      services.squares.ensure(topic, services.clock.now());
      services.anchors.create(topic, accountId, services.clock.now());
      return c.json({ ok: true });
    } catch (error) {
      if (error instanceof AnchorError) {
        return error.code === 'NOT_LOGIN'
          ? c.json({ error: error.code }, 401)
          : refuse(c, error.code);
      }
      throw error;
    }
  });

  app.post('/api/anchor/co-anchor', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const topic = canonicalTopic(typeof body['topic'] === 'string' ? body['topic'] : '');
    const accountId = accountIdOf(services, getCookie(c, SESSION_COOKIE));
    try {
      const coAnchors = services.anchors.addCoAnchor(
        topic,
        accountId,
        String(body['username'] ?? ''),
      );
      return c.json({ coAnchors });
    } catch (error) {
      if (error instanceof AnchorError) {
        return error.code === 'NOT_LOGIN'
          ? c.json({ error: error.code }, 401)
          : refuse(c, error.code);
      }
      throw error;
    }
  });

  app.post('/api/anchor/dismiss', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const topic = canonicalTopic(typeof body['topic'] === 'string' ? body['topic'] : '');
    const accountId = accountIdOf(services, getCookie(c, SESSION_COOKIE));
    try {
      services.anchors.dismiss(topic, accountId);
      if (services.hub.has(topic)) {
        services.hub.get(topic).broadcast({
          t: 'event',
          event: systemEvent('SYSTEM_MESSAGE', '', services.clock.now(), { redirect: true }),
        });
      }
      return c.json({ ok: true });
    } catch (error) {
      if (error instanceof AnchorError) {
        return error.code === 'NOT_LOGIN'
          ? c.json({ error: error.code }, 401)
          : refuse(c, error.code);
      }
      throw error;
    }
  });

  app.post('/api/anchor/forbid', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const topic = canonicalTopic(typeof body['topic'] === 'string' ? body['topic'] : '');
    const accountId = accountIdOf(services, getCookie(c, SESSION_COOKIE));
    if (!services.anchors.isAnchorable(topic, accountId)) {
      return refuse(c, 'NOT_ANCHOR');
    }
    const now = services.clock.now();
    const applied = services.db.transaction(() =>
      applyForbid(
        services,
        topic,
        String(body['targetPublicId'] ?? ''),
        String(body['nickname'] ?? SYSTEM_NICKNAME),
        body['unforbid'] === true,
        now,
      ),
    );
    emit(services, applied.pending);
    return c.json({ affected: applied.result.map((chatter) => chatter.publicId) });
  });

  app.get('/api/anchor/exists', (c) => {
    const topic = canonicalTopic(c.req.query('topic') ?? '');
    return c.json({ exists: topic.length > 0 && services.anchors.find(topic) !== null });
  });

  app.get('/api/anchor/co-anchors', (c) => {
    const topic = canonicalTopic(c.req.query('topic') ?? '');
    return c.json({ coAnchors: topic.length === 0 ? [] : services.anchors.coAnchors(topic) });
  });

  app.get('/api/home', (c) => {
    const now = services.clock.now();
    const mediaBase = mediaBaseFor(requestOrigin(c));
    return c.json({
      totalCrowd: services.directory.totalCrowd(now),
      hot: services.directory.hotSquares(now, mediaBase),
      latest: services.directory.latestSquares(now, mediaBase),
    });
  });

  app.get('/api/square/:topic/crowd', (c) => {
    const topic = canonicalTopic(c.req.param('topic'));
    if (topic.length === 0) {
      return c.json({ error: 'INVALID_TOPIC' }, 400);
    }
    if (!services.hub.has(topic)) {
      return c.json({ topic, crowd: 0, chatters: [] });
    }
    const room = services.hub.get(topic);
    return c.json({ topic, crowd: room.noOfCrowd, chatters: room.crowdView() });
  });

  app.get('/stat/top-topic', (c) => {
    const raw = c.req.query('min-no-of-crowd');
    if (raw === undefined || !/^[+-]?\d+$/u.test(raw.trim())) {
      return c.body(null, 400);
    }
    return c.json(services.directory.topTopics(services.clock.now(), Number(raw.trim())));
  });
}
