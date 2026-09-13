import { renderKmark } from '@hiroba/shared';
import { preparePosterSource, renderPosterBody, type EmojiRenderOptions } from '../emoji/decorator';

export const POSTER_MAX_CONTENT_LENGTH = 3000;
export const POSTER_FADE_MS = 5000;
export const POSTER_DRAFT_SAVE_MS = 5000;
export const POSTER_READ_STORAGE_KEY = 'hiroba.readPoster';
export const POSTER_DRAFT_STORAGE_KEY = 'hiroba.posterDraft';

export const POSTER_DISPLAY_MODES = [
  'FULL',
  'BIG_MEDIA',
  'SMALL',
  'ONE_LINE',
  'HIDE',
  'RAW',
] as const;
export type PosterDisplayMode = (typeof POSTER_DISPLAY_MODES)[number];

export function renderPoster(content: string, options: EmojiRenderOptions = {}): string {
  return renderPosterBody(renderKmark(preparePosterSource(content)), options);
}

export function initialDisplayMode(posterId: string, readId: string | null): PosterDisplayMode {
  return readId === posterId ? 'ONE_LINE' : 'SMALL';
}

export function shouldFade(posterId: string, readId: string | null): boolean {
  return readId !== posterId;
}
