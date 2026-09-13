import type { PosterView } from './poster.js';
import type { VoteView } from './vote.js';
import type { SquareChatter } from './wire.js';

export const CLIENT_EVENT_TYPES = ['CHAT_MESSAGE', 'KEKE_MESSAGE', 'DELETE_MEDIA'] as const;

export const SERVER_EVENT_TYPES = [
  'SYSTEM_MESSAGE',
  'FORBID_MESSAGE',
  'VOTE_MESSAGE',
  'NO_OF_CROWD_MESSAGE',
  'MIN_SQUARE_KERMA_MESSAGE',
  'POSTER_MESSAGE',
  'BURN_MESSAGE',
  'SUCK_EURO_AIR_MESSAGE',
  'MODERATION_MESSAGE',
] as const;

export const FORBIDDEN_VISIBLE_EVENT_TYPES = [
  'SYSTEM_MESSAGE',
  'FORBID_MESSAGE',
  'BURN_MESSAGE',
  'SUCK_EURO_AIR_MESSAGE',
  'MODERATION_MESSAGE',
] as const;

export type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];
export type ServerEventType = (typeof SERVER_EVENT_TYPES)[number];
export type EventType = ClientEventType | ServerEventType;

export interface MessageEventPayload {
  replyPublicIds?: string[];
  [key: string]: unknown;
}

export interface MessageEvent {
  eventType: EventType;
  senderPublicId: string;
  senderNickName: string;
  senderColorToken: string | null;
  anchorUsername: string;
  content: string;
  date: number;
  payload?: MessageEventPayload;
}

export interface SystemMessagePayload {
  redirect?: boolean;
  reconnect?: boolean;
  message?: string;
}

export interface SuckEuroAirPayload {
  sucker: {
    publicId: string;
    nickname: string;
    colorToken?: string | null;
  };
}

export interface ForbidMessagePayload {
  senderName: string;
  unforbid: boolean;
  publicIds: string[];
  chatters: SquareChatter[];
}

export interface BurnMessagePayload {
  senderName: string;
  targetPublicId: string;
  targetNickname: string;
  kerma: number;
}

export interface MinKermaMessagePayload {
  minKermaValue: number;
}

export interface PosterMessagePayload {
  poster: PosterView;
}

export interface VoteMessagePayload {
  voting: VoteView;
}

const CLIENT_SET: ReadonlySet<string> = new Set(CLIENT_EVENT_TYPES);
const SERVER_SET: ReadonlySet<string> = new Set(SERVER_EVENT_TYPES);

export function isClientEventType(value: unknown): value is ClientEventType {
  return typeof value === 'string' && CLIENT_SET.has(value);
}

export function isServerEventType(value: unknown): value is ServerEventType {
  return typeof value === 'string' && SERVER_SET.has(value);
}

const FORBIDDEN_VISIBLE_SET: ReadonlySet<string> = new Set(FORBIDDEN_VISIBLE_EVENT_TYPES);

export function isVisibleToForbidden(eventType: EventType): boolean {
  return FORBIDDEN_VISIBLE_SET.has(eventType);
}

export function isUrlRestricted(eventType: EventType): boolean {
  return eventType === 'KEKE_MESSAGE';
}
