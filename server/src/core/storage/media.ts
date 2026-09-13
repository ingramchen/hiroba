export const THUMBNAIL_WIDTH = 100;
export const THUMBNAIL_HEIGHT = 75;
export const THUMBNAIL_QUALITY = 80;

export interface ThumbnailResult {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface MediaProcessor {
  thumbnail(source: Uint8Array): Promise<ThumbnailResult>;
}

export class MediaProcessError extends Error {}
