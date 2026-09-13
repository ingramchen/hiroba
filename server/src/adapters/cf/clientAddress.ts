import type { Context } from 'hono';
import { addressSlots, joinSlots } from '../../core/ip.js';
import type { RemoteAddressSource } from '../../core/http.js';

export const CLIENT_ADDRESS_HEADER = 'x-hiroba-client-address';
export const TOPIC_HEADER = 'x-hiroba-topic';

export function edgeHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);
  headers.delete('x-forwarded-for');
  headers.set(CLIENT_ADDRESS_HEADER, request.headers.get('cf-connecting-ip') ?? '');
  return headers;
}

export function forward(request: Request, headers: Headers): Request {
  return new Request(request, { headers });
}

export const cfRemoteAddress: RemoteAddressSource = (c: Context) =>
  c.req.header(CLIENT_ADDRESS_HEADER) ?? '';

export function clientIpsOf(request: Request): string {
  return joinSlots(
    addressSlots(
      request.headers.get('x-forwarded-for') ?? undefined,
      request.headers.get(CLIENT_ADDRESS_HEADER) ?? '',
    ),
  );
}
