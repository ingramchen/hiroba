import type { SysStatPoint, SysStatsResponse } from '@hiroba/shared';
import { count, gte, sql } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { Database } from '../db/client.js';
import { account, anonymous, poster, square, squareInfo, voting } from '../db/schema.js';
import type { RoomHub } from './room/hub.js';
import { readTimeZone, timeZoneConfigured as isTimeZoneConfigured } from './timeZone.js';

export const SYS_STATS_DEFAULT_DAYS = 30;
export const SYS_STATS_MAX_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;
const BUCKET_SECONDS = 15 * 60;

export function boundDays(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) {
    return SYS_STATS_DEFAULT_DAYS;
  }
  return Math.min(Math.trunc(value), SYS_STATS_MAX_DAYS);
}

export class SysStats {
  private readonly dayFormat: Intl.DateTimeFormat;

  constructor(
    private readonly db: Database,
    private readonly hub: RoomHub,
    private readonly timeZone: string = readTimeZone(process.env),
    private readonly timeZoneConfigured: boolean = isTimeZoneConfigured(process.env),
  ) {
    this.dayFormat = new Intl.DateTimeFormat('en-US', {
      timeZone: this.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  private dayOf(epochSeconds: number): string {
    const parts = this.dayFormat.formatToParts(new Date(epochSeconds * 1000));
    const part = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  private series(table: SQLiteTable, column: SQLiteColumn, since: number): SysStatPoint[] {
    const bucket = sql<number>`(${column} / 1000) / ${BUCKET_SECONDS}`;
    const rows = this.db
      .select({ bucket, count: count() })
      .from(table)
      .where(gte(column, new Date(since)))
      .groupBy(bucket)
      .all();
    const days = new Map<string, number>();
    for (const row of rows) {
      const day = this.dayOf(Number(row.bucket) * BUCKET_SECONDS);
      days.set(day, (days.get(day) ?? 0) + row.count);
    }
    return [...days]
      .map(([day, total]) => ({ day, count: total }))
      .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  }

  private total(table: SQLiteTable): number {
    return this.db.select({ count: count() }).from(table).get()?.count ?? 0;
  }

  read(days: number, now: number): SysStatsResponse {
    const since = now - days * DAY_MS;
    return {
      days,
      since,
      timeZone: this.timeZone,
      timeZoneConfigured: this.timeZoneConfigured,
      accounts: this.series(account, account.createTime, since),
      anonymous: this.series(anonymous, anonymous.createTime, since),
      messages: this.series(square, square.createDate, since),
      squares: this.series(squareInfo, squareInfo.createTime, since),
      posters: this.series(poster, poster.createTime, since),
      votings: this.series(voting, voting.createTime, since),
      totals: {
        accounts: this.total(account),
        anonymous: this.total(anonymous),
        messages: this.total(square),
        squares: this.total(squareInfo),
      },
      crowd: this.hub.totalCrowd(),
      liveSquares: this.hub.topics().length,
    };
  }
}
