import type { MessageEvent } from '@hiroba/shared';
import { LIMITS } from '@hiroba/shared';
import { desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { square, squareInfo, squareLive } from '../db/schema.js';
import { ChatterRepository } from './chatter.js';
import { JoinRecords } from './joinRecord.js';
import type { LiveSquare, RoomStore } from './room/types.js';

export class SqliteRoomStore implements RoomStore {
  private readonly joinRecords: JoinRecords;
  private readonly chatters: ChatterRepository;

  constructor(private readonly db: Database) {
    this.joinRecords = new JoinRecords(db);
    this.chatters = new ChatterRepository(db);
  }

  isForbidden(topic: string, ips: string, publicId: string): boolean {
    const state = this.joinRecords.forbidState(topic, ips, publicId);
    if (state.forbidden) {
      return true;
    }
    if (state.privateId === null) {
      return false;
    }
    return this.chatters.load(state.privateId)?.kermaForbidForever === true;
  }

  ensureSquare(topic: string, now: number): void {
    this.db
      .insert(squareInfo)
      .values({ topic, createTime: new Date(now) })
      .onConflictDoNothing()
      .run();
  }

  loadRing(topic: string): MessageEvent[] {
    const rows = this.db
      .select({ message: square.message })
      .from(square)
      .where(eq(square.topic, topic))
      .orderBy(desc(square.id))
      .limit(LIMITS.historyRing)
      .all();
    const events: MessageEvent[] = [];
    for (const row of rows.toReversed()) {
      const parsed = parseEvent(row.message);
      if (parsed !== null) {
        events.push(parsed);
      }
    }
    return events;
  }

  appendMessage(topic: string, event: MessageEvent): void {
    this.db
      .insert(square)
      .values({ topic, message: JSON.stringify(event), createDate: new Date(event.date) })
      .run();
  }

  writeLive(live: LiveSquare): void {
    const values = {
      topic: live.topic,
      crowd: live.crowd,
      lastAccess: live.lastAccess,
      latestMessages: JSON.stringify(live.latestMessages),
    };
    this.db
      .insert(squareLive)
      .values(values)
      .onConflictDoUpdate({
        target: squareLive.topic,
        set: {
          crowd: values.crowd,
          lastAccess: values.lastAccess,
          latestMessages: values.latestMessages,
        },
      })
      .run();
  }
}

export function resetLiveCrowd(db: Database): void {
  db.update(squareLive).set({ crowd: 0 }).run();
}

export function isMessageEvent(value: unknown): value is MessageEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const event = value as MessageEvent;
  return typeof event.eventType === 'string' && typeof event.content === 'string';
}

export function parseEvent(raw: string): MessageEvent | null {
  try {
    const value: unknown = JSON.parse(raw);
    return isMessageEvent(value) ? value : null;
  } catch {
    return null;
  }
}

export function parseEvents(raw: string): MessageEvent[] {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  return Array.isArray(value) ? value.filter(isMessageEvent) : [];
}
