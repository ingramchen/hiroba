import { readTrustProxy } from './ip.js';
import { UPLOAD_LIMIT_BYTES } from './storage/service.js';

export interface Config {
  port: number;
  dbPath: string;
  webDist: string;
  tokenSecret: string;
  media: MediaConfig | null;
  sysPassword: string | null;
  trustProxy: number;
}

export interface MediaConfig {
  s3Endpoint: string;
  s3Region: string;
  s3AccessKey: string;
  s3SecretKey: string;
  bucketImg: string;
  bucketCdnImg: string;
  bucketCdnVideo: string;
  flakeNodeId: number;
  webLoaderHosts: readonly string[];
  webLoaderKey: string;
  webLoaderCacheDir: string | null;
  webLoaderCacheMaxBytes: number | null;
  uploadLimitBytes?: number;
}

export const UPLOAD_LIMIT_MB_ENV = 'UPLOAD_LIMIT_MB';

export const DEFAULT_WEB_LOADER_HOSTS = [
  'imgur.com',
  'i.imgur.com',
  'pbs.twimg.com',
  'kekeke.cc',
] as const;

function optional(env: Env, key: string): string | null {
  const value = env[key];
  return value === undefined || value.trim().length === 0 ? null : value.trim();
}

export function readMediaConfig(env: Env): MediaConfig | null {
  const endpoint = optional(env, 'S3_ENDPOINT');
  const accessKey = optional(env, 'S3_ACCESS_KEY');
  const secretKey = optional(env, 'S3_SECRET_KEY');
  if (endpoint === null || accessKey === null || secretKey === null) {
    return null;
  }
  const hosts = optional(env, 'WEB_LOADER_HOSTS');
  return {
    s3Endpoint: endpoint,
    s3Region: optional(env, 'S3_REGION') ?? 'us-east-1',
    s3AccessKey: accessKey,
    s3SecretKey: secretKey,
    bucketImg: optional(env, 'S3_BUCKET_IMG') ?? 'hiroba-img',
    bucketCdnImg: optional(env, 'S3_BUCKET_C') ?? 'hiroba-c',
    bucketCdnVideo: optional(env, 'S3_BUCKET_V') ?? 'hiroba-v',
    flakeNodeId: Number(optional(env, 'FLAKE_NODE_ID') ?? 1),
    webLoaderHosts:
      hosts === null ? [...DEFAULT_WEB_LOADER_HOSTS] : hosts.split(',').map((host) => host.trim()),
    webLoaderKey: requireValue(env, 'WEB_LOADER_KEY'),
    webLoaderCacheDir:
      optional(env, 'WEB_LOADER_CACHE_PATH') ?? optional(env, 'WEB_LOADER_RESULT_PATH'),
    webLoaderCacheMaxBytes: megabytes(optional(env, 'WEB_LOADER_CACHE_MAX_MB')),
    uploadLimitBytes: megabytes(optional(env, UPLOAD_LIMIT_MB_ENV)) ?? UPLOAD_LIMIT_BYTES,
  };
}

function megabytes(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed * 1024 * 1024) : null;
}

type Env = Record<string, string | undefined>;

export function requireValue(env: Env, key: string): string {
  const value = env[key];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${key} is not set`);
  }
  return value;
}

export function optionalValue(env: Env, key: string): string | null {
  const value = env[key];
  return value === undefined || value.trim().length === 0 ? null : value;
}

function dbPath(env: Env): string {
  const raw = env['DB_PATH'];
  if (raw === undefined) {
    return './hiroba.sqlite';
  }
  if (raw.trim().length === 0) {
    throw new Error('DB_PATH is set but empty; unset it for ./hiroba.sqlite or name a file');
  }
  return raw.trim();
}

function port(env: Env): number {
  const raw = optional(env, 'PORT');
  if (raw === null) {
    return 3000;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 65_535) {
    throw new Error(`PORT is not a port number: ${raw}`);
  }
  return value;
}

export function readConfig(env: Env): Config {
  return {
    port: port(env),
    dbPath: dbPath(env),
    webDist: optional(env, 'WEB_DIST') ?? 'public',
    tokenSecret: requireValue(env, 'TOKEN_SECRET'),
    media: readMediaConfig(env),
    sysPassword: optionalValue(env, 'SYS_PASSWORD'),
    trustProxy: readTrustProxy(env),
  };
}

export const NAIVE_CLASSIFIER = 'naive';
export const IMGMOD_URL_ENV = 'IMGMOD_URL';
export const IMGMOD_TOKEN_ENV = 'IMGMOD_TOKEN';

export interface RemoteClassifier {
  kind: 'remote';
  url: string;
  token: string | null;
}

export interface NaiveClassifier {
  kind: 'naive';
  token: string | null;
}

export type ModerationConfig = RemoteClassifier | NaiveClassifier;

export function readModerationConfig(env: Env): ModerationConfig | null {
  const url = optionalValue(env, IMGMOD_URL_ENV);
  const token = optionalValue(env, IMGMOD_TOKEN_ENV);
  const trimmed = url === null ? null : url.trim();
  if (trimmed === null || trimmed === NAIVE_CLASSIFIER) {
    if (env['NODE_ENV'] === 'production') {
      return null;
    }
    return { kind: 'naive', token: token === null ? null : token.trim() };
  }
  return { kind: 'remote', url: trimmed, token: token === null ? null : token.trim() };
}

export function warnModerationOff(): void {
  console.warn(
    `*** ${IMGMOD_URL_ENV} is not set: image moderation is off and uploads are shown unmasked. ***`,
  );
}
