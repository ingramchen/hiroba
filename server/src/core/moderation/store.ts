import type { ModerationState, ModerationStates } from '@hiroba/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { imageModeration } from '../../db/schema.js';

export const MODERATION_START_LIMIT = 50;

export type ModerationRowState = ModerationState | 'block';

const LISTED: readonly ModerationRowState[] = ['pending', 'flag', 'error'];

export interface ModerationRow {
  mediaKey: string;
  topic: string;
  state: ModerationRowState;
}

export class ModerationStore {
  constructor(private readonly db: Database) {}

  markPending(mediaKey: string, topic: string, now: number): void {
    this.db
      .insert(imageModeration)
      .values({ mediaKey, topic, state: 'pending', createTime: new Date(now) })
      .onConflictDoUpdate({
        target: imageModeration.mediaKey,
        set: { topic, state: 'pending', createTime: new Date(now) },
      })
      .run();
  }

  setState(mediaKey: string, state: ModerationRowState): void {
    this.db
      .update(imageModeration)
      .set({ state })
      .where(eq(imageModeration.mediaKey, mediaKey))
      .run();
  }

  find(mediaKey: string): ModerationRow | null {
    const row = this.db
      .select()
      .from(imageModeration)
      .where(eq(imageModeration.mediaKey, mediaKey))
      .get();
    return row === undefined
      ? null
      : { mediaKey: row.mediaKey, topic: row.topic, state: row.state as ModerationRowState };
  }

  statesFor(topic: string, limit: number = MODERATION_START_LIMIT): ModerationStates {
    const rows = this.db
      .select({ mediaKey: imageModeration.mediaKey, state: imageModeration.state })
      .from(imageModeration)
      .where(and(eq(imageModeration.topic, topic), inArray(imageModeration.state, [...LISTED])))
      .orderBy(desc(imageModeration.createTime))
      .limit(limit)
      .all();
    const states: ModerationStates = {};
    for (const row of rows) {
      states[row.mediaKey] = row.state as ModerationState;
    }
    return states;
  }
}
