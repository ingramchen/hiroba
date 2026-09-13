import type { ChatterAuth, MessageEvent, ServerFrame } from '@hiroba/shared';

export interface Clock {
  now(): number;
}

export type TimerHandle = { cancelled: boolean };

export interface Timers {
  schedule(fn: () => void, delayMs: number): TimerHandle;
  cancel(handle: TimerHandle): void;
}

export interface SocketRef {
  readonly session: string;
  send(frame: ServerFrame): void;
  sendEncoded(encoded: string): void;
  close(code: number): void;
}

export interface LiveSquare {
  topic: string;
  crowd: number;
  lastAccess: number;
  latestMessages: MessageEvent[];
}

export interface RoomStore {
  ensureSquare(topic: string, now: number): void;
  loadRing(topic: string): MessageEvent[];
  appendMessage(topic: string, event: MessageEvent): void;
  writeLive(live: LiveSquare): void;
  isForbidden(topic: string, ips: string, publicId: string): boolean;
}

export interface Chatter {
  auth: ChatterAuth;
  nickname: string;
}

export const RESERVED_TOPIC = 'watchCatStompProbe';

export const systemClock: Clock = { now: () => Date.now() };

export const systemTimers: Timers = {
  schedule(fn, delayMs) {
    const handle: TimerHandle = { cancelled: false };
    const id = setTimeout(() => {
      if (!handle.cancelled) {
        fn();
      }
    }, delayMs);
    if (typeof id === 'object' && id !== null && 'unref' in id) {
      (id as { unref: () => void }).unref();
    }
    Object.defineProperty(handle, 'id', { value: id, enumerable: false });
    return handle;
  },
  cancel(handle) {
    handle.cancelled = true;
    const id = (handle as { id?: NodeJS.Timeout }).id;
    if (id !== undefined) {
      clearTimeout(id);
    }
  },
};
