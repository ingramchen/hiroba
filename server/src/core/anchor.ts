import { foldHandle, type AnchorSquareView, type CoAnchorView } from '@hiroba/shared';
export type { AnchorSquareView, CoAnchorView };
import { and, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { account, anchorSquare, coAnchor } from '../db/schema.js';
import type { Squares } from './square.js';

export type AnchorErrorCode =
  | 'NOT_LOGIN'
  | 'SQUARE_LOCK_PUBLIC'
  | 'DUPLICATE_TOPIC'
  | 'NOT_ANCHOR_SQUARE'
  | 'NOT_ANCHOR'
  | 'NO_HANDLE'
  | 'NO_SUCH_ACCOUNT'
  | 'DUPLICATE_CO_ANCHOR';

export class AnchorError extends Error {
  constructor(readonly code: AnchorErrorCode) {
    super(code);
  }
}

export interface AnchorContext {
  anchor: AnchorSquareView | null;
  isAnchor: boolean;
  isAnchorable: boolean;
  coAnchors: CoAnchorView[];
}

export class Anchors {
  constructor(
    private readonly db: Database,
    private readonly squares: Squares,
  ) {}

  private requireHandle(accountId: number | null): number {
    if (accountId === null) {
      throw new AnchorError('NOT_LOGIN');
    }
    if (!this.hasHandle(accountId)) {
      throw new AnchorError('NO_HANDLE');
    }
    return accountId;
  }

  private hasHandle(accountId: number): boolean {
    const row = this.db
      .select({ usernameFolded: account.usernameFolded })
      .from(account)
      .where(eq(account.id, accountId))
      .get();
    return row !== undefined && row.usernameFolded !== null;
  }

  contextFor(topic: string, accountId: number | null, hasHandle: boolean): AnchorContext {
    const row = this.db
      .select({
        id: anchorSquare.id,
        anchorId: anchorSquare.anchorId,
        topic: anchorSquare.topic,
        sealed: anchorSquare.sealed,
        username: account.username,
      })
      .from(anchorSquare)
      .innerJoin(account, eq(anchorSquare.anchorId, account.id))
      .where(eq(anchorSquare.topic, topic))
      .get();
    if (row === undefined) {
      return { anchor: null, isAnchor: false, isAnchorable: false, coAnchors: [] };
    }
    const rows = this.db
      .select({
        accountId: coAnchor.accountId,
        username: account.username,
        accountDomain: account.accountDomain,
      })
      .from(coAnchor)
      .innerJoin(account, eq(coAnchor.accountId, account.id))
      .where(eq(coAnchor.anchorSquareId, row.id))
      .all();
    const permitted = hasHandle && accountId !== null;
    const isAnchor = permitted && row.anchorId === accountId;
    return {
      anchor: { topic: row.topic, anchorUsername: row.username ?? '', sealed: row.sealed },
      isAnchor,
      isAnchorable: isAnchor || (permitted && rows.some((co) => co.accountId === accountId)),
      coAnchors: rows.map((co) => ({
        username: co.username ?? '',
        accountDomain: co.accountDomain,
      })),
    };
  }

  find(topic: string): AnchorSquareView | null {
    const row = this.db
      .select({
        topic: anchorSquare.topic,
        sealed: anchorSquare.sealed,
        username: account.username,
      })
      .from(anchorSquare)
      .innerJoin(account, eq(anchorSquare.anchorId, account.id))
      .where(eq(anchorSquare.topic, topic))
      .get();
    if (row === undefined) {
      return null;
    }
    return { topic: row.topic, anchorUsername: row.username ?? '', sealed: row.sealed };
  }

  coAnchors(topic: string): CoAnchorView[] {
    const anchor = this.db
      .select({ id: anchorSquare.id })
      .from(anchorSquare)
      .where(eq(anchorSquare.topic, topic))
      .get();
    if (anchor === undefined) {
      return [];
    }
    return this.db
      .select({ username: account.username, accountDomain: account.accountDomain })
      .from(coAnchor)
      .innerJoin(account, eq(coAnchor.accountId, account.id))
      .where(eq(coAnchor.anchorSquareId, anchor.id))
      .all()
      .map((row) => ({ username: row.username ?? '', accountDomain: row.accountDomain }));
  }

  isAnchorable(topic: string, accountId: number | null): boolean {
    if (accountId === null || !this.hasHandle(accountId)) {
      return false;
    }
    const anchor = this.db
      .select({ id: anchorSquare.id, anchorId: anchorSquare.anchorId })
      .from(anchorSquare)
      .where(eq(anchorSquare.topic, topic))
      .get();
    if (anchor === undefined) {
      return false;
    }
    if (anchor.anchorId === accountId) {
      return true;
    }
    const co = this.db
      .select({ id: coAnchor.id })
      .from(coAnchor)
      .where(and(eq(coAnchor.anchorSquareId, anchor.id), eq(coAnchor.accountId, accountId)))
      .get();
    return co !== undefined;
  }

  isAnchor(topic: string, accountId: number | null): boolean {
    if (accountId === null || !this.hasHandle(accountId)) {
      return false;
    }
    const anchor = this.db
      .select({ anchorId: anchorSquare.anchorId })
      .from(anchorSquare)
      .where(eq(anchorSquare.topic, topic))
      .get();
    return anchor?.anchorId === accountId;
  }

  create(topic: string, accountId: number | null, now: number): void {
    const anchorId = this.requireHandle(accountId);
    if (this.squares.isLockPublic(topic, now)) {
      throw new AnchorError('SQUARE_LOCK_PUBLIC');
    }
    if (this.find(topic) !== null) {
      throw new AnchorError('DUPLICATE_TOPIC');
    }
    this.db
      .insert(anchorSquare)
      .values({ anchorId, topic, createTime: new Date(now), sealed: false })
      .run();
  }

  addCoAnchor(topic: string, accountId: number | null, username: string): CoAnchorView[] {
    this.requireHandle(accountId);
    const anchor = this.db
      .select({ id: anchorSquare.id, anchorId: anchorSquare.anchorId })
      .from(anchorSquare)
      .where(eq(anchorSquare.topic, topic))
      .get();
    if (anchor === undefined) {
      throw new AnchorError('NOT_ANCHOR_SQUARE');
    }
    if (anchor.anchorId !== accountId) {
      throw new AnchorError('NOT_ANCHOR');
    }
    const candidate = this.db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.usernameFolded, foldHandle(username.trim())))
      .get();
    if (candidate === undefined) {
      throw new AnchorError('NO_SUCH_ACCOUNT');
    }
    if (candidate.id === anchor.anchorId) {
      throw new AnchorError('DUPLICATE_CO_ANCHOR');
    }
    const already = this.db
      .select({ id: coAnchor.id })
      .from(coAnchor)
      .where(and(eq(coAnchor.anchorSquareId, anchor.id), eq(coAnchor.accountId, candidate.id)))
      .get();
    if (already !== undefined) {
      throw new AnchorError('DUPLICATE_CO_ANCHOR');
    }
    this.db.insert(coAnchor).values({ accountId: candidate.id, anchorSquareId: anchor.id }).run();
    return this.coAnchors(topic);
  }

  dismiss(topic: string, accountId: number | null): void {
    this.requireHandle(accountId);
    const anchor = this.db
      .select({ id: anchorSquare.id, anchorId: anchorSquare.anchorId })
      .from(anchorSquare)
      .where(eq(anchorSquare.topic, topic))
      .get();
    if (anchor === undefined) {
      throw new AnchorError('NOT_ANCHOR_SQUARE');
    }
    if (anchor.anchorId !== accountId) {
      throw new AnchorError('NOT_ANCHOR');
    }
    this.db.delete(coAnchor).where(eq(coAnchor.anchorSquareId, anchor.id)).run();
    this.db.delete(anchorSquare).where(eq(anchorSquare.id, anchor.id)).run();
  }
}
