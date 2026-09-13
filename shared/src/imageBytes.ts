export const IMAGE_TYPES = ['jpeg', 'gif', 'png', 'bmp', 'webp'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

function matches(bytes: Uint8Array, at: number, signature: readonly number[]): boolean {
  if (bytes.length < at + signature.length) {
    return false;
  }
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[at + i] !== signature[i]) {
      return false;
    }
  }
  return true;
}

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const GIF87A = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
const GIF89A = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];
const BMP = [0x42, 0x4d];

// the type of an image is decided from its bytes, never from its name or the
// content-type it was uploaded under -- both lie (a webp labelled image/png).
// The server decides what to store and the client decides whether to reduce,
// so the two must agree on every input; one declaration guarantees that.
export function imageTypeOfBytes(bytes: Uint8Array): ImageType | null {
  if (matches(bytes, 0, JPEG)) {
    return 'jpeg';
  }
  if (matches(bytes, 0, PNG)) {
    return 'png';
  }
  if (matches(bytes, 0, GIF87A) || matches(bytes, 0, GIF89A)) {
    return 'gif';
  }
  if (matches(bytes, 0, RIFF) && matches(bytes, 8, WEBP)) {
    return 'webp';
  }
  if (matches(bytes, 0, BMP)) {
    return 'bmp';
  }
  return null;
}
