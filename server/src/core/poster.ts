import { randomUUID } from 'node:crypto';
import { POSTER_TYPES, type PosterCreator, type PosterType, type PosterView } from '@hiroba/shared';
import { desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { poster } from '../db/schema.js';
import { mediaRoutePath, mediaUrlOf } from './storage/blob.js';

export const POSTER_MAX_CONTENT_LENGTH = 3000;
export const POSTER_TTL_DAYS = 30;
export const POSTER_TTL_MS = POSTER_TTL_DAYS * 24 * 60 * 60 * 1000;
export { POSTER_TYPES };
export type { PosterCreator, PosterType, PosterView, PosterView as PosterDto };

export function isPosterType(value: unknown): value is PosterType {
  return typeof value === 'string' && (POSTER_TYPES as readonly string[]).includes(value);
}

export function abbreviatePosterContent(raw: string, maxWidth = POSTER_MAX_CONTENT_LENGTH): string {
  if (raw.length <= maxWidth) {
    return raw;
  }
  return `${raw.slice(0, maxWidth - 3)}...`;
}

export interface PreparePosterInput {
  topic: string;
  creator: PosterCreator;
  posterType: PosterType;
  mediaUrl: string;
  content: string;
}

export function preparePoster(input: PreparePosterInput, now: number): PosterView {
  return {
    id: randomUUID(),
    topic: input.topic,
    creator: input.creator,
    mediaUrl: input.mediaUrl,
    posterType: input.posterType,
    content: abbreviatePosterContent(input.content),
    createTime: now,
  };
}

export function asPosterDto(value: unknown): PosterView | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const creator = raw['creator'] as Record<string, unknown> | undefined;
  if (
    typeof raw['id'] !== 'string' ||
    typeof raw['topic'] !== 'string' ||
    typeof raw['mediaUrl'] !== 'string' ||
    typeof raw['content'] !== 'string' ||
    typeof raw['createTime'] !== 'number' ||
    !isPosterType(raw['posterType']) ||
    creator === undefined ||
    typeof creator['publicId'] !== 'string' ||
    typeof creator['nickname'] !== 'string'
  ) {
    return null;
  }
  return {
    id: raw['id'],
    topic: raw['topic'],
    creator: {
      publicId: creator['publicId'],
      nickname: creator['nickname'],
      colorToken: typeof creator['colorToken'] === 'string' ? creator['colorToken'] : null,
    },
    mediaUrl: raw['mediaUrl'],
    posterType: raw['posterType'],
    content: raw['content'],
    createTime: raw['createTime'],
  };
}

interface StoredBody {
  content: string;
  mediaPath: string;
  posterType: PosterType;
}

function posterMediaUrl(stored: string, mediaBase: string): string {
  return /^https?:\/\//iu.test(stored) ? stored : mediaUrlOf(mediaBase, stored);
}

export class Posters {
  constructor(private readonly db: Database) {}

  create(dto: PosterView): void {
    const body: StoredBody = {
      content: dto.content,
      mediaPath: mediaRoutePath(dto.mediaUrl) ?? dto.mediaUrl,
      posterType: dto.posterType,
    };
    this.db
      .insert(poster)
      .values({
        id: dto.id,
        topic: dto.topic,
        createTime: new Date(dto.createTime),
        creatorPublicId: dto.creator.publicId,
        creatorNickname: dto.creator.nickname,
        creatorColorToken: dto.creator.colorToken,
        posterType: dto.posterType,
        body: JSON.stringify(body),
      })
      .run();
  }

  findSticky(topic: string, now: number, mediaBase: string): PosterView | null {
    const row = this.db
      .select()
      .from(poster)
      .where(eq(poster.topic, topic))
      .orderBy(desc(poster.createTime))
      .limit(1)
      .get();
    if (row === undefined) {
      return null;
    }
    const createTime = row.createTime.getTime();
    if (createTime + POSTER_TTL_MS < now) {
      return null;
    }
    const body = JSON.parse(row.body) as StoredBody;
    return {
      id: row.id,
      topic: row.topic,
      creator: {
        publicId: row.creatorPublicId,
        nickname: row.creatorNickname,
        colorToken: row.creatorColorToken,
      },
      mediaUrl: posterMediaUrl(body.mediaPath, mediaBase),
      posterType: body.posterType,
      content: body.content,
      createTime,
    };
  }

  deleteAll(topic: string): void {
    this.db.delete(poster).where(eq(poster.topic, topic)).run();
  }
}
