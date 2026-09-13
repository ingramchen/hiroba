export { IMAGE_TYPES, imageTypeOfBytes, type ImageType } from '@hiroba/shared';

const CONTENT_TYPE_BY_SUFFIX: Record<string, string> = {
  csv: 'text/csv',
  txt: 'text/txt',
  xls: 'application/vnd.ms-excel',
  doc: 'application/msword',
  pdf: 'application/pdf',
  bin: 'application/octet-stream',
  html: 'text/html',
  htm: 'text/html',
  xml: 'text/xml',
  zip: 'application/zip',
  gif: 'image/gif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  swf: 'application/x-shockwave-flash',
  js: 'text/javascript',
  css: 'text/css',
  htc: 'text/x-component',
  bmp: 'image/bmp',
  webp: 'image/webp',
  mp4: 'video/mp4',
};

export function contentTypeForSuffix(suffix: string): string | null {
  return CONTENT_TYPE_BY_SUFFIX[suffix.trim().toLowerCase()] ?? null;
}
