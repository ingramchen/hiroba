import type { ClientEventType, MessageEvent, MessageEventPayload } from './events.js';

export const PROTOCOL_VERSION = 1;

export interface SubFrame {
  t: 'sub';
  v: number;
  token: string;
  nickname: string;
}

export interface SendFrame {
  t: 'send';
  eventType: ClientEventType;
  senderPublicId: string;
  senderNickName: string;
  anchorUsername: string;
  content: string;
  payload?: MessageEventPayload;
}

export interface NicknameFrame {
  t: 'nickname';
  nickname: string;
}

export interface PingFrame {
  t: 'ping';
}

export type ClientFrame = SubFrame | SendFrame | NicknameFrame | PingFrame;

export interface SquareChatter {
  publicId: string;
  nickname: string;
  colorToken: string | null;
}

export interface ReadyFrame {
  t: 'ready';
  v: number;
  topic: string;
  publicId: string;
  colorToken: string | null;
  serverTime: number;
  crowd: number;
  history: MessageEvent[];
}

export interface EventFrame {
  t: 'event';
  event: MessageEvent;
}

export interface CrowdFrame {
  t: 'crowd';
  crowd: number;
}

export interface PongFrame {
  t: 'pong';
  serverTime: number;
}

export const ERROR_CODES = [
  'PROTOCOL_VERSION',
  'BAD_FRAME',
  'NOT_SUBSCRIBED',
  'ALREADY_SUBSCRIBED',
  'INVALID_TOKEN',
  'INVALID_MESSAGE',
  'CHAT_FREEZE',
  'SEND_TOO_FAST',
  'WASH_GUARD',
  'FORBIDDEN',
  'NOT_ANCHOR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorFrame {
  t: 'error';
  code: ErrorCode;
  fatal: boolean;
}

export type ServerFrame = ReadyFrame | EventFrame | CrowdFrame | PongFrame | ErrorFrame;

export const CLOSE_CODES = {
  goingAway: 1001,
  protocol: 1002,
  policy: 1008,
  overloaded: 1013,
} as const;
