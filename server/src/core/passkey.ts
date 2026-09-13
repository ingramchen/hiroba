import { isIpLiteral, type PasskeyErrorCode } from '@hiroba/shared';
import { toHash } from '@simplewebauthn/server/helpers';
import { eq, lt } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { passkey, passkeyChallenge } from '../db/schema.js';

export const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const PASSKEY_TIMEOUT_MS = 60_000;
export const PASSKEY_WINDOW_MS = 10 * 60 * 1000;
export const PASSKEY_CLIENT_MAX = 60;
export const PASSKEY_GLOBAL_MAX = 600;

export type PasskeyChallengeKind = 'register' | 'login' | 'add';

export interface PasskeyChallengeRow {
  challenge: string;
  kind: string;
  accountId: number | null;
  handle: string | null;
  accountUuid: string | null;
  rpId: string;
  origin: string;
  createdAt: Date;
}

export interface PasskeyRow {
  credentialId: string;
  accountId: number;
  publicKey: Buffer;
  counter: number;
  transports: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export function rpIdFor(origin: string): string | null {
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return null;
  }
  if (host.length === 0 || isIpLiteral(host)) {
    return null;
  }
  return host.toLowerCase();
}

export class PasskeyChallenges {
  constructor(private readonly db: Database) {}

  put(row: {
    challenge: string;
    kind: PasskeyChallengeKind;
    accountId?: number;
    handle?: string;
    accountUuid?: string;
    rpId: string;
    origin: string;
    createdAt: number;
  }): void {
    this.db
      .insert(passkeyChallenge)
      .values({
        challenge: row.challenge,
        kind: row.kind,
        accountId: row.accountId ?? null,
        handle: row.handle ?? null,
        accountUuid: row.accountUuid ?? null,
        rpId: row.rpId,
        origin: row.origin,
        createdAt: new Date(row.createdAt),
      })
      .run();
  }

  take(challenge: string, kind: PasskeyChallengeKind, now: number): PasskeyChallengeRow | null {
    if (challenge.length === 0) {
      return null;
    }
    const row = this.db
      .select()
      .from(passkeyChallenge)
      .where(eq(passkeyChallenge.challenge, challenge))
      .get();
    if (row === undefined) {
      return null;
    }
    this.db.delete(passkeyChallenge).where(eq(passkeyChallenge.challenge, challenge)).run();
    if (row.kind !== kind || row.createdAt.getTime() + PASSKEY_CHALLENGE_TTL_MS <= now) {
      return null;
    }
    return row;
  }

  purgeExpired(cutoff: number): number {
    return this.db
      .delete(passkeyChallenge)
      .where(lt(passkeyChallenge.createdAt, new Date(cutoff)))
      .returning({ challenge: passkeyChallenge.challenge })
      .all().length;
  }
}

export class Passkeys {
  constructor(private readonly db: Database) {}

  byCredentialId(credentialId: string): PasskeyRow | null {
    return (
      this.db.select().from(passkey).where(eq(passkey.credentialId, credentialId)).get() ?? null
    );
  }

  byAccountId(accountId: number): PasskeyRow | null {
    return this.db.select().from(passkey).where(eq(passkey.accountId, accountId)).get() ?? null;
  }

  add(row: {
    credentialId: string;
    accountId: number;
    publicKey: Uint8Array;
    counter: number;
    transports: string[];
    createdAt: number;
  }): void {
    this.db
      .insert(passkey)
      .values({
        credentialId: row.credentialId,
        accountId: row.accountId,
        publicKey: Buffer.from(row.publicKey),
        counter: row.counter,
        transports: JSON.stringify(row.transports),
        createdAt: new Date(row.createdAt),
        lastUsedAt: null,
      })
      .run();
  }

  touch(credentialId: string, counter: number, now: number): void {
    this.db
      .update(passkey)
      .set({ counter, lastUsedAt: new Date(now) })
      .where(eq(passkey.credentialId, credentialId))
      .run();
  }
}

export class PasskeyError extends Error {
  constructor(readonly code: PasskeyErrorCode) {
    super(code);
  }
}

export async function passkeyUserId(accountUuid: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await toHash(new TextEncoder().encode(accountUuid)));
}

export function isCounterRegression(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('Response counter value');
}

const UNIQUE_CONSTRAINT_CODES = new Set([
  'SQLITE_CONSTRAINT_PRIMARYKEY',
  'SQLITE_CONSTRAINT_UNIQUE',
]);

export function isUniqueConstraint(error: unknown): boolean {
  return (
    error instanceof Error &&
    UNIQUE_CONSTRAINT_CODES.has(String((error as { code?: unknown }).code ?? ''))
  );
}
