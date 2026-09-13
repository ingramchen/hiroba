import { randomUUID } from 'node:crypto';
import { foldHandle, isReservedHandle, isValidHandle } from '@hiroba/shared';
import { and, eq, lt } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { account, accountSession } from '../db/schema.js';

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'hiroba.session';

export type HandleErrorCode =
  'NOT_LOGIN' | 'INVALID_HANDLE' | 'HANDLE_RESERVED' | 'HANDLE_TAKEN' | 'HANDLE_ALREADY_SET';

export class HandleError extends Error {
  constructor(readonly code: HandleErrorCode) {
    super(code);
  }
}

export interface AccountRow {
  id: number;
  username: string | null;
  usernameFolded: string | null;
  nickname: string;
  accountDomain: string;
  accountUuid: string;
}

export class Accounts {
  constructor(private readonly db: Database) {}

  findOrCreate(
    input: { email: string; nickname: string; accountDomain: string; accountUuid: string },
    now: number,
  ): AccountRow {
    const existing = this.db
      .select()
      .from(account)
      .where(eq(account.accountUuid, input.accountUuid))
      .get();
    if (existing !== undefined) {
      this.db
        .update(account)
        .set({ email: input.email, nickname: input.nickname })
        .where(eq(account.id, existing.id))
        .run();
      return { ...existing, nickname: input.nickname };
    }
    return this.db
      .insert(account)
      .values({
        username: null,
        usernameFolded: null,
        email: input.email,
        nickname: input.nickname,
        accountDomain: input.accountDomain,
        accountUuid: input.accountUuid,
        kermaValue: 0,
        kermaLastUpdateTime: new Date(now),
        kermaForbidForever: false,
        colorToken: null,
        createTime: new Date(now),
        forbidFromChatUntil: new Date(now),
        showColorUntil: new Date(now),
      })
      .returning()
      .get();
  }

  byId(id: number): AccountRow | null {
    return this.db.select().from(account).where(eq(account.id, id)).get() ?? null;
  }

  hasHandle(id: number): boolean {
    const row = this.db
      .select({ usernameFolded: account.usernameFolded })
      .from(account)
      .where(eq(account.id, id))
      .get();
    return row !== undefined && row.usernameFolded !== null;
  }

  handleTaken(folded: string): boolean {
    return (
      this.db
        .select({ id: account.id })
        .from(account)
        .where(eq(account.usernameFolded, folded))
        .get() !== undefined
    );
  }

  createPasskeyAccount(
    input: { handle: string; accountUuid: string; accountDomain: string },
    now: number,
  ): AccountRow {
    return this.db
      .insert(account)
      .values({
        username: input.handle,
        usernameFolded: foldHandle(input.handle),
        email: '',
        nickname: input.handle,
        accountDomain: input.accountDomain,
        accountUuid: input.accountUuid,
        kermaValue: 0,
        kermaLastUpdateTime: new Date(now),
        kermaForbidForever: false,
        colorToken: null,
        createTime: new Date(now),
        forbidFromChatUntil: new Date(now),
        showColorUntil: new Date(now),
      })
      .returning()
      .get();
  }

  claimHandle(id: number | null, raw: string): AccountRow {
    if (id === null) {
      throw new HandleError('NOT_LOGIN');
    }
    const current = this.byId(id);
    if (current === null) {
      throw new HandleError('NOT_LOGIN');
    }
    if (current.username !== null) {
      throw new HandleError('HANDLE_ALREADY_SET');
    }
    const handle = raw.trim();
    if (!isValidHandle(handle)) {
      throw new HandleError('INVALID_HANDLE');
    }
    if (isReservedHandle(handle)) {
      throw new HandleError('HANDLE_RESERVED');
    }
    const folded = foldHandle(handle);
    if (this.handleTaken(folded)) {
      throw new HandleError('HANDLE_TAKEN');
    }
    this.db
      .update(account)
      .set({ username: handle, usernameFolded: folded })
      .where(eq(account.id, id))
      .run();
    return { ...current, username: handle };
  }
}

export class Sessions {
  constructor(private readonly db: Database) {}

  open(accountId: number, now: number): string {
    const id = randomUUID();
    this.db
      .insert(accountSession)
      .values({
        id,
        accountId,
        createdAt: new Date(now),
        expiresAt: new Date(now + SESSION_TTL_MS),
        lastSeen: new Date(now),
        revoked: false,
      })
      .run();
    return id;
  }

  resolve(id: string | undefined, now: number): number | null {
    if (id === undefined || id.length === 0) {
      return null;
    }
    const row = this.db.select().from(accountSession).where(eq(accountSession.id, id)).get();
    if (row === undefined || row.revoked || row.expiresAt.getTime() <= now) {
      return null;
    }
    this.db
      .update(accountSession)
      .set({ lastSeen: new Date(now) })
      .where(eq(accountSession.id, id))
      .run();
    return row.accountId;
  }

  revoke(id: string): void {
    this.db.update(accountSession).set({ revoked: true }).where(eq(accountSession.id, id)).run();
  }

  revokeAllFor(accountId: number): number {
    return this.db
      .update(accountSession)
      .set({ revoked: true })
      .where(and(eq(accountSession.accountId, accountId), eq(accountSession.revoked, false)))
      .returning({ id: accountSession.id })
      .all().length;
  }

  purgeExpired(now: number): number {
    return this.db
      .delete(accountSession)
      .where(lt(accountSession.expiresAt, new Date(now)))
      .returning({ id: accountSession.id })
      .all().length;
  }
}
