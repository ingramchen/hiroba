export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function javaHashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return hash;
}

export function colorHash(publicId: string, colorToken: string | null): number {
  if (colorToken === null) {
    return javaHashCode(publicId);
  }
  let result = 1;
  result = (Math.imul(31, result) + javaHashCode(colorToken)) | 0;
  result = (Math.imul(31, result) + javaHashCode(publicId)) | 0;
  return result;
}

const MAX_RANGE = 70;
const INT_MIN = -2_147_483_648;

export function percentToRange255(value: number): number {
  return Math.min(255, Math.max(0, Math.round(Math.fround(value * Math.fround(2.55)))));
}

export function calculateColor(publicId: string, colorToken: string | null): Rgb {
  const hashCode = colorHash(publicId, colorToken);
  const hash = hashCode === INT_MIN ? 0 : Math.abs(hashCode);
  return {
    r: percentToRange255(hash % MAX_RANGE),
    g: percentToRange255(Math.trunc(hash / 100) % MAX_RANGE),
    b: percentToRange255(Math.trunc(Math.trunc(hash / 100) / 100) % MAX_RANGE),
  };
}

export function rgbCss(rgb: Rgb): string {
  return `rgb(${rgb.r},${rgb.g},${rgb.b})`;
}

export function rgbHex(rgb: Rgb): string {
  return [rgb.r, rgb.g, rgb.b]
    .map((value) => value.toString(16).toUpperCase().padStart(2, '0'))
    .join('');
}
