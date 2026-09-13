import { cookieDrop, cookieKeys, cookieRead, cookieWrite, localStorageUsable } from './cookieStore';

const KEYS = {
  anonymousId: 'hiroba.anonymousId',
  nickname: 'hiroba.nickname',
  washGuard: 'hiroba.washGuard',
  unlimited: 'hiroba.unlimited',
  mediaFlowMode: 'hiroba.mediaFlowMode',
  smileyMode: 'hiroba.smileyMode',
  smileyCategory: 'hiroba.smileyCategory',
  recentSmiley: 'hiroba.recentSmiley',
  readPoster: 'hiroba.beenReadStickyPosters',
  posterDraft: 'hiroba.draftPoster',
  autoPlayVideo: 'hiroba.auto_play_video',
} as const;

let usable: boolean | null = null;

function localFirst(): boolean {
  usable ??= localStorageUsable();
  return usable;
}

function read(key: string): string | null {
  if (!localFirst()) {
    return cookieRead(key);
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return cookieRead(key);
  }
}

function write(key: string, value: string): void {
  if (!localFirst()) {
    cookieWrite(key, value);
    return;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    cookieWrite(key, value);
  }
}

function drop(key: string): void {
  if (!localFirst()) {
    cookieDrop(key);
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    cookieDrop(key);
  }
}

export function smileyModeKey(scope: string): string {
  return 'hiroba.' + scope + '.smileySelectorMode';
}

export function loadScopedSmileyMode(scope: string): string | null {
  return read(smileyModeKey(scope));
}

export function saveScopedSmileyMode(scope: string, value: string): void {
  write(smileyModeKey(scope), value);
}

export function loadAnonymousId(): string | null {
  return read(KEYS.anonymousId);
}

export function saveAnonymousId(value: string | null): void {
  if (value === null || value.length === 0) {
    return;
  }
  write(KEYS.anonymousId, value);
}

export function loadNickname(): string {
  return read(KEYS.nickname) ?? '';
}

export function saveNickname(value: string): void {
  if (value.length === 0) {
    drop(KEYS.nickname);
    return;
  }
  write(KEYS.nickname, value);
}

export function loadWashGuardLock(): number {
  const raw = read(KEYS.washGuard);
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export function saveWashGuardLock(until: number): void {
  write(KEYS.washGuard, String(until));
}

export function isUnlimitedList(): boolean {
  return read(KEYS.unlimited) === 'true';
}

export function startAtKey(topic: string): string {
  return 'hiroba.startAt.' + topic;
}

export function saveStartIpsHash(topic: string, ipsHash: string, now: number): void {
  write(startAtKey(topic), ipsHash + ':' + String(now));
}

export function loadStartIpsHash(topic: string): string | null {
  return read(startAtKey(topic));
}

export const START_IPS_EXPIRE_MS = 10 * 24 * 60 * 60 * 1000;

function listKeys(): string[] {
  if (!localFirst()) {
    return cookieKeys();
  }
  const keys: string[] = [];
  try {
    const storage = window.localStorage;
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key !== null) {
        keys.push(key);
      }
    }
  } catch {
    return cookieKeys();
  }
  return keys;
}

export function cleanupStartIps(now: number): void {
  const keys = listKeys();
  for (const key of keys) {
    if (!key.startsWith('hiroba.startAt.')) {
      continue;
    }
    const createTime = Number(read(key)?.split(':')[1] ?? Number.NaN);
    if (!Number.isNaN(createTime) && createTime + START_IPS_EXPIRE_MS < now) {
      drop(key);
    }
  }
}

export function loadMediaFlowMode(): string | null {
  return read(KEYS.mediaFlowMode);
}

export function saveMediaFlowMode(value: string): void {
  write(KEYS.mediaFlowMode, value);
}

export function loadSmileyMode(): string | null {
  return read(KEYS.smileyMode);
}

export function saveSmileyMode(value: string): void {
  write(KEYS.smileyMode, value);
}

export function loadSmileyCategory(): string | null {
  return read(KEYS.smileyCategory);
}

export function saveSmileyCategory(value: string): void {
  write(KEYS.smileyCategory, value);
}

export function loadRecentSmiley(): string | null {
  return read(KEYS.recentSmiley);
}

export function saveRecentSmiley(names: readonly string[]): void {
  write(KEYS.recentSmiley, JSON.stringify(names));
}

export const READ_POSTER_MAX = 30;

export function parseReadPosters(raw: string | null): Map<string, string> {
  const found = new Map<string, string>();
  if (raw === null || raw.trim().length === 0) {
    return found;
  }
  let root: unknown;
  try {
    root = JSON.parse(raw);
  } catch {
    return found;
  }
  if (typeof root !== 'object' || root === null || Array.isArray(root)) {
    return found;
  }
  for (const [key, value] of Object.entries(root as Record<string, unknown>)) {
    if (typeof value === 'string') {
      found.set(key, value);
    }
  }
  return found;
}

export function putReadPoster(
  posters: Map<string, string>,
  topic: string,
  posterId: string | null,
): Map<string, string> {
  if (posterId === null) {
    posters.delete(topic);
    return posters;
  }
  posters.set(topic, posterId);
  while (posters.size > READ_POSTER_MAX) {
    const eldest = posters.keys().next();
    if (eldest.done === true) {
      break;
    }
    posters.delete(eldest.value);
  }
  return posters;
}

export function loadReadPoster(topic: string): string | null {
  return parseReadPosters(read(KEYS.readPoster)).get(topic) ?? null;
}

export function saveReadPoster(topic: string, posterId: string | null): void {
  const posters = putReadPoster(parseReadPosters(read(KEYS.readPoster)), topic, posterId);
  write(KEYS.readPoster, JSON.stringify(Object.fromEntries(posters)));
}

export function loadPosterDraft(topic: string): string {
  return read(KEYS.posterDraft + topic) ?? '';
}

export function savePosterDraft(topic: string, content: string | null): void {
  if (content === null || content.length === 0) {
    drop(KEYS.posterDraft + topic);
    return;
  }
  write(KEYS.posterDraft + topic, content);
}

export function loadAutoPlayVideo(): string | null {
  return read(KEYS.autoPlayVideo);
}

export function saveAutoPlayVideo(value: string): void {
  write(KEYS.autoPlayVideo, value);
}
