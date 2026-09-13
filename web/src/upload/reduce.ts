import { imageTypeOfBytes } from '@hiroba/shared';

export const MAX_UPLOAD_SIZE = 1024 * 1024;
export const PNG_SKIP_SIZE = 1024 * 256;
export const HUGE_FILE_SIZE = 1024 * 1024 * 40;
export const UPLOAD_INTERVAL_MS = 10_000;
export const UPLOAD_RESET_MS = 50_000;
export const REDUCE_QUALITY = 0.8;
export const REDUCE_STEP = 0.9;

export { imageTypeOfBytes };

export function isReduceSupported(): boolean {
  return (
    typeof CanvasRenderingContext2D !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof FileReader !== 'undefined' &&
    typeof FormData !== 'undefined'
  );
}

function fourCharacters(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(
    bytes[at] ?? 0,
    bytes[at + 1] ?? 0,
    bytes[at + 2] ?? 0,
    bytes[at + 3] ?? 0,
  );
}

function unsigned32BigEndian(bytes: Uint8Array, at: number): number {
  return (
    (bytes[at] ?? 0) * 0x1000000 +
    ((bytes[at + 1] ?? 0) << 16) +
    ((bytes[at + 2] ?? 0) << 8) +
    (bytes[at + 3] ?? 0)
  );
}

function unsigned32LittleEndian(bytes: Uint8Array, at: number): number {
  return (
    (bytes[at] ?? 0) +
    ((bytes[at + 1] ?? 0) << 8) +
    ((bytes[at + 2] ?? 0) << 16) +
    (bytes[at + 3] ?? 0) * 0x1000000
  );
}

const VP8X_ANIMATION_FLAG = 0x02;

function isAnimatedPng(bytes: Uint8Array): boolean {
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = unsigned32BigEndian(bytes, at);
    const kind = fourCharacters(bytes, at + 4);
    if (kind === 'acTL') {
      return true;
    }
    if (kind === 'IDAT') {
      return false;
    }
    at += length + 12;
  }
  return false;
}

function isAnimatedWebp(bytes: Uint8Array): boolean {
  let at = 12;
  while (at + 8 <= bytes.length) {
    const kind = fourCharacters(bytes, at);
    const length = unsigned32LittleEndian(bytes, at + 4);
    if (kind === 'ANIM' || kind === 'ANMF') {
      return true;
    }
    if (kind === 'VP8X' && ((bytes[at + 8] ?? 0) & VP8X_ANIMATION_FLAG) !== 0) {
      return true;
    }
    at += 8 + length + (length % 2);
  }
  return false;
}

export function isAnimated(bytes: Uint8Array): boolean {
  const type = imageTypeOfBytes(bytes);
  if (type === 'png') {
    return isAnimatedPng(bytes);
  }
  if (type === 'webp') {
    return isAnimatedWebp(bytes);
  }
  return false;
}

export function isSmallEnough(bytes: Uint8Array, size: number): boolean {
  if (size > HUGE_FILE_SIZE) {
    return false;
  }
  if (imageTypeOfBytes(bytes) === 'png') {
    return size < PNG_SKIP_SIZE;
  }
  return size < MAX_UPLOAD_SIZE;
}

export function shouldReduce(
  bytes: Uint8Array,
  size: number,
  supported = isReduceSupported(),
): boolean {
  return (
    supported &&
    imageTypeOfBytes(bytes) !== 'gif' &&
    !isAnimated(bytes) &&
    !isSmallEnough(bytes, size)
  );
}

export function initialRate(bytes: Uint8Array): number {
  return imageTypeOfBytes(bytes) === 'png' ? 1 : REDUCE_QUALITY;
}

export function nextRate(rate: number): number {
  return rate * REDUCE_STEP;
}

export async function reduceImage(file: File, startRate: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    let rate = startRate;
    for (;;) {
      const width = Math.round(bitmap.width * rate);
      const height = Math.round(bitmap.height * rate);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (context === null) {
        return file;
      }
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((done) => {
        canvas.toBlob(done, 'image/jpeg', REDUCE_QUALITY);
      });
      if (blob === null) {
        return file;
      }
      if (blob.size < MAX_UPLOAD_SIZE || rate < 0.05) {
        return blob;
      }
      rate = nextRate(rate);
    }
  } finally {
    bitmap.close();
  }
}
