import { trimTrailingSlash } from './clientConfig.js';
import { ParsedUrl, extractUrls } from './url.js';

export const IMAGE_SUFFIXES = ['jpg', 'png', 'gif', 'jpeg', 'webp', 'bmp'] as const;
export const IMGUR_SUFFIXES = ['gifv', 'mp4', 'webm'] as const;
export const VIDEO_SUFFIXES = ['mp4', 'webm', 'ogg'] as const;
export const TWITTER_MEDIA_MARKER = 'pbs.twimg.com/media/';
export const YOUTUBE_EMBED_WIDTH = 560;

export function isImageMedia(url: ParsedUrl): boolean {
  const suffix = url.suffix.toLowerCase();
  for (const known of IMAGE_SUFFIXES) {
    if (suffix.endsWith(known)) {
      return true;
    }
  }
  const raw = url.toString();
  if (raw.includes(TWITTER_MEDIA_MARKER)) {
    return (
      raw.includes('jpg') || raw.includes('png') || raw.includes('gif') || raw.includes('webp')
    );
  }
  return false;
}

function isShortYoutubeUrl(url: ParsedUrl): boolean {
  return url.hostName.toLowerCase() === 'youtu.be';
}

function isFullYoutubeUrl(url: ParsedUrl): boolean {
  if (!url.hostName.toLowerCase().includes('youtube.com')) {
    return false;
  }
  const raw = url.toString();
  if (raw.toLowerCase().includes('autoplay')) {
    return false;
  }
  return raw.includes('v=') || url.path.includes('/v/') || url.queryString.includes('video_id');
}

export function isYoutubeMedia(url: ParsedUrl): boolean {
  return isFullYoutubeUrl(url) || isShortYoutubeUrl(url);
}

export function youtubeVideoId(url: ParsedUrl): string {
  if (isShortYoutubeUrl(url)) {
    if (url.path.length < 3) {
      throw new Error('not short youtube url');
    }
    return url.path.slice(1);
  }
  if (url.path.includes('/v/')) {
    return url.path.slice(url.path.indexOf('/v/') + 3);
  }
  const raw = url.toString();
  const at = raw.indexOf('v=');
  if (at === -1) {
    throw new Error('no youtube video id');
  }
  const rest = raw.slice(at + 2);
  const end = rest.search(/[&#]/u);
  return end === -1 ? rest : rest.slice(0, end);
}

export function isImgurGifvMedia(url: ParsedUrl): boolean {
  const host = url.hostName.toLowerCase();
  if (host !== 'imgur.com' && host !== 'i.imgur.com') {
    return false;
  }
  const suffix = url.suffix.toLowerCase();
  return IMGUR_SUFFIXES.some((known) => suffix === known);
}

function withoutScheme(value: string): string {
  return value.replace(/^https?:\/\//iu, '');
}

export function ownMediaPath(url: string, mediaBase: string): string | null {
  const base = withoutScheme(trimTrailingSlash(mediaBase.trim()));
  if (base.length === 0) {
    return null;
  }
  const target = withoutScheme(url);
  if (!target.startsWith(`${base}/`)) {
    return null;
  }
  const rest = target.slice(base.length + 1);
  return rest.length === 0 || rest.includes('..') ? null : rest;
}

export function isOwnMedia(url: string, mediaBase: string): boolean {
  return ownMediaPath(url, mediaBase) !== null;
}

export function isKekekeGifVideo(url: ParsedUrl, mediaBase: string): boolean {
  return url.suffix.toLowerCase() === 'mp4' && isOwnMedia(url.toString(), mediaBase);
}

export function isVideoMedia(url: ParsedUrl): boolean {
  const suffix = url.suffix.toLowerCase();
  return VIDEO_SUFFIXES.some((known) => suffix === known);
}

export type MediaKind = 'image' | 'youtube' | 'imgurGifv' | 'kekekeGif' | 'video';

export interface DetectedMedia {
  kind: MediaKind;
  url: ParsedUrl;
  secureUrl: ParsedUrl;
  forceSecured: boolean;
}

export interface MediaContext {
  siteOrigin: string;
  mediaBase: string;
}

export function detectMedia(url: ParsedUrl, mediaBase: string): MediaKind | null {
  if (isImageMedia(url)) {
    return 'image';
  }
  if (isYoutubeMedia(url)) {
    return 'youtube';
  }
  if (isImgurGifvMedia(url)) {
    return 'imgurGifv';
  }
  if (isKekekeGifVideo(url, mediaBase)) {
    return 'kekekeGif';
  }
  if (isVideoMedia(url)) {
    return 'video';
  }
  return null;
}

export function findMedia(
  content: string,
  restricted: boolean,
  context: MediaContext,
): DetectedMedia | null {
  for (const url of extractUrls(content, restricted, context.siteOrigin)) {
    const kind = detectMedia(url, context.mediaBase);
    if (kind === null) {
      continue;
    }
    if (isOwnMedia(url.toString(), context.mediaBase)) {
      const pageSecure = /^https:\/\//iu.test(context.mediaBase.trim());
      return {
        kind,
        url,
        secureUrl: pageSecure ? url.withSecure() : url,
        forceSecured: false,
      };
    }
    const secureUrl = url.withSecure();
    return { kind, url, secureUrl, forceSecured: !url.secured && secureUrl.secured };
  }
  return null;
}

export function isPosterableKind(kind: MediaKind): boolean {
  return kind === 'image' || kind === 'youtube';
}

export function isYoutubeEmbedUrl(url: ParsedUrl): boolean {
  const host = url.hostName.toLowerCase();
  return (
    (host === 'www.youtube.com' || host === 'youtube.com' || host === 'www.youtube-nocookie.com') &&
    /^\/embed\/[\w-]+$/u.test(url.path)
  );
}

export function isGifLike(url: ParsedUrl): boolean {
  if (url.suffix.toLowerCase() === 'gif') {
    return true;
  }
  return url.toString().includes('format=gif');
}

export function requiresWebLoader(media: DetectedMedia): boolean {
  return media.url.hostName.includes('imgur.com') || media.forceSecured;
}

export function imgurSourceUrl(secure: string, suffix: string): string {
  return secure.replace(/\.[\w]{3,4}$/u, suffix);
}
