import { mediaBaseFor, ownMediaPath } from '@hiroba/shared';
import type { BlobStore } from './blob.js';
import { mediaUrl, StoreError, StoreTooLargeError } from './blob.js';
import { FlakeIdGenerator } from './flake.js';
import { contentTypeForSuffix, imageTypeOfBytes } from './imageType.js';
import type { ImageType } from './imageType.js';
import type { MediaProcessor } from './media.js';
import { RemoteFetchError, fetchGuarded, type FetchLimits, type GuardOptions } from './net.js';

export const CDN_BUCKET_THRESHOLD_BYTES = 256 * 1024;
export const POSTER_LIMIT_BYTES = 5 * 1024 * 1024;
export const THUMBNAIL_LIMIT_BYTES = 1024 * 1024;
export const UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024;
export const STORE_FROM_DOWNLOAD_CACHE_MS = 10 * 60 * 1000;
export const STORE_FROM_DOWNLOAD_CACHE_SIZE = 1000;
export const THUMBNAIL_REDUCE_TIMEOUT_MS = 10_000;

export type StorageExpire = 'ONE_WEEK' | 'ONE_MONTH';

const EXPIRE_PATH: Record<StorageExpire, string> = { ONE_WEEK: 't', ONE_MONTH: 'm' };

export interface StorageProperty {
  suffix: string;
  prefix?: string;
  expire?: StorageExpire;
}

export interface StorageBuckets {
  img: string;
  cdnImg: string;
  cdnVideo: string;
}

export interface ThumbnailStored {
  url: string;
  path: string;
  sourcePath: string;
  width: number;
  height: number;
}

async function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  work.catch(() => undefined);
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new StoreError('reduce timed out'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function keyPath(id: string, property: StorageProperty): string {
  const expire = property.expire ?? 'ONE_WEEK';
  const prefix = property.prefix ?? '';
  return `${EXPIRE_PATH[expire]}/${prefix}${id}.${property.suffix}`;
}

export function resolveImageBucket(
  buckets: StorageBuckets,
  expire: StorageExpire,
  contentLength: number,
): string {
  if (expire === 'ONE_MONTH') {
    return buckets.cdnImg;
  }
  return contentLength >= CDN_BUCKET_THRESHOLD_BYTES ? buckets.cdnImg : buckets.img;
}

export function suffixOfPath(rawUrl: string): string {
  let path: string;
  try {
    path = new URL(rawUrl).pathname;
  } catch {
    path = rawUrl;
  }
  const slash = path.lastIndexOf('/');
  const name = slash === -1 ? path : path.slice(slash + 1);
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1);
}

interface CacheEntry {
  url: string;
  at: number;
}

export interface StorageServiceOptions {
  blobs: BlobStore;
  processor: MediaProcessor;
  buckets: StorageBuckets;
  nodeId: number;
  guard: GuardOptions;
  now?: () => number;
  reduceTimeoutMs?: number;
  uploadLimitBytes?: number | undefined;
}

export class StorageService {
  readonly uploadLimitBytes: number;
  private readonly ids: FlakeIdGenerator;
  private readonly downloadCache = new Map<string, CacheEntry>();
  private readonly now: () => number;

  constructor(private readonly options: StorageServiceOptions) {
    this.ids = new FlakeIdGenerator(options.nodeId);
    this.now = options.now ?? Date.now;
    this.uploadLimitBytes = options.uploadLimitBytes ?? UPLOAD_LIMIT_BYTES;
  }

  readObject(bucket: string, key: string): Promise<Uint8Array | null> {
    return this.options.blobs.get(bucket, key);
  }

  deleteObject(bucket: string, key: string): Promise<void> {
    return this.options.blobs.delete(bucket, key);
  }

  private baseFor(origin: string): string {
    return mediaBaseFor(origin);
  }

  async storeMedia(body: Uint8Array, origin: string): Promise<string> {
    const type = imageTypeOfBytes(body);
    if (type === null) {
      throw new StoreError('could not detect image type');
    }
    if (body.byteLength > this.uploadLimitBytes) {
      throw new StoreTooLargeError('upload exceeds the per-file limit');
    }
    return await this.storeImage(body, { suffix: type }, origin);
  }

  storeImage(body: Uint8Array, property: StorageProperty, origin: string): Promise<string> {
    const bucket = resolveImageBucket(
      this.options.buckets,
      property.expire ?? 'ONE_WEEK',
      body.byteLength,
    );
    return this.store(body, property, bucket, origin);
  }

