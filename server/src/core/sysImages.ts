import type { MessageEvent, SysImage } from '@hiroba/shared';
import { MEDIA_ROUTE_PREFIX, extractUrls } from '@hiroba/shared';
import { mediaRoutePath } from './storage/blob.js';
import type { MediaServices } from './storage/index.js';
import type { Services } from './types.js';

export const SYS_IMAGE_FEED_MAX = 200;

export const DELETE_MEDIA_PREFIX = 'delete ';

export type DeleteImageError = 'NO_MEDIA' | 'INVALID_URL' | 'INVALID_BUCKET' | 'DELETE_FAILED';

export type DeleteImageResult =
  | { ok: true; url: string; bucket: string; key: string; dropped: SysImage[] }
  | { ok: false; error: DeleteImageError; status: 400 | 502 | 503 };

export interface DeleteImageInput {
  url: string;
  topic: string;
  senderPublicId: string;
}

export async function deleteThumbObject(media: MediaServices, path: string): Promise<boolean> {
  const slash = path.indexOf('/');
  if (slash <= 0 || slash === path.length - 1) {
    return false;
  }
  try {
    await media.storage.deleteObject(path.slice(0, slash), path.slice(slash + 1));
    return true;
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'thumbnail-delete-failed',
        path,
        reason: error instanceof Error ? error.message : 'failed',
      }),
    );
    return false;
  }
}

export async function deleteStoredImage(
  services: Services,
  input: DeleteImageInput,
): Promise<DeleteImageResult> {
  const media = services.media;
  if (media === null) {
    return { ok: false, error: 'NO_MEDIA', status: 503 };
  }
  const path = mediaRoutePath(input.url);
  const slash = path === null ? -1 : path.indexOf('/');
  const bucket = path === null || slash === -1 ? '' : path.slice(0, slash);
  const key = path === null || slash === -1 ? '' : path.slice(slash + 1);
  if (key.length === 0) {
    return { ok: false, error: 'INVALID_URL', status: 400 };
  }
  const buckets = [media.config.bucketImg, media.config.bucketCdnImg, media.config.bucketCdnVideo];
  if (!buckets.includes(bucket)) {
    return { ok: false, error: 'INVALID_BUCKET', status: 400 };
  }
  try {
    await media.storage.deleteObject(bucket, key);
  } catch {
    return { ok: false, error: 'DELETE_FAILED', status: 502 };
  }
  for (const thumb of services.squares.thumbsOfSource(`${bucket}/${key}`)) {
    await deleteThumbObject(media, thumb.thumbPath);
    services.squares.clearThumb(thumb.topic);
  }
  const dropped = services.sysImages.remove(input.url);
  // the client drops a card only when the removal names its OWNER
  // (MediaFlow.removeSourceUrl matches url AND senderPublicId), so a caller that
  // does not know the uploader -- the moderation block path -- falls back to the
  // feed entry, which carries it.
  const owner =
    input.senderPublicId.length > 0 ? input.senderPublicId : (dropped[0]?.senderPublicId ?? '');
  if (services.hub.has(input.topic)) {
    services.hub.get(input.topic).publish({
      eventType: 'DELETE_MEDIA',
      senderPublicId: owner,
      senderNickName: dropped[0]?.senderNickname ?? '',
      senderColorToken: null,
      anchorUsername: '',
      content: DELETE_MEDIA_PREFIX + input.url,
      date: services.clock.now(),
    });
  }
  return { ok: true, url: input.url, bucket, key, dropped };
}

export function imageUrlsIn(content: string): string[] {
  const marker = `${MEDIA_ROUTE_PREFIX}/`;
  const found: string[] = [];
  for (const url of extractUrls(content, false, '')) {
    const text = url.toString();
    if (text.includes(marker)) {
      found.push(text);
    }
  }
  return found;
}

export class SysImageFeed {
  private readonly entries: SysImage[] = [];

  constructor(
    readonly startedAt: number,
    private readonly max: number = SYS_IMAGE_FEED_MAX,
  ) {}

  observe(topic: string, event: MessageEvent): void {
    if (event.eventType === 'DELETE_MEDIA') {
      return;
    }
    for (const url of imageUrlsIn(event.content)) {
      this.entries.push({
        url,
        topic,
        time: event.date,
        senderPublicId: event.senderPublicId,
        senderNickname: event.senderNickName,
      });
    }
    while (this.entries.length > this.max) {
      this.entries.shift();
    }
  }

  remove(url: string): SysImage[] {
    const dropped: SysImage[] = [];
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      if (entry !== undefined && entry.url === url) {
        this.entries.splice(i, 1);
        dropped.unshift(entry);
      }
    }
    return dropped;
  }

  recent(limit: number): SysImage[] {
    const bounded = Math.min(Math.max(Math.trunc(limit), 1), this.max);
    return this.entries.slice(-bounded).toReversed();
  }
}
