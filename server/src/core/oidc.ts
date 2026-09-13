import { createHash, createPublicKey, createVerify, randomBytes, randomUUID } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { oauthState } from '../db/schema.js';

export const OAUTH_COOKIE = 'hiroba.oauth';
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function safeReturnTo(raw: string | undefined): string {
  const value = raw ?? '';
  if (!/^\/(?![/\\])[\x21-\x7e\u0080-\uffff]*$/u.test(value)) {
    return '/';
  }
  if (value.includes('\\') || /%2f|%5c/iu.test(value)) {
    return '/';
  }
  return value;
}

export interface OidcConfig {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OidcIdentity {
  subject: string;
  email: string;
  name: string;
}

type Fetcher = typeof fetch;

interface Jwk {
  kid?: string;
  kty?: string;
  n?: string;
  e?: string;
  alg?: string;
}

export function readOidcConfig(env: Record<string, string | undefined>): OidcConfig | null {
  const clientId = env['GOOGLE_CLIENT_ID'];
  const clientSecret = env['GOOGLE_CLIENT_SECRET'];
  const publicOrigin = env['PUBLIC_ORIGIN'];
  if (
    clientId === undefined ||
    clientSecret === undefined ||
    publicOrigin === undefined ||
    clientId.trim().length === 0 ||
    clientSecret.trim().length === 0 ||
    publicOrigin.trim().length === 0
  ) {
    return null;
  }
  const issuer = env['OIDC_ISSUER'] ?? 'https://accounts.google.com';
  return {
    issuer,
    authorizationEndpoint:
      env['OIDC_AUTHORIZATION_ENDPOINT'] ?? 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: env['OIDC_TOKEN_ENDPOINT'] ?? 'https://oauth2.googleapis.com/token',
    jwksUri: env['OIDC_JWKS_URI'] ?? 'https://www.googleapis.com/oauth2/v3/certs',
    clientId,
    clientSecret,
    redirectUri: `${publicOrigin.replace(/\/$/u, '')}/auth/google/callback`,
  };
}

function base64url(input: Buffer): string {
  return input.toString('base64url');
}

export class OidcClient {
  constructor(
    private readonly db: Database,
    readonly config: OidcConfig,
    private readonly fetcher: Fetcher = fetch,
  ) {}

  authorizationUrl(returnTo: string, now: number, remember = true): string {
    const state = base64url(randomBytes(24));
    const nonce = base64url(randomBytes(24));
    const verifier = base64url(randomBytes(32));
    this.db
      .insert(oauthState)
      .values({
        state,
        nonce,
        verifier,
        returnTo: safeReturnTo(returnTo),
        remember,
        createdAt: new Date(now),
      })
      .run();
    const challenge = base64url(createHash('sha256').update(verifier).digest());
    const url = new URL(this.config.authorizationEndpoint);
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  takeState(
    state: string,
    now: number,
  ): {
    state: string;
    nonce: string;
    verifier: string;
    returnTo: string;
    remember: boolean;
  } | null {
    if (state.length === 0) {
      return null;
    }
    const row = this.db.select().from(oauthState).where(eq(oauthState.state, state)).get();
    if (row === undefined) {
      return null;
    }
    this.db.delete(oauthState).where(eq(oauthState.state, state)).run();
    if (row.createdAt.getTime() + OAUTH_STATE_TTL_MS <= now) {
      return null;
    }
    return {
      state: row.state,
      nonce: row.nonce,
      verifier: row.verifier,
      returnTo: row.returnTo,
      remember: row.remember,
    };
  }

  purgeStates(cutoff: number): number {
    return this.db
      .delete(oauthState)
      .where(lt(oauthState.createdAt, new Date(cutoff)))
      .returning({ state: oauthState.state })
      .all().length;
  }

  async exchange(code: string, verifier: string): Promise<string> {
    const response = await this.fetcher(this.config.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }).toString(),
    });
    if (!response.ok) {
      throw new Error('TOKEN_EXCHANGE_FAILED');
    }
    const body = (await response.json()) as { id_token?: string };
    if (typeof body.id_token !== 'string') {
      throw new Error('NO_ID_TOKEN');
    }
    return body.id_token;
  }

  async verifyIdToken(idToken: string, nonce: string, now: number): Promise<OidcIdentity> {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('MALFORMED_ID_TOKEN');
    }
    const [rawHeader, rawPayload, rawSignature] = parts as [string, string, string];
    const header = JSON.parse(Buffer.from(rawHeader, 'base64url').toString('utf8')) as {
      kid?: string;
      alg?: string;
    };
    if (header.alg !== 'RS256') {
      throw new Error('UNSUPPORTED_ALG');
    }
    const key = await this.findKey(header.kid);
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${rawHeader}.${rawPayload}`);
    const publicKey = createPublicKey({ key: key as never, format: 'jwk' });
    if (!verifier.verify(publicKey, Buffer.from(rawSignature, 'base64url'))) {
      throw new Error('BAD_SIGNATURE');
    }
    const claims = JSON.parse(Buffer.from(rawPayload, 'base64url').toString('utf8')) as {
      iss?: string;
      aud?: string | string[];
      sub?: string;
      exp?: number;
      nonce?: string;
      email?: string;
      name?: string;
      email_verified?: boolean;
    };
    if (claims.iss !== this.config.issuer) {
      throw new Error('BAD_ISSUER');
    }
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(this.config.clientId)) {
      throw new Error('BAD_AUDIENCE');
    }
    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now) {
      throw new Error('EXPIRED');
    }
    if (claims.nonce !== nonce) {
      throw new Error('BAD_NONCE');
    }
    if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
      throw new Error('NO_SUBJECT');
    }
    if (typeof claims.email !== 'string' || claims.email_verified !== true) {
      throw new Error('NO_VERIFIED_EMAIL');
    }
    return { subject: claims.sub, email: claims.email, name: claims.name ?? '' };
  }

  private async findKey(kid: string | undefined): Promise<Jwk> {
    const response = await this.fetcher(this.config.jwksUri);
    if (!response.ok) {
      throw new Error('JWKS_FETCH_FAILED');
    }
    const body = (await response.json()) as { keys?: Jwk[] };
    const keys = body.keys ?? [];
    const found = kid === undefined ? keys[0] : keys.find((key) => key.kid === kid);
    if (found === undefined) {
      throw new Error('NO_SUCH_KEY');
    }
    return found;
  }
}

export function newSessionId(): string {
  return randomUUID();
}
