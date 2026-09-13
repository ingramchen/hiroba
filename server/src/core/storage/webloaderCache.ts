import type { BlobStore } from './blob.js';

export interface WebLoaderCache {
  readonly bytes: number;
  read(relative: string): Promise<Uint8Array | null>;
  write(relative: string, body: Uint8Array): Promise<readonly string[]>;
}

export class NullWebLoaderCache implements WebLoaderCache {
  readonly bytes = 0;

  read(): Promise<Uint8Array | null> {
    return Promise.resolve(null);
  }

  write(): Promise<readonly string[]> {
    return Promise.resolve([]);
  }
}

export interface BlobWebLoaderCacheOptions {
  blobs: BlobStore;
  bucket: string;
  prefix?: string;
  maxBytes?: number;
}

export const WEB_LOADER_BLOB_PREFIX = 'w/';

export class BlobWebLoaderCache implements WebLoaderCache {
  readonly bytes = 0;
  private readonly prefix: string;

  constructor(private readonly options: BlobWebLoaderCacheOptions) {
    this.prefix = options.prefix ?? WEB_LOADER_BLOB_PREFIX;
  }

  async read(relative: string): Promise<Uint8Array | null> {
    let found;
    try {
      found = await this.options.blobs.get(this.options.bucket, `${this.prefix}${relative}`);
    } catch {
      return null;
    }
    return found === null || found.length === 0 ? null : found;
  }

  async write(relative: string, body: Uint8Array): Promise<readonly string[]> {
    const max = this.options.maxBytes;
    if (max !== undefined && body.length > max) {
      return [];
    }
    try {
      await this.options.blobs.put(
        this.options.bucket,
        `${this.prefix}${relative}`,
        body,
        'application/octet-stream',
      );
    } catch {
      return [];
    }
    return [];
  }
}
