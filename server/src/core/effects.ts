import {
  BURN_PUNISH_KERMA,
  FIXED_DURATION_SEC,
  SHORT_DURATIONS_SEC,
  SPECIAL_OPTIONS,
  chatroomType,
  detectMedia,
  isChatFreeze,
  isGifLike,
  isKermaEnough,
  isPosterableKind,
  isYoutubeEmbedUrl,
  mediaBaseFor,
  ParsedUrl,
  safeReason,
  type ServerFrame,
  type VotingGoalType,
} from '@hiroba/shared';
import { PermissionDenied, systemEvent } from './http.js';
import type { Permission } from './permission.js';
import {
  POSTER_MAX_CONTENT_LENGTH,
  isPosterType,
  preparePoster,
  type PosterDto,
} from './poster.js';
import { POSTER_LIMIT_BYTES } from './storage/service.js';
import type { Services } from './types.js';
import { voteEvent, type Creator, type VoteService } from './vote.js';

export function buildVotingInput(
  goal: VotingGoalType,
  topic: string,
  creator: Creator,
  body: Record<string, unknown>,
): Parameters<VoteService['create']>[0] {
  const reason = safeReason(typeof body['reason'] === 'string' ? body['reason'] : '');
  if (goal === 'NORMAL') {
    return {
      topic,
      creator,
      title: typeof body['title'] === 'string' ? body['title'] : '',
      options: Array.isArray(body['options']) ? (body['options'] as string[]) : [],
      durationMs: Number(body['durationSec'] ?? 0) * 1000,
      multipleChoiceConfig: Number(body['multipleChoiceConfig'] ?? 1),
      goal,
      goalDetail: {},
    };
  }
  const durationSec =
    goal === 'FORBID' || goal === 'BURN'
      ? (SHORT_DURATIONS_SEC.find((seconds: number) => seconds === Number(body['durationSec'])) ??
        0)
      : FIXED_DURATION_SEC;
  const detail: Record<string, unknown> = { reason };
  if (goal === 'FORBID' || goal === 'BURN') {
    detail['targetPublicId'] = String(body['targetPublicId'] ?? '');
    detail['targetNickname'] = String(body['targetNickname'] ?? '');
  }
  if (goal === 'MIN_KERMA') {
    detail['kerma'] = Number(body['kerma'] ?? 0);
  }
  if (goal === 'POSTER') {
    detail['poster'] = body['poster'] ?? null;
  }
  return {
    topic,
    creator,
    title: `__i18n_vote${goal === 'MIN_KERMA' ? 'MinKerma' : goal.charAt(0) + goal.slice(1).toLowerCase()}Title`,
    options: [...SPECIAL_OPTIONS[goal]],
    durationMs: durationSec * 1000,
    multipleChoiceConfig: 1,
    goal,
    goalDetail: detail,
  };
}

export function isFreeSquare(services: Services, topic: string, permission: Permission): boolean {
  if (permission.anchorSquare) {
    return false;
  }
  const chatter = services.chatters.load(permission.privateId);
  return (
    chatroomType({
      anchorSquare: false,
      minValue: services.squares.minKerma(topic),
      myValue: chatter === null ? 0 : chatter.kermaValue,
    }) === 'FREE'
  );
}

export async function preparePosterFromRequest(
  services: Services,
  topic: string,
  creator: Creator,
  body: Record<string, unknown>,
  origin: string,
): Promise<PosterDto | null> {
  const posterType = body['posterType'];
  const mediaUrl = body['mediaUrl'];
  const content = typeof body['content'] === 'string' ? body['content'] : '';
  if (!isPosterType(posterType) || typeof mediaUrl !== 'string' || mediaUrl.length === 0) {
    return null;
  }
  if (content.length > POSTER_MAX_CONTENT_LENGTH * 2) {
    return null;
  }
  if (!isPosterableMedia(posterType, mediaUrl, mediaBaseFor(origin))) {
    throw new PermissionDenied('POSTER_MEDIA_NOT_ALLOWED');
  }
  let hosted = mediaUrl;
  if (posterType === 'IMAGE') {
    if (services.media === null) {
      return null;
    }
    try {
      hosted = await services.media.storage.storeFromDownload(
        mediaUrl,
        'ONE_MONTH',
        POSTER_LIMIT_BYTES,
        origin,
      );
    } catch {
      return null;
    }
  }
  return preparePoster(
    { topic, creator, posterType, mediaUrl: hosted, content },
    services.clock.now(),
  );
}

export function isPosterableMedia(
  posterType: 'IMAGE' | 'YOUTUBE',
  mediaUrl: string,
  mediaBase: string,
): boolean {
  let url: ParsedUrl;
  try {
    url = new ParsedUrl(mediaUrl);
  } catch {
    return false;
  }
  if (posterType === 'YOUTUBE') {
    return isYoutubeEmbedUrl(url) || detectMedia(url, mediaBase) === 'youtube';
  }
  const kind = detectMedia(url, mediaBase);
  return kind !== null && isPosterableKind(kind) && kind === 'image' && !isGifLike(url);
}

export function isForbiddenCaster(
  services: Services,
  permission: Permission,
  ips: string,
): boolean {
  const chatter = services.chatters.load(permission.privateId);
  if (chatter !== null && chatter.kermaForbidForever) {
    return true;
  }
  return services.joinRecords.isForbidden(permission.topic, ips, permission.publicId);
}

