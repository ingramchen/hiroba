import { isClientEventType, type MessageEvent, type MessageEventPayload } from './events.js';
import { LIMITS } from './limits.js';
import type { ErrorCode, SendFrame } from './wire.js';

export interface ChatterAuth {
  publicId: string;
  colorToken: string | null;
  anchorUsername: string;
  kermaEnough: boolean;
  chatFreeze: boolean;
  anchorSquare: boolean;
}

export type ValidationResult =
  | { ok: true; event: MessageEvent }
  | { ok: false; code: Extract<ErrorCode, 'INVALID_MESSAGE' | 'CHAT_FREEZE' | 'NOT_ANCHOR'> };

function replyPublicIds(payload: MessageEventPayload | undefined): string[] {
  const ids = payload?.replyPublicIds;
  return Array.isArray(ids) ? ids : [];
}

export function validateClientSend(
  frame: SendFrame,
  auth: ChatterAuth,
  date: number,
): ValidationResult {
  if (auth.chatFreeze) {
    return { ok: false, code: 'CHAT_FREEZE' };
  }
  if (!isClientEventType(frame.eventType)) {
    return { ok: false, code: 'INVALID_MESSAGE' };
  }
  if (frame.senderPublicId !== auth.publicId) {
    return { ok: false, code: 'INVALID_MESSAGE' };
  }
  if (frame.anchorUsername !== auth.anchorUsername) {
    return { ok: false, code: 'INVALID_MESSAGE' };
  }
  if (auth.anchorSquare && auth.anchorUsername.length === 0 && frame.eventType === 'CHAT_MESSAGE') {
    return { ok: false, code: 'NOT_ANCHOR' };
  }
  if (replyPublicIds(frame.payload).length > LIMITS.replyPublicIdsServer) {
    return { ok: false, code: 'INVALID_MESSAGE' };
  }
  if (typeof frame.senderNickName !== 'string' || typeof frame.content !== 'string') {
    return { ok: false, code: 'INVALID_MESSAGE' };
  }
  if (frame.senderNickName.length > LIMITS.nicknameServer) {
    return { ok: false, code: 'INVALID_MESSAGE' };
  }
  if (frame.content.length > LIMITS.contentServer) {
    return { ok: false, code: 'INVALID_MESSAGE' };
  }
  const event: MessageEvent = {
    eventType: frame.eventType,
    senderPublicId: auth.publicId,
    senderNickName: frame.senderNickName,
    senderColorToken: auth.colorToken,
    anchorUsername: auth.anchorUsername,
    content: frame.content,
    date,
  };
  if (frame.payload !== undefined) {
    event.payload = frame.payload;
  }
  return { ok: true, event };
}
