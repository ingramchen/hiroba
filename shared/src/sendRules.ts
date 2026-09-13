import type { ClientEventType } from './events.js';
import { DEGRADE_MAX_LENGTH } from './quota.js';

export const SEND_RULE_SLACK_MS = 2000;
export const DELETE_MEDIA_WINDOW_MS = 60_000;
export const DELETE_MEDIA_PER_WINDOW = 20;

export function isMeteredSend(eventType: ClientEventType): boolean {
  return eventType !== 'DELETE_MEDIA';
}

export function tierAllows(
  eventType: ClientEventType,
  contentLength: number,
  kermaEnough: boolean,
): boolean {
  if (kermaEnough || eventType === 'DELETE_MEDIA') {
    return true;
  }
  return eventType === 'KEKE_MESSAGE' && contentLength <= DEGRADE_MAX_LENGTH;
}
