import { STORE_TOO_LARGE_TYPE, type UploadMediaFields } from '@hiroba/shared';
import type { Translator } from '../i18n';
import { uploadMedia } from '../live/api';
import { initialRate, isAnimated, isReduceSupported, reduceImage, shouldReduce } from './reduce';

export const REDUCED_BLOB_NAME = 'blob';
export const PASTE_REDUCE_RATE = 1;

export interface UploadOutcome {
  ok: boolean;
  url: string;
  tooLarge?: boolean;
  limitInBytes?: number;
}

export function uploadFailedMessage(i18n: Translator, outcome: UploadOutcome): string {
  if (outcome.tooLarge !== true || outcome.limitInBytes === undefined) {
    return i18n.t('uploadFailed');
  }
  return i18n.t('uploadTooLarge', Math.max(1, Math.round(outcome.limitInBytes / (1024 * 1024))));
}

export class UploadedImageCache {
  private readonly byKey = new Map<string, string>();

  static keyOf(file: File): string {
    return `${file.name}:${String(file.size)}:${String(file.lastModified)}`;
  }

  find(file: File): string | null {
    return this.byKey.get(UploadedImageCache.keyOf(file)) ?? null;
  }

  add(file: File, url: string): void {
    this.byKey.set(UploadedImageCache.keyOf(file), url);
  }
}

async function send(
  body: Blob,
  filename: string,
  fields: UploadMediaFields | null,
): Promise<UploadOutcome> {
  const result = await uploadMedia(body, filename, fields);
  if (result.ok) {
    return { ok: true, url: result.value.url };
  }
  if (result.type !== STORE_TOO_LARGE_TYPE || result.limitInBytes === undefined) {
    return { ok: false, url: '' };
  }
  return { ok: false, url: '', tooLarge: true, limitInBytes: result.limitInBytes };
}

async function reduced(file: File, startRate: number): Promise<Blob | null> {
  try {
    const blob = await reduceImage(file, startRate);
    return blob === file ? null : blob;
  } catch {
    return null;
  }
}

export async function uploadImageFile(
  file: File,
  fields: UploadMediaFields | null,
): Promise<UploadOutcome> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const blob = shouldReduce(bytes, file.size) ? await reduced(file, initialRate(bytes)) : null;
  return blob === null ? send(file, file.name, fields) : send(blob, REDUCED_BLOB_NAME, fields);
}

export async function uploadPastedImage(
  file: File,
  fields: UploadMediaFields | null,
): Promise<UploadOutcome> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const reducible = isReduceSupported() && !isAnimated(bytes);
  const blob = reducible ? await reduced(file, PASTE_REDUCE_RATE) : null;
  return blob === null ? send(file, file.name, fields) : send(blob, REDUCED_BLOB_NAME, fields);
}

export function clipboardImage(items: DataTransferItemList | null): File | null {
  if (items === null) {
    return null;
  }
  for (const item of items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) {
      continue;
    }
    const file = item.getAsFile();
    if (file !== null) {
      return file;
    }
  }
  return null;
}
