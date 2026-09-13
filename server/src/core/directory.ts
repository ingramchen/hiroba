import { LIMITS, type SquareView, type SquareThumb } from '@hiroba/shared';
import { asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { squareInfo, squareLive } from '../db/schema.js';
import { mediaUrlOf } from './storage/blob.js';
import { parseEvents } from './store.js';

export type { SquareView, SquareThumb };

export const SQUARE_EXPIRE_MS = 24 * 60 * 60 * 1000;
export const MAX_LIVE_SQUARES = 200;

export class SquareDirectory {
  constructor(
    private readonly db: Database,
    private readonly expireMs: number = SQUARE_EXPIRE_MS,
    private readonly maxLiveSquares: number = MAX_LIVE_SQUARES,
  ) {}

  private rows() {
    return this.db
      .select({
        topic: squareLive.topic,
        crowd: squareLive.crowd,
        lastAccess: squareLive.lastAccess,
        latestMessages: squareLive.latestMessages,
        thumbPath: squareInfo.thumbPath,
        thumbWidth: squareInfo.thumbWidth,
        thumbHeight: squareInfo.thumbHeight,
      })
      .from(squareLive)
      .leftJoin(squareInfo, eq(squareInfo.topic, squareLive.topic));
  }

  hotSquares(_now: number, mediaBase: string): SquareView[] {
    return this.rows()
      .orderBy(desc(squareLive.crowd))
      .limit(LIMITS.homeListSize)
      .all()
      .map((row) => toView(row, mediaBase));
  }

  latestSquares(
    _now: number,
    mediaBase: string,
    minCrowd: number = LIMITS.latestMinCrowd,
  ): SquareView[] {
    return this.db
      .select({
        topic: squareLive.topic,
        crowd: squareLive.crowd,
        lastAccess: squareLive.lastAccess,
        latestMessages: squareLive.latestMessages,
        thumbPath: squareInfo.thumbPath,
        thumbWidth: squareInfo.thumbWidth,
        thumbHeight: squareInfo.thumbHeight,
      })
      .from(squareLive)
      .leftJoin(squareInfo, eq(squareInfo.topic, squareLive.topic))
      .where(gte(squareLive.crowd, minCrowd))
      .orderBy(desc(squareLive.lastAccess))
      .limit(LIMITS.homeListSize)
      .all()
      .map((row) => toView(row, mediaBase));
  }

  totalCrowd(_now: number): number {
    const row = this.db
      .select({ total: sql<number>`coalesce(sum(${squareLive.crowd}), 0)` })
      .from(squareLive)
      .get();
    return row?.total ?? 0;
  }

  pruneExpired(now: number): string[] {
    const rows = this.db
      .select({ topic: squareLive.topic, lastAccess: squareLive.lastAccess })
      .from(squareLive)
      .orderBy(asc(squareLive.lastAccess))
      .all();
    const excess = rows.length - this.maxLiveSquares;
    if (excess <= 0) {
      return [];
    }
    const cutoff = now - this.expireMs;
    const expired = rows
      .filter((row) => row.lastAccess < cutoff)
      .slice(0, excess)
      .map((row) => row.topic);
    if (expired.length > 0) {
      this.db.delete(squareLive).where(inArray(squareLive.topic, expired)).run();
    }
    return expired;
  }

  topTopics(_now: number, minCrowd: number): Record<string, number> {
    const rows = this.db
      .select({ topic: squareLive.topic, crowd: squareLive.crowd })
      .from(squareLive)
      .where(gte(squareLive.crowd, minCrowd))
      .orderBy(desc(squareLive.crowd))
      .all();
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.topic] = row.crowd;
    }
    return result;
  }
}

interface DirectoryRow {
  topic: string;
  crowd: number;
  latestMessages: string;
  thumbPath: string | null;
  thumbWidth: number | null;
  thumbHeight: number | null;
}

function toView(row: DirectoryRow, mediaBase: string): SquareView {
  return {
    topic: row.topic,
    crowd: row.crowd,
    latestMessages: parseEvents(row.latestMessages),
    thumb:
      row.thumbPath !== null && row.thumbWidth !== null && row.thumbHeight !== null
        ? {
            url: mediaUrlOf(mediaBase, row.thumbPath),
            width: row.thumbWidth,
            height: row.thumbHeight,
          }
        : null,
  };
}
