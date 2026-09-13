import {
  MEDIA_ROUTE_PREFIX,
  STORE_FAILED_TYPE,
  STORE_TOO_LARGE_TYPE,
  type SquareThumb,
  type StoreFailure,
  type StoreTooLargeFailure,
  type StoreThumbnailRequest,
  type UploadMediaFields,
} from '@hiroba/shared';
import type { Context, Hono, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { StoreError, StoreTooLargeError } from './blob.js';
import type { MediaServices } from './index.js';
import { contentTypeForSuffix } from './imageType.js';
import { remoteAddress } from '../http.js';
import { ClientAndGlobalLimiter, retryAfterSeconds, type RateRule } from '../rateLimit.js';
import {
  WEB_LOADER_FETCH_WINDOW_MS,
  WEB_LOADER_FETCHES_GLOBAL,
  WEB_LOADER_FETCHES_PER_CLIENT,
  WEB_LOADER_PREFIX,
  WebLoaderRefused,
} from './webloader.js';

export interface RouteLimits {
  loadFetches?: { perClient: RateRule; global: RateRule };
}

const DEFAULT_LOAD_FETCHES = {
  perClient: { windowMs: WEB_LOADER_FETCH_WINDOW_MS, max: WEB_LOADER_FETCHES_PER_CLIENT },
  global: { windowMs: WEB_LOADER_FETCH_WINDOW_MS, max: WEB_LOADER_FETCHES_GLOBAL },
};

const STORE_FAILED: StoreFailure = { type: STORE_FAILED_TYPE, message: 'store failed' };
const UPLOAD_FAILED = { url: null } as const;
const STORE_TOO_LARGE: StoreFailure = { type: STORE_TOO_LARGE_TYPE, message: 'too large' };

function tooLarge(limitInBytes: number): StoreTooLargeFailure {
  return { type: STORE_TOO_LARGE_TYPE, message: STORE_TOO_LARGE.message, limitInBytes };
}

function storeFailure(error: unknown): StoreFailure | null {
  if (error instanceof StoreTooLargeError) {
    return STORE_TOO_LARGE;
  }
  if (error instanceof StoreError) {
    return STORE_FAILED;
  }
  return null;
}

export interface ThumbWriter {
  topic: string;
  thumb: { path: string; sourcePath: string; width: number; height: number };
}

export interface StoredMedia {
  url: string;
  topic: string;
  origin: string;
}

export interface MediaHooks {
  authorize?: (c: Context, fields: UploadMediaFields) => void;
  saveThumb?: (write: ThumbWriter) => void | Promise<void>;
  stored?: (c: Context, media: StoredMedia) => void;
}

export function requestOrigin(c: Context): string {
  const host = c.req.header('x-forwarded-host') ?? c.req.header('host') ?? '';
  const proto = (c.req.header('x-forwarded-proto') ?? '').split(',')[0]?.trim() ?? '';
  if (host.length === 0) {
    try {
      return new URL(c.req.url).origin;
    } catch {
      return '';
    }
  }
  if (proto.length > 0) {
    return `${proto}://${host}`;
  }
  try {
    return `${new URL(c.req.url).protocol}//${host}`;
  } catch {
    return `http://${host}`;
  }
}

function suffixOf(key: string): string {
  const dot = key.lastIndexOf('.');
  return dot === -1 ? '' : key.slice(dot + 1);
}

function forwardedIps(c: Context): string {
  const header = c.req.header('x-forwarded-for');
  const forwarded = (header ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (forwarded.length > 0) {
    return forwarded.join(',');
  }
  return remoteAddress(c);
}

export function registerMediaRoutes(
  app: Hono,
  media: MediaServices,
  hooks: MediaHooks = {},
  limits: RouteLimits = {},
): void {
  const fetchRule = limits.loadFetches ?? DEFAULT_LOAD_FETCHES;
  const fetches = new ClientAndGlobalLimiter(fetchRule.perClient, fetchRule.global);

  app.get('/api/storage/health', (c) => c.text('ok'));

  const limitUploadBody: MiddlewareHandler = (c, next) =>
    bodyLimit({
      maxSize: media.storage.uploadLimitBytes,
      onError: (context) => context.json(tooLarge(media.storage.uploadLimitBytes), 400),
    })(c, next);

  app.post('/api/storage/upload-media', limitUploadBody, async (c) => {
    let parsed: Record<string, unknown>;
    try {
      parsed = await c.req.parseBody();
    } catch {
      return c.json(UPLOAD_FAILED, 400);
    }
    hooks.authorize?.(c, {
      topic: typeof parsed['topic'] === 'string' ? parsed['topic'] : '',
      permit: typeof parsed['permit'] === 'string' ? parsed['permit'] : '',
    });
    const file = parsed['file'];
    if (!(file instanceof File)) {
      return c.json(UPLOAD_FAILED, 400);
    }
    const body = new Uint8Array(await file.arrayBuffer());
    const origin = requestOrigin(c);
    let url: string;
    try {
      url = await media.storage.storeMedia(body, origin);
    } catch {
      return c.json(UPLOAD_FAILED, 400);
    }
    hooks.stored?.(c, {
      url,
      topic: typeof parsed['topic'] === 'string' ? parsed['topic'] : '',
      origin,
    });
    return c.json({ url }, 201, { location: url });
  });

  app.post('/api/storage/store-thumbnail', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Partial<StoreThumbnailRequest>;
    const url = typeof body.url === 'string' ? body.url : '';
    const topic = typeof body.topic === 'string' ? body.topic : '';
    let stored;
    try {
      stored = await media.storage.storeThumbnail(url, requestOrigin(c));
    } catch (error) {
      const failure = storeFailure(error);
      return c.json(failure ?? STORE_FAILED, 400);
    }
    if (topic.length > 0 && hooks.saveThumb !== undefined) {
      await hooks.saveThumb({
        topic,
        thumb: {
          path: stored.path,
          sourcePath: stored.sourcePath,
          width: stored.width,
          height: stored.height,
        },
      });
    }
    const thumb: SquareThumb = { url: stored.url, width: stored.width, height: stored.height };
    return c.json(thumb);
  });

  app.get(`${MEDIA_ROUTE_PREFIX}/:bucket/:key{.+}`, async (c) => {
    const bucket = c.req.param('bucket');
    const key = c.req.param('key');
    const allowed = [
      media.config.bucketImg,
      media.config.bucketCdnImg,
      media.config.bucketCdnVideo,
    ];
    if (!allowed.includes(bucket) || key.length === 0 || key.includes('..')) {
      return c.body(null, 404);
    }
    let body: Uint8Array | null;
    try {
      body = await media.storage.readObject(bucket, key);
    } catch {
      return c.body(null, 404);
    }
    if (body === null) {
      return c.body(null, 404);
    }
    return c.body(body as unknown as ArrayBuffer, 200, {
      'content-type': contentTypeForSuffix(suffixOf(key)) ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    });
  });

  app.get('/load/*', async (c) => {
    const raw = c.req.raw.url;
    const at = raw.indexOf(WEB_LOADER_PREFIX);
    if (at === -1) {
      return c.body(null, 502);
    }
    const securePath = raw.slice(at + WEB_LOADER_PREFIX.length);
    try {
      const target = media.loader.resolve(securePath);
      let loaded = await media.loader.cached(target);
      if (loaded === null) {
        const client = forwardedIps(c);
        const budget = fetches.hit(client, Date.now());
        if (!budget.allowed) {
          return c.body(null, 429, { 'retry-after': retryAfterSeconds(budget) });
        }
        loaded = await media.loader.fetchRemote(target);
      }
      return c.body(loaded.body as unknown as ArrayBuffer, 200, {
        'content-type': loaded.contentType,
        'cache-control': 'public, max-age=3600',
      });
    } catch (error) {
      if (error instanceof WebLoaderRefused) {
        return c.body(null, 502);
      }
      throw error;
    }
  });
}
