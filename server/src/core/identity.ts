import { createHash, createHmac, hkdfSync, randomUUID, timingSafeEqual } from 'node:crypto';
import type { ChatterAuth } from '@hiroba/shared';

export const TOKEN_TTL_MS = 120_000;
export const KEY_PURPOSES = ['chatter-public-id', 'chatter-ips-hash', 'chatter-token-mac'] as const;

export type KeyPurpose = (typeof KEY_PURPOSES)[number];

function deriveKey(secret: string, purpose: KeyPurpose): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, '', `hiroba/${purpose}`, 32));
}

const ANONYMOUS_PREFIX = 'ANONYMOUS_';
const ACCOUNT_PREFIX = 'ACCOUNT_';

interface TokenPayload {
  t: string;
  p: string;
  c: string | null;
  a: string;
  k: boolean;
  f: boolean;
  s: boolean;
  e: number;
}

function b64url(input: Buffer): string {
  return input.toString('base64url');
}

export function anonymousPrivateId(anonymousId: string): string {
  return ANONYMOUS_PREFIX + anonymousId;
}

export function accountPrivateId(accountUuid: string): string {
  return ACCOUNT_PREFIX + accountUuid;
}

export function newAnonymousId(): string {
  return randomUUID();
}

export function newColorToken(): string {
  return randomUUID().slice(0, 8);
}

export class Identities {
  private readonly publicIdSalt: Buffer;
  private readonly ipsHashSalt: Buffer;
  private readonly macKey: Buffer;

  constructor(tokenSecret: string) {
    if (tokenSecret.trim().length === 0) {
      throw new Error('TOKEN_SECRET is required');
    }
    this.publicIdSalt = deriveKey(tokenSecret, 'chatter-public-id');
    this.ipsHashSalt = deriveKey(tokenSecret, 'chatter-ips-hash');
    this.macKey = deriveKey(tokenSecret, 'chatter-token-mac');
  }

  derivedKeys(): Record<KeyPurpose, string> {
    return {
      'chatter-public-id': this.publicIdSalt.toString('hex'),
      'chatter-ips-hash': this.ipsHashSalt.toString('hex'),
      'chatter-token-mac': this.macKey.toString('hex'),
    };
  }

  publicId(privateId: string): string {
    return createHash('sha256')
      .update(privateId)
      .update(this.publicIdSalt)
      .digest('hex')
      .slice(0, 40);
  }

  ipsHash(topic: string, ips: string): string {
    return createHash('sha256')
      .update(`${topic} ${ips}`)
      .update(this.ipsHashSalt)
      .digest('hex')
      .slice(0, 40);
  }

  sign(auth: ChatterAuth, topic: string, now: number, ttlMs: number = TOKEN_TTL_MS): string {
    const payload: TokenPayload = {
      t: topic,
      p: auth.publicId,
      c: auth.colorToken,
      a: auth.anchorUsername,
      k: auth.kermaEnough,
      f: auth.chatFreeze,
      s: auth.anchorSquare,
      e: now + ttlMs,
    };
    const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
    return `${body}.${b64url(this.mac(body))}`;
  }

  verify(token: string, now: number, topic?: string): ChatterAuth | null {
    const dot = token.indexOf('.');
    if (dot <= 0) {
      return null;
    }
    const body = token.slice(0, dot);
    let given: Buffer;
    try {
      given = Buffer.from(token.slice(dot + 1), 'base64url');
    } catch {
      return null;
    }
    const expected = this.mac(body);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return null;
    }
    let payload: TokenPayload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    } catch {
      return null;
    }
    if (typeof payload.e !== 'number' || payload.e <= now) {
      return null;
    }
    if (topic !== undefined && (typeof payload.t !== 'string' || payload.t !== topic)) {
      return null;
    }
    return {
      publicId: payload.p,
      colorToken: payload.c,
      anchorUsername: payload.a,
      kermaEnough: payload.k,
      chatFreeze: payload.f,
      anchorSquare: payload.s === true,
    };
  }

  private mac(body: string): Buffer {
    return createHmac('sha256', this.macKey).update(body).digest();
  }
}
