import { randomBytes, timingSafeEqual } from 'node:crypto';

export interface DevLoginConfig {
  enabled: true;
  token: string;
}

export const DEV_LOGIN_ENV = 'DEV_LOGIN';
export const DEV_LOGIN_TOKEN_ENV = 'DEV_LOGIN_TOKEN';
export const DEV_LOGIN_TOKEN_HEADER = 'x-dev-login-token';
export const DEV_LOGIN_TOKEN_COOKIE = 'hiroba.devtoken';
export const DEV_LOGIN_TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;
export const DEV_LOGIN_ATTEMPT_WINDOW_MS = 60_000;
export const DEV_LOGIN_ATTEMPTS_PER_CLIENT = 10;
export const DEV_LOGIN_ATTEMPTS_GLOBAL = 60;
export const DEV_ACCOUNT_PREFIX = 'dev:';

export function devLoginRequested(env: Record<string, string | undefined>): boolean {
  return env[DEV_LOGIN_ENV] === '1';
}

export function readDevLoginConfig(env: Record<string, string | undefined>): DevLoginConfig | null {
  if (!devLoginRequested(env) || env['NODE_ENV'] === 'production') {
    return null;
  }
  const configured = (env[DEV_LOGIN_TOKEN_ENV] ?? '').trim();
  return {
    enabled: true,
    token: configured.length > 0 ? configured : randomBytes(24).toString('hex'),
  };
}

export function tokenMatches(expected: string, given: unknown): boolean {
  if (typeof given !== 'string') {
    return false;
  }
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(given, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isLoopbackAddress(address: string): boolean {
  const plain = address
    .trim()
    .replace(/^\[|\]$/gu, '')
    .toLowerCase();
  const bare = plain.split('%')[0] ?? plain;
  if (bare === '::1') {
    return true;
  }
  const mapped = /^::ffff:(.+)$/u.exec(bare);
  const v4 = parseIpv4(mapped === null ? bare : (mapped[1] as string));
  return v4 !== null && v4[0] === 127;
}

export function isPlainLoopbackClient(remote: string, forwardedFor: string | undefined): boolean {
  return isLoopbackAddress(remote) && (forwardedFor ?? '').trim().length === 0;
}

function parseIpv4(value: string): number[] | null {
  const parts = value.split('.');
  if (parts.length !== 4) {
    return null;
  }
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/u.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet > 255) {
      return null;
    }
    octets.push(octet);
  }
  return octets;
}

function isLocalIpv4(octets: number[]): boolean {
  const [a, b] = octets as [number, number, number, number];
  if (a === 127 || a === 10) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  return a === 192 && b === 168;
}

export function isLocalAddress(address: string): boolean {
  const plain = address
    .trim()
    .replace(/^\[|\]$/gu, '')
    .toLowerCase();
  if (plain.length === 0) {
    return false;
  }
  const asV4 = parseIpv4(plain);
  if (asV4 !== null) {
    return isLocalIpv4(asV4);
  }
  const bare = plain.split('%')[0] ?? plain;
  if (bare === '::1') {
    return true;
  }
  const mapped = /^::ffff:(.+)$/u.exec(bare);
  if (mapped !== null) {
    const inner = parseIpv4(mapped[1] as string);
    return inner !== null && isLocalIpv4(inner);
  }
  const head = bare.split(':')[0] ?? '';
  const group = Number.parseInt(head, 16);
  if (head.length === 0 || Number.isNaN(group)) {
    return false;
  }
  return (group & 0xfe00) === 0xfc00 || (group & 0xffc0) === 0xfe80;
}

export function isLocalClient(remote: string, forwardedFor: string | undefined): boolean {
  if (!isLocalAddress(remote)) {
    return false;
  }
  return (forwardedFor ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .every(isLocalAddress);
}

export function isJsonRequest(contentType: string | undefined): boolean {
  return (contentType ?? '').split(';')[0]?.trim().toLowerCase() === 'application/json';
}

export function devAccountUuid(domain: string, subject: string): string {
  return `${domain}:${DEV_ACCOUNT_PREFIX}${subject}`;
}

export function warnDevLoginIgnored(): void {
  console.warn(
    `*** ${DEV_LOGIN_ENV}=1 is ignored under NODE_ENV=production; /api/dev/login stays closed. ***`,
  );
}

export function warnDevLoginEnabled(config: DevLoginConfig): void {
  console.warn(
    `*** DEV_LOGIN=1: /api/dev/login will mint an account session for any local caller. Never enable this on a public deployment. ***\n` +
      `*** Callers that are not plain loopback must present the dev login token: open /api/dev/login?token=${config.token} once in the browser (or set ${DEV_LOGIN_TOKEN_ENV} to choose it). ***`,
  );
}
