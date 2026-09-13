import { MEDIA_ROUTE_PREFIX } from '@hiroba/shared';
import { AwsClient } from 'aws4fetch';

export interface BlobStoreOptions {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  acl?: string | null;
}

export interface ListedObject {
  key: string;
  lastModified: number;
}

export interface ListedPage {
  objects: ListedObject[];
  next: string | null;
}

export interface BlobStore {
  put(bucket: string, key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(bucket: string, key: string): Promise<Uint8Array | null>;
  list(bucket: string, prefix: string, token: string | null): Promise<ListedPage>;
  delete(bucket: string, key: string): Promise<void>;
}

export const LIST_PAGE_SIZE = 1000;

function xmlText(value: string): string {
  return value
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&#(\d+);/gu, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/gu, '&');
}

function xmlField(block: string, name: string): string | null {
  const match = new RegExp(`<${name}>([^<]*)</${name}>`, 'u').exec(block);
  return match === null ? null : xmlText(match[1] ?? '');
}

export function parseListing(xml: string): ListedPage {
  const objects: ListedObject[] = [];
  for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/gu)) {
    const block = match[1] ?? '';
    const key = xmlField(block, 'Key');
    const modified = Date.parse(xmlField(block, 'LastModified') ?? '');
    if (key !== null && key.length > 0 && Number.isFinite(modified)) {
      objects.push({ key, lastModified: modified });
    }
  }
  const truncated = xmlField(xml, 'IsTruncated') === 'true';
  const token = xmlField(xml, 'NextContinuationToken');
  return { objects, next: truncated && token !== null && token.length > 0 ? token : null };
}

export class StoreError extends Error {
  readonly type: string = 'StoreException';
}

export class StoreTooLargeError extends StoreError {
  override readonly type = 'StoreTooLargeException';
}

function trimSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function mediaUrlOf(base: string, path: string): string {
  const rest = path.startsWith('/') ? path.slice(1) : path;
  return `${trimSlash(base)}/${rest}`;
}

export function mediaRoutePath(url: string): string | null {
  const marker = `${MEDIA_ROUTE_PREFIX}/`;
  const at = url.indexOf(marker);
  if (at < 0) {
    return null;
  }
  const rest = url.slice(at + marker.length);
  return rest.length === 0 || rest.includes('..') ? null : rest;
}

export function mediaUrl(base: string, bucket: string, key: string): string {
  const path = key.startsWith('/') ? key.slice(1) : key;
  return mediaUrlOf(base, `${bucket}/${path}`);
}

export function objectUrl(endpoint: string, bucket: string, key: string): string {
  const path = key.startsWith('/') ? key.slice(1) : key;
  return `${trimSlash(endpoint)}/${bucket}/${path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}

export const PUBLIC_READ_ACL = 'public-read';

export class S3BlobStore implements BlobStore {
  private readonly client: AwsClient;
  private readonly endpoint: string;
  private readonly acl: string | null;

  constructor(options: BlobStoreOptions) {
    this.acl = options.acl === undefined ? PUBLIC_READ_ACL : options.acl;
    this.client = new AwsClient({
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      region: options.region,
      service: 's3',
    });
    this.endpoint = trimSlash(options.endpoint);
  }

  async put(bucket: string, key: string, body: Uint8Array, contentType: string): Promise<void> {
    const response = await this.client.fetch(objectUrl(this.endpoint, bucket, key), {
      method: 'PUT',
      body,
      headers: {
        'content-type': contentType,
        'content-length': String(body.byteLength),
        ...(this.acl === null ? {} : { 'x-amz-acl': this.acl }),
      },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new StoreError(`storage rejected ${bucket}/${key}: ${response.status} ${detail}`);
    }
  }

  async get(bucket: string, key: string): Promise<Uint8Array | null> {
    const response = await this.client.fetch(objectUrl(this.endpoint, bucket, key));
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new StoreError(`storage read failed ${bucket}/${key}: ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async list(bucket: string, prefix: string, token: string | null): Promise<ListedPage> {
    const query = new URLSearchParams({
      'list-type': '2',
      prefix,
      'max-keys': String(LIST_PAGE_SIZE),
    });
    if (token !== null) {
      query.set('continuation-token', token);
    }
    const response = await this.client.fetch(`${this.endpoint}/${bucket}?${query.toString()}`);
    if (!response.ok) {
      throw new StoreError(`storage list failed ${bucket}/${prefix}: ${response.status}`);
    }
    return parseListing(await response.text());
  }

  async delete(bucket: string, key: string): Promise<void> {
    const response = await this.client.fetch(objectUrl(this.endpoint, bucket, key), {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 404) {
      throw new StoreError(`storage delete failed ${bucket}/${key}: ${response.status}`);
    }
  }
}
