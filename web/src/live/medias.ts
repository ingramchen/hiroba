import {
  imgurSourceUrl,
  isGifLike,
  requiresWebLoader,
  youtubeVideoId,
  type ChatroomType,
  type DetectedMedia,
  type MessageEvent,
} from '@hiroba/shared';
import type { MediaItem } from '../components/square/MediaWidget.vue';
import { mediaOfMessage } from '../media/message';
import { formatTime } from './rows';

export const MAX_MEDIA = 50;
export const MEDIA_MODE_STORAGE_KEY = 'hiroba.mediaFlowMode';
export const MEDIA_MODES = ['SHOW', 'HIDE', 'NSFW'] as const;
export type MediaMode = (typeof MEDIA_MODES)[number];

export function supportVotePoster(roomType: ChatroomType, forbidden: boolean): boolean {
  return !forbidden && roomType === 'FREE';
}

export function supportCreatePoster(
  roomType: ChatroomType,
  forbidden: boolean,
  anchorable: boolean,
): boolean {
  return !forbidden && roomType === 'ANCHOR_SQUARE' && anchorable;
}

export function supportPosterIcon(
  roomType: ChatroomType,
  forbidden: boolean,
  anchorable: boolean,
): boolean {
  return (
    supportCreatePoster(roomType, forbidden, anchorable) || supportVotePoster(roomType, forbidden)
  );
}

export function parseMediaMode(raw: string | null | undefined): MediaMode {
  return raw !== null && raw !== undefined && (MEDIA_MODES as readonly string[]).includes(raw)
    ? (raw as MediaMode)
    : 'SHOW';
}

function contentOf(media: DetectedMedia): Pick<MediaItem, 'src' | 'webmSrc'> {
  const secure = media.secureUrl.toString();
  if (media.kind === 'youtube') {
    return { src: `https://www.youtube.com/embed/${youtubeVideoId(media.url)}` };
  }
  if (media.kind === 'imgurGifv') {
    return { src: imgurSourceUrl(secure, '.mp4'), webmSrc: imgurSourceUrl(secure, '.webm') };
  }
  return { src: secure };
}

export interface MediaContext {
  myPublicId: string;
  locale: string;
}

export function toMediaItem(
  event: MessageEvent,
  media: DetectedMedia,
  context: MediaContext,
): MediaItem {
  const item: MediaItem = {
    kind: media.kind,
    header: `${event.senderNickName} @${formatTime(event.date, context.locale)}`,
    senderPublicId: event.senderPublicId,
    sourceUrl: media.url.toString(),
    ...contentOf(media),
  };
  if (event.senderPublicId === context.myPublicId) {
    item.mine = true;
  }
  if (media.kind === 'imgurGifv') {
    item.gifv = media.url.suffix.toLowerCase() === 'gifv';
  }
  if (media.kind === 'image') {
    item.similarImage = true;
    item.gif = isGifLike(media.url);
    if (requiresWebLoader(media)) {
      item.webLoader = true;
    }
  }
  return item;
}

const DELETE_PREFIX = 'delete ';

export function deleteMediaContent(sourceUrl: string): string {
  return DELETE_PREFIX + sourceUrl;
}

export function deletedSourceUrl(content: string): string {
  return content.startsWith(DELETE_PREFIX) ? content.slice(DELETE_PREFIX.length) : content;
}

export class MediaFlow {
  readonly items: MediaItem[] = [];
  private seq = 0;

  constructor(private readonly max: number = MAX_MEDIA) {}

  reset(): void {
    this.items.length = 0;
    this.seq = 0;
  }

  accept(event: MessageEvent, context: MediaContext): MediaItem | null {
    const media = mediaOfMessage(event.content, event.eventType);
    if (media === null) {
      return null;
    }
    const item = toMediaItem(event, media, context);
    this.seq += 1;
    item.key = this.seq;
    this.items.unshift(item);
    if (this.items.length > this.max) {
      this.items.length = this.max;
    }
    return item;
  }

  removeSourceUrl(sourceUrl: string, senderPublicId: string): boolean {
    let removed = false;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (
        item !== undefined &&
        item.sourceUrl === sourceUrl &&
        item.senderPublicId === senderPublicId
      ) {
        this.items.splice(i, 1);
        removed = true;
      }
    }
    return removed;
  }

  removeAt(index: number): MediaItem | null {
    const [removed] = this.items.splice(index, 1);
    return removed ?? null;
  }
}