  async storeFromDownload(
    sourceUrl: string,
    expire: StorageExpire,
    limitInBytes: number,
    origin: string,
    limits?: Partial<FetchLimits>,
  ): Promise<string> {
    const cacheKey = `${this.baseFor(origin)}|${expire}|${limitInBytes}|${sourceUrl}`;
    const cached = this.downloadCache.get(cacheKey);
    if (cached !== undefined && this.now() - cached.at < STORE_FROM_DOWNLOAD_CACHE_MS) {
      cached.at = this.now();
      return cached.url;
    }
    const located = this.locateOwnMedia(sourceUrl, origin);
    const body =
      located === null
        ? (await this.download(sourceUrl, limitInBytes, limits)).body
        : await this.readOwn(located, limitInBytes);
    const url = await this.storeImage(
      body,
      { expire, prefix: 'sfd', suffix: suffixOfPath(sourceUrl) },
      origin,
    );
    this.remember(cacheKey, url);
    return url;
  }

  private locateOwnMedia(
    sourceUrl: string,
    origin: string,
  ): { bucket: string; key: string } | null {
    const rest = ownMediaPath(sourceUrl, this.baseFor(origin));
    if (rest === null) {
      return null;
    }
    const cut = rest.indexOf('/');
    if (cut <= 0) {
      return null;
    }
    const bucket = rest.slice(0, cut);
    const key = rest.slice(cut + 1);
    const allowed = [
      this.options.buckets.img,
      this.options.buckets.cdnImg,
      this.options.buckets.cdnVideo,
    ];
    if (!allowed.includes(bucket) || key.length === 0) {
      return null;
    }
    return { bucket, key };
  }

  private async readOwn(
    located: { bucket: string; key: string },
    limitInBytes: number,
  ): Promise<Uint8Array> {
    const body = await this.options.blobs.get(located.bucket, located.key);
    if (body === null) {
      throw new StoreError('could not read source');
    }
    if (body.byteLength > limitInBytes) {
      throw new StoreTooLargeError(`source size exceeds limit ${limitInBytes}`);
    }
    return body;
  }

  async storeThumbnail(sourceUrl: string, origin: string): Promise<ThumbnailStored> {
    const located = this.locateOwnMedia(sourceUrl, origin);
    if (located === null) {
      throw new StoreError('only images on this site support thumbnail');
    }
    const body = await this.options.blobs.get(located.bucket, located.key);
    if (body === null) {
      throw new StoreError('could not read source');
    }
    if (body.byteLength > THUMBNAIL_LIMIT_BYTES) {
      throw new StoreTooLargeError(`source size exceeds limit ${THUMBNAIL_LIMIT_BYTES}`);
    }
    let reduced;
    try {
      reduced = await withTimeout(
        this.options.processor.thumbnail(body),
        this.options.reduceTimeoutMs ?? THUMBNAIL_REDUCE_TIMEOUT_MS,
      );
    } catch {
      throw new StoreError('could not reduce image');
    }
    const stored = await this.putObject(
      reduced.data,
      { prefix: 'thumb_', suffix: 'jpeg' },
      this.options.buckets.cdnImg,
    );
    return {
      url: mediaUrl(this.baseFor(origin), stored.bucket, stored.key),
      path: `${stored.bucket}/${stored.key}`,
      sourcePath: `${located.bucket}/${located.key}`,
      width: reduced.width,
      height: reduced.height,
    };
  }

  private async download(
    sourceUrl: string,
    limitInBytes: number,
    limits?: Partial<FetchLimits>,
  ): Promise<{ body: Uint8Array }> {
    try {
      const result = await fetchGuarded(sourceUrl, this.options.guard, {
        maxBytes: limitInBytes,
        timeoutMs: limits?.timeoutMs ?? 20_000,
        maxRedirects: limits?.maxRedirects ?? 3,
      });
      return { body: result.body };
    } catch (error) {
      if (error instanceof RemoteFetchError && error.message === 'too large') {
        throw new StoreTooLargeError(`downloaded size exceeds limit ${limitInBytes}`);
      }
      throw new StoreError('could not download source');
    }
  }

  private async store(
    body: Uint8Array,
    property: StorageProperty,
    bucket: string,
    origin: string,
  ): Promise<string> {
    const stored = await this.putObject(body, property, bucket);
    return mediaUrl(this.baseFor(origin), stored.bucket, stored.key);
  }

  private async putObject(
    body: Uint8Array,
    property: StorageProperty,
    bucket: string,
  ): Promise<{ bucket: string; key: string }> {
    if (property.suffix.trim().length === 0) {
      throw new StoreError('suffix is required');
    }
    const contentType = contentTypeForSuffix(property.suffix);
    if (contentType === null) {
      throw new StoreError(`unsupported suffix ${property.suffix}`);
    }
    const key = keyPath(this.ids.nextString(), property);
    await this.options.blobs.put(bucket, key, body, contentType);
    return { bucket, key };
  }

  private remember(key: string, url: string): void {
    if (this.downloadCache.size >= STORE_FROM_DOWNLOAD_CACHE_SIZE) {
      const oldest = this.downloadCache.keys().next();
      if (!oldest.done) {
        this.downloadCache.delete(oldest.value);
      }
    }
    this.downloadCache.set(key, { url, at: this.now() });
  }
}

export type { ImageType };
