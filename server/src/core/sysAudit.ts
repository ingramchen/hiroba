import { createHash } from 'node:crypto';
import type { SysAuditEntry, SysAuditTargetType } from '@hiroba/shared';
import { desc } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { sysAudit } from '../db/schema.js';

export const SYS_AUDIT_DEFAULT_LIMIT = 100;
export const SYS_AUDIT_MAX_LIMIT = 500;

export interface SysActor {
  address: string;
  session: string;
}

export interface SysAuditWrite {
  action: string;
  targetType: SysAuditTargetType;
  target: string;
  topic?: string;
  detail?: Record<string, unknown>;
}

export function sessionLabel(id: string | undefined): string {
  if (id === undefined || id.length === 0) {
    return '';
  }
  return createHash('sha256').update(id).digest('hex').slice(0, 8);
}

export class SysAuditLog {
  constructor(private readonly db: Database) {}

  record(actor: SysActor, write: SysAuditWrite, now: number): void {
    this.db
      .insert(sysAudit)
      .values({
        createTime: new Date(now),
        actor: actor.address,
        session: actor.session,
        action: write.action,
        targetType: write.targetType,
        target: write.target,
        topic: write.topic ?? '',
        detail: write.detail === undefined ? '' : JSON.stringify(write.detail),
      })
      .run();
  }

  recent(limit: number): SysAuditEntry[] {
    const bounded = Math.min(Math.max(Math.trunc(limit), 1), SYS_AUDIT_MAX_LIMIT);
    return this.db
      .select()
      .from(sysAudit)
      .orderBy(desc(sysAudit.id))
      .limit(bounded)
      .all()
      .map((row) => ({
        id: row.id,
        time: row.createTime.getTime(),
        actor: row.actor,
        session: row.session,
        action: row.action,
        targetType: row.targetType as SysAuditTargetType,
        target: row.target,
        topic: row.topic,
        detail: row.detail,
      }));
  }
}
