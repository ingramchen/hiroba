export const TRUST_PROXY_KEY = 'TRUST_PROXY';

export function readTrustProxy(env: Record<string, string | undefined>): number {
  const raw = env[TRUST_PROXY_KEY];
  if (raw === undefined || raw.trim().length === 0) {
    return 0;
  }
  const digits = raw.trim();
  if (!/^\d+$/.test(digits)) {
    throw new Error(`${TRUST_PROXY_KEY} is not a hop count: ${raw}`);
  }
  return Number(digits);
}

export function trustProxyHops(): number {
  try {
    return readTrustProxy(process.env);
  } catch {
    return 0;
  }
}

export function normalizeAddress(value: string): string {
  const trimmed = value.trim();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(trimmed);
  return mapped?.[1] ?? trimmed;
}

export function addressSlots(header: string | undefined, socketAddress: string): readonly string[] {
  const forwarded = (header ?? '')
    .split(',')
    .map((part) => normalizeAddress(part))
    .filter((part) => part.length > 0);
  return [...forwarded, normalizeAddress(socketAddress)];
}

export function joinSlots(slots: readonly string[]): string {
  return slots.join(',');
}

export function splitSlots(ips: string): readonly string[] {
  return ips.split(',');
}

export function chooseAddress(slots: readonly string[], hops: number): string {
  if (slots.length === 0) {
    return '';
  }
  const at = slots.length - 1 - hops;
  return (at < 0 ? slots[0] : slots[at]) ?? '';
}

export function trustedAddress(ips: string, hops = trustProxyHops()): string {
  return chooseAddress(splitSlots(ips), hops);
}

export type AddressKind = 'ipv4' | 'ipv6' | 'unknown';

export function addressKind(value: string): AddressKind {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value) && value.split('.').every((p) => Number(p) <= 255)) {
    return 'ipv4';
  }
  if (value.length > 0 && /^[0-9a-fA-F:.]+$/.test(value) && value.includes(':')) {
    return 'ipv6';
  }
  return 'unknown';
}
