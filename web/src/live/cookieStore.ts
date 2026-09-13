export const COOKIE_YEARS = 20;

export function localStorageUsable(): boolean {
  try {
    const probe = '__storage_test';
    window.localStorage.setItem(probe, 'foo');
    if (window.localStorage.getItem(probe) !== 'foo') {
      return false;
    }
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function readCookie(key: string, jar: string): string | null {
  const prefix = encodeURIComponent(key) + '=';
  for (const part of jar.split(';')) {
    const entry = part.trim();
    if (entry.startsWith(prefix)) {
      return decodeURIComponent(entry.slice(prefix.length));
    }
  }
  return null;
}

export function cookieExpiry(now: number): string {
  const at = new Date(now);
  at.setFullYear(at.getFullYear() + COOKIE_YEARS);
  return at.toUTCString();
}

export const COOKIE_MAX_BYTES = 4096;

export function writeCookieValue(key: string, value: string, now: number): string {
  return (
    encodeURIComponent(key) +
    '=' +
    encodeURIComponent(value) +
    '; expires=' +
    cookieExpiry(now) +
    '; path=/; SameSite=Lax'
  );
}

export function cookieFits(key: string, value: string): boolean {
  return (encodeURIComponent(key) + '=' + encodeURIComponent(value)).length <= COOKIE_MAX_BYTES;
}

export function cookieNames(jar: string): string[] {
  const names: string[] = [];
  for (const part of jar.split(';')) {
    const entry = part.trim();
    const at = entry.indexOf('=');
    if (at > 0) {
      names.push(decodeURIComponent(entry.slice(0, at)));
    }
  }
  return names;
}

export function dropCookieValue(key: string): string {
  return encodeURIComponent(key) + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

export function cookieRead(key: string): string | null {
  try {
    return readCookie(key, document.cookie);
  } catch {
    return null;
  }
}

export function cookieWrite(key: string, value: string): void {
  if (!cookieFits(key, value)) {
    return;
  }
  try {
    document.cookie = writeCookieValue(key, value, Date.now());
  } catch {
    /* cookies unavailable */
  }
}

export function cookieKeys(): string[] {
  try {
    return cookieNames(document.cookie);
  } catch {
    return [];
  }
}

export function cookieDrop(key: string): void {
  try {
    document.cookie = dropCookieValue(key);
  } catch {
    /* cookies unavailable */
  }
}
