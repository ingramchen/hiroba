import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { RemoteFetchError, fetchGuarded, type GuardOptions } from './net.js';
import { contentTypeForSuffix } from './imageType.js';
import type { WebLoaderCache } from './webloaderCache.js';

export const WEB_LOADER_PREFIX = '/load/';
// Per-fetch cap, enforced on the stream. Deliberately smaller than the memo budget: a fetch is
// held in memory, so this bounds one request rather than tuning throughput.
export const WEB_LOADER_MAX_BYTES = 1024 * 1024;
export const WEB_LOADER_TIMEOUT_MS = 20_000;
export const WEB_LOADER_CACHE_MS = 60 * 60 * 1000;
export const WEB_LOADER_CACHE_SIZE = 1000;
export const WEB_LOADER_MEMO_MAX_BYTES = 64 * 1024 * 1024;
export const WEB_LOADER_DISK_MAX_BYTES = 512 * 1024 * 1024;
export const WEB_LOADER_FETCHES_PER_CLIENT = 60;
export const WEB_LOADER_FETCHES_GLOBAL = 600;
export const WEB_LOADER_FETCH_WINDOW_MS = 60_000;

export function base64Url(raw: Buffer): string {
  return raw.toString('base64').replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

export function signWebLoaderUrl(key: string, remoteUrl: string): string {
  return base64Url(createHmac('sha1', key).update(remoteUrl, 'utf8').digest());
}

export function webLoaderPath(key: string, remoteUrl: string): string {
  return `${WEB_LOADER_PREFIX}${signWebLoaderUrl(key, remoteUrl)}/${remoteUrl}`;
}

export function splitSecurePath(securePath: string): { mac: string; remoteUrl: string } | null {
  const slash = securePath.indexOf('/');
  if (slash <= 0 || slash + 1 >= securePath.length) {
    return null;
  }
  return { mac: securePath.slice(0, slash), remoteUrl: securePath.slice(slash + 1) };
}

export function decodeBase64Url(value: string): Buffer | null {
  if (!/^[A-Za-z0-9\-_+/]*={0,2}$/u.test(value)) {
    return null;
  }
  const decoded = Buffer.from(value.replace(/-/gu, '+').replace(/_/gu, '/'), 'base64');
  return decoded.length === 0 ? null : decoded;
}

export function expandCollapsedScheme(remoteUrl: string): string | null {
  const match = /^(https?):\/(?!\/)/u.exec(remoteUrl);
  if (match === null) {
    return null;
  }
  return `${match[1] as string}://${remoteUrl.slice(match[0].length)}`;
}

function macMatches(key: string, remoteUrl: string, actual: Buffer): boolean {
  const expected = createHmac('sha1', key).update(remoteUrl, 'utf8').digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function verifyRemoteUrl(key: string, securePath: string): string | null {
  const split = splitSecurePath(securePath);
  if (split === null) {
    return null;
  }
  const actual = decodeBase64Url(split.mac);
  if (actual === null) {
    return null;
  }
  const expanded = expandCollapsedScheme(split.remoteUrl);
  for (const candidate of expanded === null ? [split.remoteUrl] : [split.remoteUrl, expanded]) {
    if (macMatches(key, candidate, actual)) {
      return candidate;
    }
  }
  return null;
}

export function cacheRelativePath(remoteUrl: string): string {
  const sha = createHash('sha1').update(remoteUrl, 'utf8').digest('hex');
  const suffix = /\.([A-Za-z0-9]{1,8})(?:$|[?#])/u.exec(remoteUrl)?.[1]?.toLowerCase() ?? 'bin';
  return `${sha.slice(0, 2)}/${sha}.${suffix}`;
}

export type LoadSource = 'memo' | 'disk' | 'network';

export interface ResolvedResource {
  remoteUrl: string;
  relative: string;
}

export interface LoadedResource {
  body: Uint8Array;
  contentType: string;
  source: LoadSource;
}

export interface WebLoaderOptions {
  key: string;
  guard: GuardOptions;
  cache: WebLoaderCache;
  memoMaxBytes?: number;
  now?: () => number;
}

export class WebLoaderRefused extends Error {}

interface MemoEntry {
  value: LoadedResource;
  at: number;
}

export class WebLoader {
  private readonly memo = new Map<string, MemoEntry>();
  private readonly now: () => number;
  private readonly memoMaxBytes: number;
  private memoBytes = 0;

  constructor(private readonly options: WebLoaderOptions) {
    this.now = options.now ?? Date.now;
    this.memoMaxBytes = options.memoMaxBytes ?? WEB_LOADER_MEMO_MAX_BYTES;
  }

  resolve(securePath: string): ResolvedResource {
    const remoteUrl = verifyRemoteUrl(this.options.key, securePath);
    if (remoteUrl === null) {
      throw new WebLoaderRefused('refused');
    }
    return { remoteUrl, relative: cacheRelativePath(remoteUrl) };
  }

  async loadCached(securePath: string): Promise<LoadedResource | null> {
    return this.cached(this.resolve(securePath));
  }

  async cached(target: ResolvedResource): Promise<LoadedResource | null> {
    const relative = target.relative;
    const hit = this.memo.get(relative);
    if (hit !== undefined && this.now() - hit.at < WEB_LOADER_CACHE_MS) {
      hit.at = this.now();
      return { ...hit.value, source: 'memo' };
    }
    const onDisk = await this.options.cache.read(relative);
    if (onDisk === null) {
      return null;
    }
    const value: LoadedResource = {
      body: onDisk,
      contentType: this.contentTypeOf(relative) ?? 'application/octet-stream',
      source: 'disk',
    };
    this.remember(relative, value);
    return value;
  }

  async load(securePath: string): Promise<LoadedResource> {
    const target = this.resolve(securePath);
    const cached = await this.cached(target);
    return cached ?? this.fetchRemote(target);
  }

  async fetchRemote(target: ResolvedResource): Promise<LoadedResource> {
    const remoteUrl = target.remoteUrl;
    const relative = target.relative;
    const contentType = this.contentTypeOf(relative);
    let fetched;
    try {
      fetched = await fetchGuarded(remoteUrl, this.options.guard, {
        maxBytes: WEB_LOADER_MAX_BYTES,
        timeoutMs: WEB_LOADER_TIMEOUT_MS,
        maxRedirects: 3,
      });
    } catch (error) {
      if (error instanceof RemoteFetchError) {
        throw new WebLoaderRefused('refused');
      }
      throw error;
    }
    const value: LoadedResource = {
      body: fetched.body,
      contentType: contentType ?? fetched.contentType ?? 'application/octet-stream',
      source: 'network',
    };
    await this.writeCache(relative, fetched.body);
    this.remember(relative, value);
    return value;
  }

  get cachedBytes(): number {
    return this.options.cache.bytes;
  }

  private contentTypeOf(relative: string): string | null {
    return contentTypeForSuffix(relative.slice(relative.lastIndexOf('.') + 1));
  }

  private async writeCache(relative: string, body: Uint8Array): Promise<void> {
    for (const evicted of await this.options.cache.write(relative, body)) {
      this.memo.delete(evicted);
    }
  }

  private remember(key: string, value: LoadedResource): void {
    const existing = this.memo.get(key);
    if (existing !== undefined) {
      this.memoBytes -= existing.value.body.length;
      this.memo.delete(key);
    }
    if (value.body.length > this.memoMaxBytes) {
      return;
    }
    while (
      this.memo.size > 0 &&
      (this.memo.size >= WEB_LOADER_CACHE_SIZE ||
        this.memoBytes + value.body.length > this.memoMaxBytes)
    ) {
      const oldest = this.memo.keys().next();
      if (oldest.done) {
        break;
      }
      this.memoBytes -= this.memo.get(oldest.value)?.value.body.length ?? 0;
      this.memo.delete(oldest.value);
    }
    this.memo.set(key, { value, at: this.now() });
    this.memoBytes += value.body.length;
  }
}
