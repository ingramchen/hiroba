import {
  MediaProcessError,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_QUALITY,
  THUMBNAIL_WIDTH,
  type MediaProcessor,
  type ThumbnailResult,
} from '../../core/storage/media.js';

export const MAX_DECODED_PIXELS = 0x3fff * 0x3fff;

export interface PhotonImageLike {
  get_width(): number;
  get_height(): number;
  get_raw_pixels(): Uint8Array;
  get_bytes_jpeg(quality: number): Uint8Array;
  free(): void;
}

export interface PhotonModule {
  PhotonImage: {
    new (raw: Uint8Array, width: number, height: number): PhotonImageLike;
    new_from_byteslice(bytes: Uint8Array): PhotonImageLike;
  };
  crop(image: PhotonImageLike, x1: number, y1: number, x2: number, y2: number): PhotonImageLike;
  resize(image: PhotonImageLike, width: number, height: number, filter: number): PhotonImageLike;
  SamplingFilter: { readonly Lanczos3: number };
}

export function coverBox(
  sourceWidth: number,
  sourceHeight: number,
  width = THUMBNAIL_WIDTH,
  height = THUMBNAIL_HEIGHT,
): { x: number; y: number; width: number; height: number } {
  let boxWidth = sourceWidth;
  let boxHeight = Math.round((sourceWidth * height) / width);
  if (boxHeight > sourceHeight) {
    boxHeight = sourceHeight;
    boxWidth = Math.round((sourceHeight * width) / height);
  }
  return {
    x: Math.floor((sourceWidth - boxWidth) / 2),
    y: Math.floor((sourceHeight - boxHeight) / 2),
    width: boxWidth,
    height: boxHeight,
  };
}

export function flattenOntoWhite(pixels: Uint8Array): Uint8Array {
  for (let at = 0; at < pixels.length; at += 4) {
    const alpha = pixels[at + 3] ?? 255;
    if (alpha === 255) {
      continue;
    }
    const rest = 255 * (255 - alpha);
    pixels[at] = Math.round(((pixels[at] ?? 0) * alpha + rest) / 255);
    pixels[at + 1] = Math.round(((pixels[at + 1] ?? 0) * alpha + rest) / 255);
    pixels[at + 2] = Math.round(((pixels[at + 2] ?? 0) * alpha + rest) / 255);
    pixels[at + 3] = 255;
  }
  return pixels;
}

export class WasmMediaProcessor implements MediaProcessor {
  constructor(private readonly photon: PhotonModule) {}

  thumbnail(source: Uint8Array): Promise<ThumbnailResult> {
    return new Promise((resolve) => {
      resolve(this.reduce(source));
    });
  }

  private reduce(source: Uint8Array): ThumbnailResult {
    const photon = this.photon;
    let decoded: PhotonImageLike;
    try {
      decoded = photon.PhotonImage.new_from_byteslice(source);
    } catch {
      throw new MediaProcessError('could not decode image');
    }
    let cropped: PhotonImageLike | null = null;
    let resized: PhotonImageLike | null = null;
    let flattened: PhotonImageLike | null = null;
    try {
      const sourceWidth = decoded.get_width();
      const sourceHeight = decoded.get_height();
      if (sourceWidth < 1 || sourceHeight < 1) {
        throw new MediaProcessError('could not decode image');
      }
      if (sourceWidth * sourceHeight > MAX_DECODED_PIXELS) {
        throw new MediaProcessError('source exceeds the decoded pixel limit');
      }
      const box = coverBox(sourceWidth, sourceHeight);
      cropped = photon.crop(decoded, box.x, box.y, box.x + box.width, box.y + box.height);
      resized = photon.resize(
        cropped,
        THUMBNAIL_WIDTH,
        THUMBNAIL_HEIGHT,
        photon.SamplingFilter.Lanczos3,
      );
      flattened = new photon.PhotonImage(
        flattenOntoWhite(resized.get_raw_pixels()),
        THUMBNAIL_WIDTH,
        THUMBNAIL_HEIGHT,
      );
      return {
        data: flattened.get_bytes_jpeg(THUMBNAIL_QUALITY),
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_HEIGHT,
      };
    } catch (error) {
      throw error instanceof MediaProcessError
        ? error
        : new MediaProcessError('could not reduce image');
    } finally {
      for (const image of [decoded, cropped, resized, flattened]) {
        image?.free();
      }
    }
  }
}
