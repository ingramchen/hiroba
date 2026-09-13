import {
  foldHandle,
  isReservedHandle,
  isValidHandle,
  type AuthenticationResponseJSON,
  type PasskeyErrorCode,
  type RegistrationResponseJSON,
} from '@hiroba/shared';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { decodeClientDataJSON, isoBase64URL } from '@simplewebauthn/server/helpers';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { HandleError, SESSION_COOKIE } from '../account.js';
import {
  DEV_LOGIN_ATTEMPT_WINDOW_MS,
  DEV_LOGIN_ATTEMPTS_GLOBAL,
  DEV_LOGIN_ATTEMPTS_PER_CLIENT,
  DEV_LOGIN_TOKEN_COOKIE,
  DEV_LOGIN_TOKEN_COOKIE_MAX_AGE,
  DEV_LOGIN_TOKEN_HEADER,
  devAccountUuid,
  isJsonRequest,
  isLocalClient,
  isPlainLoopbackClient,
  tokenMatches,
} from '../devLogin.js';
import { accountIdOf, clientAddress, refuse, remoteAddress, sameString } from '../http.js';
import { requestOrigin } from '../storage/routes.js';
import { OAUTH_COOKIE, OAUTH_STATE_TTL_MS, safeReturnTo } from '../oidc.js';
import {
  PASSKEY_CLIENT_MAX,
  PASSKEY_GLOBAL_MAX,
  PASSKEY_TIMEOUT_MS,
  PASSKEY_WINDOW_MS,
  PasskeyError,
  isCounterRegression,
  isUniqueConstraint,
  passkeyUserId,
  rpIdFor,
} from '../passkey.js';
import { ClientAndGlobalLimiter, RateLimiter, retryAfterSeconds } from '../rateLimit.js';
import type { Services } from '../types.js';

export const HANDLE_CLAIM_WINDOW_MS = 10 * 60 * 1000;
export const HANDLE_CLAIM_ACCOUNT_MAX = 20;
export const HANDLE_CLAIM_CLIENT_MAX = 30;
export const HANDLE_CLAIM_GLOBAL_MAX = 300;

export const ACCOUNT_DOMAIN_GOOGLE = 'GOOGLE';
export const ACCOUNT_DOMAIN_PASSKEY = 'PASSKEY';

