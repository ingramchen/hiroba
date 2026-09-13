import {
  CLOSE_CODES,
  LIMITS,
  PROTOCOL_VERSION,
  type ChatterAuth,
  type ClientFrame,
  type ErrorCode,
} from '@hiroba/shared';
import type { Services } from '../types.js';
import type { Room } from './room.js';
import type { SocketRef } from './types.js';

export interface ConnectionState {
  room: Room | null;
  auth: ChatterAuth | null;
  nickname: string;
}

export function newConnectionState(): ConnectionState {
  return { room: null, auth: null, nickname: '' };
}

export function parseClientFrame(raw: string): ClientFrame | null {
  if (new TextEncoder().encode(raw).byteLength > LIMITS.frameBytes) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    const frame = value as ClientFrame;
    return typeof frame.t === 'string' ? frame : null;
  } catch {
    return null;
  }
}

export function failConnection(ref: SocketRef, code: ErrorCode, fatal: boolean): void {
  ref.send({ t: 'error', code, fatal });
  if (fatal) {
    ref.close(CLOSE_CODES.policy);
  }
}

export function rehome(
  services: Services,
  state: ConnectionState,
  ref: SocketRef,
  topic: string,
  ips: string,
): void {
  if (state.room === null || !state.room.disposed || state.auth === null) {
    return;
  }
  const room = services.hub.get(topic);
  state.room = room;
  room.admit(ref, state.auth, state.nickname, ips);
}

export function handleClientFrame(
  services: Services,
  state: ConnectionState,
  ref: SocketRef,
  topic: string,
  ips: string,
  frame: ClientFrame,
): void {
  rehome(services, state, ref, topic, ips);
  switch (frame.t) {
    case 'ping':
      ref.send({ t: 'pong', serverTime: services.clock.now() });
      return;
    case 'sub': {
      if (state.room !== null) {
        failConnection(ref, 'ALREADY_SUBSCRIBED', false);
        return;
      }
      if (frame.v !== PROTOCOL_VERSION) {
        failConnection(ref, 'PROTOCOL_VERSION', true);
        return;
      }
      const auth: ChatterAuth | null = services.identities.verify(
        typeof frame.token === 'string' ? frame.token : '',
        services.clock.now(),
        topic,
      );
      if (auth === null) {
        failConnection(ref, 'INVALID_TOKEN', true);
        return;
      }
      const room = services.hub.get(topic);
      state.room = room;
      state.auth = auth;
      state.nickname = typeof frame.nickname === 'string' ? frame.nickname : '';
      room.join(ref, auth, state.nickname, ips);
      return;
    }
    case 'nickname': {
      if (state.room === null) {
        failConnection(ref, 'NOT_SUBSCRIBED', false);
        return;
      }
      state.nickname = typeof frame.nickname === 'string' ? frame.nickname : '';
      state.room.updateNickname(ref.session, state.nickname);
      return;
    }
    case 'send': {
      if (state.room === null) {
        failConnection(ref, 'NOT_SUBSCRIBED', false);
        return;
      }
      const error = state.room.send(ref.session, frame);
      if (error !== null) {
        failConnection(ref, error, false);
      }
      return;
    }
    default:
      failConnection(ref, 'BAD_FRAME', true);
  }
}
