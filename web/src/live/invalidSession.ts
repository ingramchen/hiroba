export interface SessionIdentity {
  logined: boolean;
  myAnonymousId: string | null;
  storedAnonymousId: string | null;
  sessionIpsHash: string;
  storedIpsHash: string | null;
}

export function isInvalidAnonymous(state: SessionIdentity): boolean {
  if (state.logined || state.myAnonymousId === null) {
    return false;
  }
  return state.myAnonymousId !== state.storedAnonymousId;
}

export function isInvalidIps(state: SessionIdentity): boolean {
  if (state.sessionIpsHash.length === 0) {
    return false;
  }
  return state.sessionIpsHash !== state.storedIpsHash;
}

export function isInvalidSession(state: SessionIdentity): boolean {
  return isInvalidAnonymous(state) || isInvalidIps(state);
}

export function isInvalidGrowSession(state: SessionIdentity): boolean {
  if (state.logined) {
    return false;
  }
  return isInvalidSession(state);
}

export function parseStoredIpsHash(raw: string | null): string | null {
  if (raw === null) {
    return null;
  }
  const hash = raw.split(':')[0] ?? '';
  return hash.length === 0 ? null : hash;
}
