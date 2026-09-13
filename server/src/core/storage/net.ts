export class RemoteFetchError extends Error {}

export interface HostPolicy {
  allowHosts: readonly string[];
  allowAnyPort?: boolean;
}

export interface FetchLimits {
  maxBytes: number;
  timeoutMs: number;
  maxRedirects: number;
}

export interface FetchedResource {
  body: Uint8Array;
  contentType: string | null;
  url: string;
}

export const DEFAULT_FETCH_LIMITS: FetchLimits = {
  maxBytes: 5 * 1024 * 1024,
  timeoutMs: 20_000,
  maxRedirects: 3,
};

export function normaliseHost(host: string): string {
  return host.replace(/^\[|\]$/gu, '').toLowerCase();
}

export function isHostAllowed(host: string, policy: HostPolicy): boolean {
  const target = normaliseHost(host);
  for (const raw of policy.allowHosts) {
    const entry = normaliseHost(raw.trim());
    if (entry.length === 0) {
      continue;
    }
    if (entry === '*') {
      return true;
    }
    if (target === entry || target.endsWith(`.${entry}`)) {
      return true;
    }
  }
  return false;
}

export function policyAllowsAnyHost(policy: HostPolicy): boolean {
  for (const raw of policy.allowHosts) {
    if (normaliseHost(raw.trim()) === '*') {
      return true;
    }
  }
  return false;
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

function isBlockedIpv4(octets: number[]): boolean {
  const [a, b] = octets as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 0) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 198 && (b === 18 || b === 19)) {
    return true;
  }
  return a >= 224;
}

export function isBlockedAddress(address: string): boolean {
  const plain = normaliseHost(address);
  const asV4 = parseIpv4(plain);
  if (asV4 !== null) {
    return isBlockedIpv4(asV4);
  }
  const lower = plain.split('%')[0] ?? plain;
  if (lower === '::' || lower === '::1') {
    return true;
  }
  const mapped = /^::ffff:(.+)$/u.exec(lower);
  if (mapped !== null) {
    const inner = parseIpv4(mapped[1] as string);
    return inner === null ? true : isBlockedIpv4(inner);
  }
  const head = lower.split(':')[0] ?? '';
  if (head.length === 0) {
    return true;
  }
  const group = Number.parseInt(head, 16);
  if (Number.isNaN(group)) {
    return true;
  }
  if ((group & 0xfe00) === 0xfc00) {
    return true;
  }
  if ((group & 0xffc0) === 0xfe80) {
    return true;
  }
  return (group & 0xff00) === 0xff00;
}

export interface ResolvedAddress {
  address: string;
  family: number;
}

export type AddressResolver = (host: string) => Promise<ResolvedAddress[]>;

export interface RawResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Uint8Array;
}

export type RemoteSend = (
  target: URL,
  pinned: ResolvedAddress | null,
  limits: FetchLimits,
) => Promise<RawResponse>;

export type RemoteTransport =
  | { canPinAddresses: true; resolve: AddressResolver; send: RemoteSend }
  | { canPinAddresses: false; send: RemoteSend };

export interface GuardOptions {
  policy: HostPolicy;
  transport: RemoteTransport;
  resolve?: AddressResolver;
  isBlocked?: (address: string) => boolean;
}

function literalAddress(host: string): ResolvedAddress | null {
  const literal = normaliseHost(host);
  if (parseIpv4(literal) !== null) {
    return { address: literal, family: 4 };
  }
  return literal.includes(':') ? { address: literal, family: 6 } : null;
}

async function vetTarget(target: URL, options: GuardOptions): Promise<ResolvedAddress | null> {
  const transport = options.transport;
  if (!transport.canPinAddresses && policyAllowsAnyHost(options.policy)) {
    throw new RemoteFetchError('refused');
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new RemoteFetchError('refused');
  }
  if (target.port.length > 0 && options.policy.allowAnyPort !== true) {
    throw new RemoteFetchError('refused');
  }
  if (!isHostAllowed(target.hostname, options.policy)) {
    throw new RemoteFetchError('refused');
  }
  const blocked = options.isBlocked ?? isBlockedAddress;
  const literal = literalAddress(target.hostname);
  if (literal !== null) {
    if (blocked(literal.address)) {
      throw new RemoteFetchError('refused');
    }
    return literal;
  }
  if (!transport.canPinAddresses) {
    return null;
  }
  const addresses = await (options.resolve ?? transport.resolve)(target.hostname).catch(() => {
    throw new RemoteFetchError('refused');
  });
  if (addresses.length === 0) {
    throw new RemoteFetchError('refused');
  }
  for (const entry of addresses) {
    if (blocked(entry.address)) {
      throw new RemoteFetchError('refused');
    }
  }
  return addresses[0] as ResolvedAddress;
}

export async function fetchGuarded(
  rawUrl: string,
  options: GuardOptions,
  limits: FetchLimits = DEFAULT_FETCH_LIMITS,
): Promise<FetchedResource> {
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new RemoteFetchError('refused');
  }
  for (let hop = 0; hop <= limits.maxRedirects; hop++) {
    const pinned = await vetTarget(target, options);
    const response = await options.transport.send(target, pinned, limits);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers['location'];
      const next = Array.isArray(location) ? location[0] : location;
      if (next === undefined) {
        throw new RemoteFetchError('refused');
      }
      try {
        target = new URL(next, target);
      } catch {
        throw new RemoteFetchError('refused');
      }
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new RemoteFetchError('refused');
    }
    const contentType = response.headers['content-type'];
    return {
      body: response.body,
      contentType: Array.isArray(contentType) ? (contentType[0] ?? null) : (contentType ?? null),
      url: target.toString(),
    };
  }
  throw new RemoteFetchError('refused');
}
