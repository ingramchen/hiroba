import { randomUUID } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { chatterPermission } from '../db/schema.js';

export const PERMISSION_TTL_MS = 15 * 60 * 1000;

export interface Permission {
  id: string;
  topic: string;
  privateId: string;
  publicId: string;
  startIps: string;
  kermaEnough: boolean;
  anchor: boolean;
  anchorable: boolean;
  anchorSquare: boolean;
  anchorUsername: string;
  chatterCreateTime: number;
}

export class Permissions {
  constructor(private readonly db: Database) {}

  issue(permission: Omit<Permission, 'id'>, now: number): string {
    const id = randomUUID();
    this.db
      .insert(chatterPermission)
      .values({
        id,
        topic: permission.topic,
        privateId: permission.privateId,
        publicId: permission.publicId,
        startIps: permission.startIps,
        kermaEnough: permission.kermaEnough,
        anchor: permission.anchor,
        anchorable: permission.anchorable,
        anchorSquare: permission.anchorSquare,
        anchorUsername: permission.anchorUsername,
        chatterCreateTime: new Date(permission.chatterCreateTime),
        expiresAt: new Date(now + PERMISSION_TTL_MS),
      })
      .run();
    return id;
  }

  find(id: string, now: number): Permission | null {
    if (id.length === 0) {
      return null;
    }
    const row = this.db.select().from(chatterPermission).where(eq(chatterPermission.id, id)).get();
    if (row === undefined || row.expiresAt.getTime() <= now) {
      return null;
    }
    return {
      id: row.id,
      topic: row.topic,
      privateId: row.privateId,
      publicId: row.publicId,
      startIps: row.startIps,
      kermaEnough: row.kermaEnough,
      anchor: row.anchor,
      anchorable: row.anchorable,
      anchorSquare: row.anchorSquare,
      anchorUsername: row.anchorUsername,
      chatterCreateTime: row.chatterCreateTime.getTime(),
    };
  }

  renew(id: string, now: number): void {
    this.db
      .update(chatterPermission)
      .set({ expiresAt: new Date(now + PERMISSION_TTL_MS) })
      .where(eq(chatterPermission.id, id))
      .run();
  }

  revoke(id: string): void {
    this.db.delete(chatterPermission).where(eq(chatterPermission.id, id)).run();
  }

  purgeExpired(now: number): number {
    return this.db
      .delete(chatterPermission)
      .where(lt(chatterPermission.expiresAt, new Date(now)))
      .returning({ id: chatterPermission.id })
      .all().length;
  }
}