export function registerAccountRoutes(app: Hono, services: Services): void {
  const devLogin = services.devLogin;

  const openSession = (c: Context, accountId: number, rememberMe: boolean): void => {
    const id = services.sessions.open(accountId, services.clock.now());
    setCookie(c, SESSION_COOKIE, id, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      ...(rememberMe ? { maxAge: 7 * 24 * 60 * 60 } : {}),
    });
  };

  app.get('/api/account', (c) => {
    const accountId = accountIdOf(services, getCookie(c, SESSION_COOKIE));
    const row = accountId === null ? null : services.accounts.byId(accountId);
    return c.json({
      google: services.oidc !== null,
      passkey: true,
      devLogin: devLogin !== null,
      account: row === null ? null : { username: row.username, nickname: row.nickname },
    });
  });

  if (devLogin !== null) {
    const attempts = new ClientAndGlobalLimiter(
      { windowMs: DEV_LOGIN_ATTEMPT_WINDOW_MS, max: DEV_LOGIN_ATTEMPTS_PER_CLIENT },
      { windowMs: DEV_LOGIN_ATTEMPT_WINDOW_MS, max: DEV_LOGIN_ATTEMPTS_GLOBAL },
    );
    const tooMany = (c: Context): Response | null => {
      const verdict = attempts.peek(clientAddress(c), services.clock.now());
      return verdict.allowed
        ? null
        : c.json({ error: 'TOO_MANY_ATTEMPTS' }, 429, {
            'retry-after': retryAfterSeconds(verdict),
          });
    };
    const refused = (c: Context, code = 'DEV_LOGIN_REFUSED'): Response => {
      attempts.hit(clientAddress(c), services.clock.now());
      return c.json({ error: code }, 403);
    };
    const tokenPresented = (c: Context, body: Record<string, unknown>): boolean =>
      tokenMatches(devLogin.token, c.req.header(DEV_LOGIN_TOKEN_HEADER)) ||
      tokenMatches(devLogin.token, body['token']) ||
      tokenMatches(devLogin.token, getCookie(c, DEV_LOGIN_TOKEN_COOKIE));

    app.get('/api/dev/login', (c) => {
      const limited = tooMany(c);
      if (limited !== null) {
        return limited;
      }
      if (
        !isLocalClient(remoteAddress(c), c.req.header('x-forwarded-for')) ||
        !tokenMatches(devLogin.token, c.req.query('token'))
      ) {
        return refused(c);
      }
      setCookie(c, DEV_LOGIN_TOKEN_COOKIE, devLogin.token, {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: DEV_LOGIN_TOKEN_COOKIE_MAX_AGE,
      });
      return c.redirect('/');
    });

    app.post('/api/dev/login', async (c) => {
      if (!isJsonRequest(c.req.header('content-type'))) {
        return c.json({ error: 'DEV_LOGIN_REFUSED' }, 415);
      }
      const limited = tooMany(c);
      if (limited !== null) {
        return limited;
      }
      const remote = remoteAddress(c);
      const forwarded = c.req.header('x-forwarded-for');
      if (!isLocalClient(remote, forwarded)) {
        return refused(c);
      }
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      if (!isPlainLoopbackClient(remote, forwarded) && !tokenPresented(c, body)) {
        return refused(c, 'DEV_LOGIN_TOKEN_REQUIRED');
      }
      const subject = (typeof body['subject'] === 'string' ? body['subject'] : '').trim();
      if (subject.length === 0 || subject.length > 64) {
        return c.json({ error: 'INVALID_SUBJECT' }, 400);
      }
      const now = services.clock.now();
      const row = services.accounts.findOrCreate(
        {
          email: `${subject}@dev.invalid`,
          nickname: typeof body['nickname'] === 'string' ? body['nickname'] : subject,
          accountDomain: ACCOUNT_DOMAIN_GOOGLE,
          accountUuid: devAccountUuid(ACCOUNT_DOMAIN_GOOGLE, subject),
        },
        now,
      );
      openSession(c, row.id, true);
      return c.json({ account: { username: row.username, nickname: row.nickname } });
    });
  }

  if (services.oidc !== null) {
    const oidc = services.oidc;

    app.get('/auth/google/start', (c) => {
      const returnTo = safeReturnTo(c.req.query('return_to'));
      const url = oidc.authorizationUrl(
        returnTo,
        services.clock.now(),
        c.req.query('remember') !== '0',
      );
      setCookie(c, OAUTH_COOKIE, new URL(url).searchParams.get('state') ?? '', {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/auth/google',
        maxAge: OAUTH_STATE_TTL_MS / 1000,
      });
      return c.redirect(url);
    });

    app.get('/auth/google/callback', async (c) => {
      const state = c.req.query('state') ?? '';
      const code = c.req.query('code') ?? '';
      const now = services.clock.now();
      const pending = oidc.takeState(state, now);
      const bound = getCookie(c, OAUTH_COOKIE) ?? '';
      if (pending === null || code.length === 0 || !sameString(bound, pending.state)) {
        return c.json({ error: 'INVALID_STATE' }, 400);
      }
      setCookie(c, OAUTH_COOKIE, '', {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/auth/google',
        maxAge: 0,
      });
      const carried = getCookie(c, SESSION_COOKIE);
      if (carried !== undefined) {
        services.sessions.revoke(carried);
      }
      try {
        const idToken = await oidc.exchange(code, pending.verifier);
        const identity = await oidc.verifyIdToken(idToken, pending.nonce, now);
        const row = services.accounts.findOrCreate(
          {
            email: identity.email,
            nickname: identity.name,
            accountDomain: ACCOUNT_DOMAIN_GOOGLE,
            accountUuid: `${ACCOUNT_DOMAIN_GOOGLE}:${identity.subject}`,
          },
          now,
        );
        openSession(c, row.id, pending.remember);
        return c.redirect(safeReturnTo(pending.returnTo));
      } catch {
        return c.json({ error: 'LOGIN_FAILED' }, 400);
      }
    });
  }

  const claimsByAccount = new RateLimiter({
    windowMs: HANDLE_CLAIM_WINDOW_MS,
    max: HANDLE_CLAIM_ACCOUNT_MAX,
  });
  const claimsByClient = new ClientAndGlobalLimiter(
    { windowMs: HANDLE_CLAIM_WINDOW_MS, max: HANDLE_CLAIM_CLIENT_MAX },
    { windowMs: HANDLE_CLAIM_WINDOW_MS, max: HANDLE_CLAIM_GLOBAL_MAX },
  );

  app.post('/api/account/handle', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const accountId = accountIdOf(services, getCookie(c, SESSION_COOKIE));
    if (accountId === null) {
      return c.json({ error: 'NOT_LOGIN' }, 401);
    }
    const now = services.clock.now();
    const byAccount = claimsByAccount.hit(String(accountId), now);
    const byClient = byAccount.allowed
      ? claimsByClient.hit(clientAddress(c), now)
      : { allowed: false, retryAfterMs: byAccount.retryAfterMs };
    if (!byAccount.allowed || !byClient.allowed) {
      return c.json({ error: 'TOO_MANY_ATTEMPTS' }, 429, {
        'retry-after': retryAfterSeconds(byAccount.allowed ? byClient : byAccount),
      });
    }
    try {
      const row = services.accounts.claimHandle(
        accountId,
        typeof body['handle'] === 'string' ? body['handle'] : '',
      );
      return c.json({ account: { username: row.username, nickname: row.nickname } });
    } catch (error) {
      if (error instanceof HandleError) {
        return error.code === 'NOT_LOGIN'
          ? c.json({ error: error.code }, 401)
          : refuse(c, error.code);
      }
      throw error;
    }
  });

  app.post('/api/account/logout', (c) => {
    const cookie = getCookie(c, SESSION_COOKIE);
    if (cookie !== undefined) {
      services.sessions.revoke(cookie);
    }
    setCookie(c, SESSION_COOKIE, '', { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 0 });
    return c.json({ ok: true });
  });

  app.post('/api/account/logout-everywhere', (c) => {
    const accountId = accountIdOf(services, getCookie(c, SESSION_COOKIE));
    if (accountId === null) {
      return c.json({ error: 'NOT_LOGIN' }, 401);
    }
    const revoked = services.sessions.revokeAllFor(accountId);
    setCookie(c, SESSION_COOKIE, '', { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 0 });
    return c.json({ ok: true, revoked });
  });

  const passkeyAttempts = new ClientAndGlobalLimiter(
    { windowMs: PASSKEY_WINDOW_MS, max: PASSKEY_CLIENT_MAX },
    { windowMs: PASSKEY_WINDOW_MS, max: PASSKEY_GLOBAL_MAX },
  );

  const passkeyJsonGate = (c: Context): Response | null =>
    isJsonRequest(c.req.header('content-type')) ? null : c.json({ error: 'PASSKEY_REFUSED' }, 415);

  const passkeyTooMany = (c: Context): Response | null => {
    const verdict = passkeyAttempts.peek(clientAddress(c), services.clock.now());
    return verdict.allowed
      ? null
      : c.json({ error: 'TOO_MANY_ATTEMPTS' }, 429, { 'retry-after': retryAfterSeconds(verdict) });
  };

  const passkeyHit = (c: Context): void => {
    passkeyAttempts.hit(clientAddress(c), services.clock.now());
  };

  const passkeyScope = (c: Context): { rpId: string; origin: string } | null => {
    const origin = requestOrigin(c);
    const rpId = rpIdFor(origin);
    return rpId === null ? null : { rpId, origin };
  };

  const passkeyDenied = (
    c: Context,
    route: string,
    code: PasskeyErrorCode,
    detail: { credential?: string; accountId?: number } = {},
  ): Response => {
    passkeyHit(c);
    console.warn(
      JSON.stringify({
        level: 'warn',
        msg: 'passkey refused',
        route,
        code,
        rpId: rpIdFor(requestOrigin(c)),
        origin: requestOrigin(c),
        client: clientAddress(c),
        ...(detail.credential === undefined ? {} : { credential: detail.credential.slice(0, 8) }),
        ...(detail.accountId === undefined ? {} : { accountId: detail.accountId }),
      }),
    );
    return c.json({ error: code }, 400);
  };

  const passkeyBody = async (c: Context): Promise<Record<string, unknown>> =>
    (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  app.post('/api/passkey/register/options', async (c) => {
    const gate = passkeyJsonGate(c);
    if (gate !== null) {
      return gate;
    }
    const limited = passkeyTooMany(c);
    if (limited !== null) {
      return limited;
    }
    passkeyHit(c);
    const scope = passkeyScope(c);
    if (scope === null) {
      return refuse(c, 'PASSKEY_UNAVAILABLE');
    }
    const body = await passkeyBody(c);
    const handle = (typeof body['handle'] === 'string' ? body['handle'] : '').trim();
    if (!isValidHandle(handle)) {
      return refuse(c, 'INVALID_HANDLE');
    }
    if (isReservedHandle(handle)) {
      return refuse(c, 'HANDLE_RESERVED');
    }
    if (services.accounts.handleTaken(foldHandle(handle))) {
      return refuse(c, 'HANDLE_TAKEN');
    }
    const accountUuid = `${ACCOUNT_DOMAIN_PASSKEY}:${crypto.randomUUID()}`;
    const options = await generateRegistrationOptions({
      rpName: scope.rpId,
      rpID: scope.rpId,
      userName: handle,
      userDisplayName: handle,
      userID: await passkeyUserId(accountUuid),
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
      timeout: PASSKEY_TIMEOUT_MS,
    });
    services.passkeyChallenges.put({
      challenge: options.challenge,
      kind: 'register',
      handle,
      accountUuid,
      rpId: scope.rpId,
      origin: scope.origin,
      createdAt: services.clock.now(),
    });
    return c.json({ options });
  });

  app.post('/api/passkey/register/verify', async (c) => {
    const gate = passkeyJsonGate(c);
    if (gate !== null) {
      return gate;
    }
    const limited = passkeyTooMany(c);
    if (limited !== null) {
      return limited;
    }
    const body = await passkeyBody(c);
    const response = body['response'] as RegistrationResponseJSON | undefined;
    const now = services.clock.now();
    let challenge: string;
    try {
      const clientData = decodeClientDataJSON(response!.response.clientDataJSON);
      if (typeof clientData.challenge !== 'string') {
        throw new Error('NO_CHALLENGE');
      }
      challenge = clientData.challenge;
    } catch {
      return passkeyDenied(c, 'register/verify', 'VERIFY_FAILED');
    }
    const pending = services.passkeyChallenges.take(challenge, 'register', now);
    if (pending === null || pending.handle === null || pending.accountUuid === null) {
      return passkeyDenied(c, 'register/verify', 'CHALLENGE_EXPIRED');
    }
    let credential;
    try {
      const verification = await verifyRegistrationResponse({
        response: response!,
        expectedChallenge: pending.challenge,
        expectedOrigin: pending.origin,
        expectedRPID: pending.rpId,
        requireUserVerification: false,
      });
      if (!verification.verified || verification.registrationInfo === undefined) {
        return passkeyDenied(c, 'register/verify', 'VERIFY_FAILED');
      }
      credential = verification.registrationInfo.credential;
    } catch {
      return passkeyDenied(c, 'register/verify', 'VERIFY_FAILED');
    }
    const handle = pending.handle;
    const accountUuid = pending.accountUuid;
    let row;
    try {
      row = services.db.transaction(() => {
        if (services.accounts.handleTaken(foldHandle(handle))) {
          throw new PasskeyError('HANDLE_TAKEN');
        }
        if (services.passkeys.byCredentialId(credential.id) !== null) {
          throw new PasskeyError('CREDENTIAL_EXISTS');
        }
        const created = services.accounts.createPasskeyAccount(
          { handle, accountUuid, accountDomain: ACCOUNT_DOMAIN_PASSKEY },
          now,
        );
        if (services.passkeys.byAccountId(created.id) !== null) {
          throw new PasskeyError('CREDENTIAL_EXISTS');
        }
        services.passkeys.add({
          credentialId: credential.id,
          accountId: created.id,
          publicKey: credential.publicKey,
          counter: credential.counter,
          transports: credential.transports ?? [],
          createdAt: now,
        });
        return created;
      });
    } catch (error) {
      if (!(error instanceof PasskeyError) && !isUniqueConstraint(error)) {
        throw error;
      }
      const code = error instanceof PasskeyError ? error.code : 'CREDENTIAL_EXISTS';
      if (code === 'HANDLE_TAKEN') {
        passkeyHit(c);
        return refuse(c, code);
      }
      return passkeyDenied(c, 'register/verify', code, { credential: credential.id });
    }
    const carried = getCookie(c, SESSION_COOKIE);
    if (carried !== undefined) {
      services.sessions.revoke(carried);
    }
    openSession(c, row.id, body['rememberMe'] !== false);
    return c.json({ account: { username: row.username, nickname: row.nickname } });
  });

  app.post('/api/passkey/login/options', async (c) => {
    const gate = passkeyJsonGate(c);
    if (gate !== null) {
      return gate;
    }
    const limited = passkeyTooMany(c);
    if (limited !== null) {
      return limited;
    }
    passkeyHit(c);
    const scope = passkeyScope(c);
    if (scope === null) {
      return refuse(c, 'PASSKEY_UNAVAILABLE');
    }
    const options = await generateAuthenticationOptions({
      rpID: scope.rpId,
      userVerification: 'preferred',
      timeout: PASSKEY_TIMEOUT_MS,
    });
    services.passkeyChallenges.put({
      challenge: options.challenge,
      kind: 'login',
      rpId: scope.rpId,
      origin: scope.origin,
      createdAt: services.clock.now(),
    });
    return c.json({ options });
  });

  app.post('/api/passkey/login/verify', async (c) => {
    const gate = passkeyJsonGate(c);
    if (gate !== null) {
      return gate;
    }
    const limited = passkeyTooMany(c);
    if (limited !== null) {
      return limited;
    }
    const body = await passkeyBody(c);
    const response = body['response'] as AuthenticationResponseJSON | undefined;
    const now = services.clock.now();
    let challenge: string;
    try {
      const clientData = decodeClientDataJSON(response!.response.clientDataJSON);
      if (typeof clientData.challenge !== 'string') {
        throw new Error('NO_CHALLENGE');
      }
      challenge = clientData.challenge;
    } catch {
      return passkeyDenied(c, 'login/verify', 'VERIFY_FAILED');
    }
    const pending = services.passkeyChallenges.take(challenge, 'login', now);
    if (pending === null) {
      return passkeyDenied(c, 'login/verify', 'CHALLENGE_EXPIRED');
    }
    const stored = services.passkeys.byCredentialId(response!.id);
    if (stored === null) {
      return passkeyDenied(c, 'login/verify', 'UNKNOWN_CREDENTIAL', { credential: response!.id });
    }
    const row = services.accounts.byId(stored.accountId);
    if (row === null) {
      return passkeyDenied(c, 'login/verify', 'UNKNOWN_CREDENTIAL', { credential: response!.id });
    }
    const expectedUserHandle = isoBase64URL.fromBuffer(await passkeyUserId(row.accountUuid));
    if (response!.response.userHandle !== expectedUserHandle) {
      return passkeyDenied(c, 'login/verify', 'UNKNOWN_CREDENTIAL', {
        credential: response!.id,
        accountId: row.id,
      });
    }
    let newCounter: number;
    try {
      const verification = await verifyAuthenticationResponse({
        response: response!,
        expectedChallenge: pending.challenge,
        expectedOrigin: pending.origin,
        expectedRPID: pending.rpId,
        credential: {
          id: stored.credentialId,
          publicKey: new Uint8Array(stored.publicKey),
          counter: stored.counter,
          transports: JSON.parse(stored.transports) as never,
        },
        requireUserVerification: false,
      });
      if (!verification.verified) {
        return passkeyDenied(c, 'login/verify', 'VERIFY_FAILED', { credential: response!.id });
      }
      newCounter = verification.authenticationInfo.newCounter;
    } catch (error) {
      return passkeyDenied(
        c,
        'login/verify',
        isCounterRegression(error) ? 'COUNTER_REGRESSION' : 'VERIFY_FAILED',
        { credential: response!.id, accountId: row.id },
      );
    }
    services.passkeys.touch(stored.credentialId, newCounter, now);
    const carried = getCookie(c, SESSION_COOKIE);
    if (carried !== undefined) {
      services.sessions.revoke(carried);
    }
    openSession(c, row.id, body['rememberMe'] !== false);
    return c.json({ account: { username: row.username, nickname: row.nickname } });
  });
}
