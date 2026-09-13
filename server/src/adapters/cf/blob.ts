import {
  LIST_PAGE_SIZE,
  S3BlobStore,
  StoreError,
  type BlobStore,
  type ListedPage,
} from '../../core/storage/blob.js';

export interface R2ObjectLike {
  key: string;
  uploaded: Date;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface R2ListedLike {
  objects: R2ObjectLike[];
  truncated: boolean;
  cursor?: string | undefined;
}

export interface R2BucketLike {
  put(key: string, body: ArrayBuffer, options?: unknown): Promise<unknown>;
  get(key: string): Promise<R2ObjectLike | null>;
  list(options: { prefix: string; limit: number; cursor?: string }): Promise<R2ListedLike>;
  delete(key: string): Promise<void>;
}

export class R2BlobStore implements BlobStore {
  constructor(private readonly buckets: Readonly<Record<string, R2BucketLike>>) {}

  private bucketOf(bucket: string): R2BucketLike {
    const found = this.buckets[bucket];
    if (found === undefined) {
      throw new StoreError(`no binding for bucket ${bucket}`);
    }
    return found;
  }

  async put(bucket: string, key: string, body: Uint8Array, contentType: string): Promise<void> {
    const copy = body.slice();
    await this.bucketOf(bucket).put(key, copy.buffer as ArrayBuffer, {
      httpMetadata: { contentType },
    });
  }

  async get(bucket: string, key: string): Promise<Uint8Array | null> {
    const found = await this.bucketOf(bucket).get(key);
    return found === null ? null : new Uint8Array(await found.arrayBuffer());
  }

  async list(bucket: string, prefix: string, token: string | null): Promise<ListedPage> {
    const page = await this.bucketOf(bucket).list({
      prefix,
      limit: LIST_PAGE_SIZE,
      ...(token === null ? {} : { cursor: token }),
    });
    return {
      objects: page.objects.map((object) => ({
        key: object.key,
        lastModified: object.uploaded.getTime(),
      })),
      next: page.truncated && page.cursor !== undefined ? page.cursor : null,
    };
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.bucketOf(bucket).delete(key);
  }
}

export interface R2S3Options {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export const R2_REGION = 'auto';

export function r2S3BlobStore(options: R2S3Options): S3BlobStore {
  return new S3BlobStore({
    endpoint: options.endpoint,
    region: R2_REGION,
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    acl: null,
  });
}
