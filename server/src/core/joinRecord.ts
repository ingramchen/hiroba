import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { SELECT_BATCH, type Database } from '../db/client.js';
import { joinRecord } from '../db/schema.js';
import { trustedAddress } from './ip.js';

export interface JoinRecordRow {
  id: string;
  joinTime: Date;
  topic: string;
  publicId: string;
  privateId: string;
  nickname: string;
  ips: string;
  address: string;
  colorToken: string | null;
  forbid: boolean;
}

export class JoinRecords {
  constructor(private readonly db: Database) {}

  find(topic: string, publicId: string): JoinRecordRow | null {
    return (
      this.db
        .select()
        .from(joinRecord)
        .where(and(eq(joinRecord.topic, topic), eq(joinRecord.publicId, publicId)))
        .get() ?? null
    );
  }

  findAll(topic: string, publicIds: readonly string[]): Map<string, JoinRecordRow> {
    const found = new Map<string, JoinRecordRow>();
    if (publicIds.length === 0) {
      return found;
    }
    for (let at = 0; at < publicIds.length; at += SELECT_BATCH) {
      const rows = this.db
        .select()
        .from(joinRecord)
        .where(
          and(
            eq(joinRecord.topic, topic),
            inArray(joinRecord.publicId, publicIds.slice(at, at + SELECT_BATCH)),
          ),
        )
        .all();
      for (const row of rows) {
        found.set(row.publicId, row);
      }
    }
    return found;
  }

  findSameIps(record: JoinRecordRow): JoinRecordRow[] {
    if (record.address.length === 0) {
      return [record];
    }
    return this.db
      .select()
      .from(joinRecord)
      .where(and(eq(joinRecord.topic, record.topic), eq(joinRecord.address, record.address)))
      .all();
  }

  save(row: {
    topic: string;
    publicId: string;
    privateId: string;
    nickname: string;
    ips: string;
    colorToken: string | null;
    now: number;
  }): void {
    const values = {
      id: randomUUID(),
      joinTime: new Date(row.now),
      topic: row.topic,
      publicId: row.publicId,
      privateId: row.privateId,
      nickname: row.nickname,
      ips: row.ips,
      address: trustedAddress(row.ips),
      colorToken: row.colorToken,
      forbid: false,
    };
    this.db
      .insert(joinRecord)
      .values(values)
      .onConflictDoUpdate({
        target: [joinRecord.topic, joinRecord.publicId],
        set: {
          joinTime: values.joinTime,
          privateId: values.privateId,
          nickname: values.nickname,
          ips: values.ips,
          address: values.address,
          colorToken: values.colorToken,
        },
      })
      .run();
  }

  setForbid(ids: string[], forbid: boolean): void {
    for (const id of ids) {
      this.db.update(joinRecord).set({ forbid }).where(eq(joinRecord.id, id)).run();
    }
  }

  isForbidden(topic: string, ips: string, publicId: string): boolean {
    const address = trustedAddress(ips);
    const row = this.db
      .select({ one: sql<number>`1` })
      .from(joinRecord)
      .where(
        and(
          eq(joinRecord.topic, topic),
          address.length === 0
            ? eq(joinRecord.publicId, publicId)
            : or(eq(joinRecord.address, address), eq(joinRecord.publicId, publicId)),
          eq(joinRecord.forbid, true),
        ),
      )
      .get();
    return row !== undefined;
  }

  forbidState(
    topic: string,
    ips: string,
    publicId: string,
  ): { forbidden: boolean; privateId: string | null } {
    const address = trustedAddress(ips);
    const row = this.db
      .select({
        forbidden: sql<number>`max(case when ${joinRecord.forbid} then 1 else 0 end)`,
        privateId: sql<
          string | null
        >`max(case when ${joinRecord.publicId} = ${publicId} then ${joinRecord.privateId} end)`,
      })
      .from(joinRecord)
      .where(
        and(
          eq(joinRecord.topic, topic),
          address.length === 0
            ? eq(joinRecord.publicId, publicId)
            : or(eq(joinRecord.address, address), eq(joinRecord.publicId, publicId)),
        ),
      )
      .get();
    return { forbidden: row?.forbidden === 1, privateId: row?.privateId ?? null };
  }

  search(
    filter: { address?: string; publicId?: string; topic?: string },
    limit: number,
  ): JoinRecordRow[] {
    const clauses = [];
    if (filter.address !== undefined && filter.address.length > 0) {
      clauses.push(eq(joinRecord.address, filter.address));
    }
    if (filter.publicId !== undefined && filter.publicId.length > 0) {
      clauses.push(eq(joinRecord.publicId, filter.publicId));
    }
    if (filter.topic !== undefined && filter.topic.length > 0) {
      clauses.push(eq(joinRecord.topic, filter.topic));
    }
    if (clauses.length === 0) {
      return [];
    }
    return this.db
      .select()
      .from(joinRecord)
      .where(and(...clauses))
      .orderBy(desc(joinRecord.joinTime))
      .limit(limit)
      .all();
  }

  purgeBefore(cutoff: number): number {
    return this.db
      .delete(joinRecord)
      .where(lt(joinRecord.joinTime, new Date(cutoff)))
      .returning({ id: joinRecord.id })
      .all().length;
  }
}
