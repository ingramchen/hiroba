import { timingSafeEqual } from 'node:crypto';
import type { ApiError, MessageEvent } from '@hiroba/shared';
import type { Context } from 'hono';
import { addressSlots, joinSlots, trustedAddress } from './ip.js';
import type { Permission } from './permission.js';
import type { Services } from './types.js';

export const SYSTEM_PUBLIC_ID = 'SYSTEM_PUBLIC_ID';
export const SYSTEM_NICKNAME = 'SYSTEM';

export class PermissionDenied extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function systemEvent(
  eventType: MessageEvent['eventType'],
  content: string,
  date: number,
  payload?: Record<string, unknown>,
): MessageEvent {
  const event: MessageEvent = {
    eventType,
    senderPublicId: SYSTEM_PUBLIC_ID,
    senderNickName: SYSTEM_NICKNAME,
    senderColorToken: null,
    anchorUsername: '',
    content,
    date,
  };
  if (payload !== undefined) {
    event.payload = payload;
  }
  return event;
}

declare module 'hono' {
  interface ContextVariableMap {
    remoteAddress: string;
  }
}

export type RemoteAddressSource = (c: Context) => string;

export const REMOTE_ADDRESS_VAR = 'remoteAddress';

export function remoteAddress(c: Context): string {
  return c.get(REMOTE_ADDRESS_VAR) ?? '';
}

export function clientIps(c: Context): string {
  return joinSlots(addressSlots(c.req.header('x-forwarded-for'), remoteAddress(c)));
}

export function clientAddress(c: Context): string {
  return trustedAddress(clientIps(c));
}

export function refuse(c: Context, code: string): Response {
  const body: ApiError = { error: code };
  return c.json(body, 200);
}

export function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

export function requirePermission(
  services: Services,
  permitId: unknown,
  topic: string,
  ips: string,
): Permission {
  const permission =
    typeof permitId === 'string' ? services.permissions.find(permitId, services.clock.now()) : null;
  if (permission === null || permission.topic !== topic) {
    throw new PermissionDenied('INVALID_SESSION');
  }
  if (permission.startIps !== ips) {
    throw new PermissionDenied('INVALID_SESSION');
  }
  return permission;
}

export function accountIdOf(services: Services, cookie: string | undefined): number | null {
  return services.sessions.resolve(cookie, services.clock.now());
}