export function wasPresentAtCreate(
  services: Services,
  topic: string,
  votingId: string,
  publicId: string,
): boolean {
  const active = services.votes.activeVoting(topic);
  if (active === null || active.id !== votingId) {
    return true;
  }
  const joined = services.joinRecords.find(topic, publicId);
  return joined !== null && joined.joinTime.getTime() <= active.createTime;
}

export interface PendingBroadcast {
  topic: string;
  frame: ServerFrame;
}

export interface Applied<T> {
  result: T;
  pending: PendingBroadcast[];
}

export function emit(services: Services, pending: readonly PendingBroadcast[]): void {
  for (const item of pending) {
    if (services.hub.has(item.topic)) {
      services.hub.get(item.topic).broadcast(item.frame);
    }
  }
}

export function applyPoster(services: Services, dto: PosterDto, now: number): Applied<null> {
  services.posters.create(dto);
  return {
    result: null,
    pending: [
      {
        topic: dto.topic,
        frame: {
          t: 'event',
          event: systemEvent('POSTER_MESSAGE', dto.content, now, { poster: dto }),
        },
      },
    ],
  };
}

export interface ForbiddenChatter {
  publicId: string;
  nickname: string;
  colorToken: string | null;
}

export function applyForbid(
  services: Services,
  topic: string,
  targetPublicId: string,
  senderName: string,
  unforbid: boolean,
  now: number,
): Applied<ForbiddenChatter[]> {
  const found = services.joinRecords.find(topic, targetPublicId);
  if (found === null) {
    return { result: [], pending: [] };
  }
  const same = services.joinRecords.findSameIps(found);
  services.joinRecords.setForbid(
    same.map((record) => record.id),
    !unforbid,
  );
  const publicIds = same.map((record) => record.publicId);
  const chatters = same.map((record) => ({
    publicId: record.publicId,
    nickname: record.nickname,
    colorToken: record.colorToken,
  }));
  if (services.hub.has(topic)) {
    services.hub.get(topic).setForbidden(publicIds, !unforbid);
  }
  return {
    result: chatters,
    pending: [
      {
        topic,
        frame: {
          t: 'event',
          event: systemEvent('FORBID_MESSAGE', senderName, now, {
            senderName,
            unforbid,
            publicIds,
            chatters,
          }),
        },
      },
    ],
  };
}

export function refreshTiers(
  services: Services,
  topic: string,
  publicIds: readonly string[] | null,
): void {
  if (!services.hub.has(topic)) {
    return;
  }
  const room = services.hub.get(topic);
  const anchor = services.anchors.find(topic);
  const minKermaValue = anchor === null ? services.squares.minKerma(topic) : 0;
  const targets = publicIds ?? room.crowdView().map((chatter) => chatter.publicId);
  const records = services.joinRecords.findAll(topic, targets);
  const chatters = services.chatters.loadAll(
    [...records.values()].map((record) => record.privateId),
  );
  for (const publicId of targets) {
    const record = records.get(publicId);
    const chatter = record === undefined ? null : (chatters.get(record.privateId) ?? null);
    if (chatter === null) {
      continue;
    }
    room.refreshAuth(publicId, {
      kermaEnough:
        anchor !== null ||
        isKermaEnough(chatter.kermaValue, minKermaValue, chatter.kermaForbidForever),
      chatFreeze:
        anchor === null &&
        (chatter.kermaForbidForever || isChatFreeze(minKermaValue, chatter.kermaValue)),
    });
  }
}

export function applyBurn(
  services: Services,
  topic: string,
  targetPublicId: string,
  senderName: string,
  now: number,
): Applied<boolean> {
  const found = services.joinRecords.find(topic, targetPublicId);
  if (found === null) {
    return { result: false, pending: [] };
  }
  const id = found.privateId.slice(found.privateId.indexOf('_') + 1);
  services.chatters.punishBoth(id, BURN_PUNISH_KERMA);
  refreshTiers(services, topic, [targetPublicId]);
  return {
    result: true,
    pending: [
      {
        topic,
        frame: {
          t: 'event',
          event: systemEvent('BURN_MESSAGE', senderName, now, {
            senderName,
            targetPublicId,
            targetNickname: found.nickname,
            kerma: BURN_PUNISH_KERMA,
          }),
        },
      },
    ],
  };
}

export function applyMinKerma(
  services: Services,
  topic: string,
  kerma: number,
  now: number,
): Applied<null> {
  services.squares.updateMinKerma(topic, kerma);
  const updated = services.squares.minKerma(topic);
  refreshTiers(services, topic, null);
  return {
    result: null,
    pending: [
      {
        topic,
        frame: {
          t: 'event',
          event: systemEvent('MIN_SQUARE_KERMA_MESSAGE', String(updated), now, {
            minKermaValue: updated,
          }),
        },
      },
    ],
  };
}

export function publishVote(services: Services): (topic: string, payload: unknown) => void {
  return (topic, payload) => {
    if (!services.hub.has(topic)) {
      return;
    }
    services.hub
      .get(topic)
      .broadcast({ t: 'event', event: voteEvent(payload as never, services.clock.now()) });
  };
}
