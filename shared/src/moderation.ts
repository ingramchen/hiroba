import { MEDIA_ROUTE_PREFIX } from './clientConfig.js';

export const MODERATION_STATES = ['pending', 'pass', 'flag', 'error'] as const;

export type ModerationState = (typeof MODERATION_STATES)[number];

export interface ModerationMessagePayload {
  key: string;
  state: ModerationState;
}

export type ModerationStates = Record<string, ModerationState>;

const STATE_SET: ReadonlySet<string> = new Set(MODERATION_STATES);

export function isModerationState(value: unknown): value is ModerationState {
  return typeof value === 'string' && STATE_SET.has(value);
}

export function moderationKeyOf(url: string): string | null {
  const marker = `${MEDIA_ROUTE_PREFIX}/`;
  const at = url.indexOf(marker);
  if (at < 0) {
    return null;
  }
  const rest = url.slice(at + marker.length);
  return rest.length === 0 || rest.includes('..') ? null : rest;
}

export function moderationStateOf(states: ModerationStates, url: string): ModerationState {
  const key = moderationKeyOf(url);
  if (key === null) {
    return 'pass';
  }
  return states[key] ?? 'pass';
}

export function isMasked(state: ModerationState): boolean {
  return state !== 'pass';
}

export function opensOnClick(state: ModerationState): boolean {
  return state === 'flag' || state === 'error';
}
