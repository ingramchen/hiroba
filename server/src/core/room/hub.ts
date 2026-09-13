import type { MessageEvent } from '@hiroba/shared';
import { Room, type RoomDeps } from './room.js';
import { systemClock, systemTimers, type Clock, type RoomStore, type Timers } from './types.js';

export interface HubOptions {
  store: RoomStore;
  blockedMedia?: (content: string) => boolean;
  clock?: Clock;
  timers?: Timers;
  maxRooms?: number;
  idleMs?: number;
}

export const DEFAULT_MAX_ROOMS = 200;
export const DEFAULT_IDLE_MS = 24 * 60 * 60 * 1000;

export class RoomHub {
  private readonly rooms = new Map<string, Room>();
  private readonly deps: RoomDeps;
  private readonly maxRooms: number;
  private readonly idleMs: number;

  constructor(options: HubOptions) {
    this.deps = {
      store: options.store,
      clock: options.clock ?? systemClock,
      timers: options.timers ?? systemTimers,
      blockedMedia: options.blockedMedia ?? (() => false),
    };
    this.maxRooms = options.maxRooms ?? DEFAULT_MAX_ROOMS;
    this.idleMs = options.idleMs ?? DEFAULT_IDLE_MS;
  }

  get size(): number {
    return this.rooms.size;
  }

  has(topic: string): boolean {
    return this.rooms.has(topic);
  }

  get(topic: string): Room {
    const existing = this.rooms.get(topic);
    if (existing !== undefined) {
      return existing;
    }
    const now = this.deps.clock.now();
    this.deps.store.ensureSquare(topic, now);
    const room = new Room(topic, this.deps);
    this.rooms.set(topic, room);
    room.writeLive();
    return room;
  }

  topics(): string[] {
    return [...this.rooms.keys()];
  }

  remove(topic: string): void {
    const room = this.rooms.get(topic);
    if (room === undefined) {
      return;
    }
    this.rooms.delete(topic);
    room.dispose();
  }

  publish(topic: string, event: MessageEvent): void {
    this.get(topic).publish(event);
  }

  totalCrowd(): number {
    let total = 0;
    for (const room of this.rooms.values()) {
      total += room.noOfCrowd;
    }
    return total;
  }

  evict(): string[] {
    if (this.rooms.size <= this.maxRooms) {
      return [];
    }
    const cutoff = this.deps.clock.now() - this.idleMs;
    const evicted: string[] = [];
    const candidates = [...this.rooms.values()]
      .filter((room) => room.lastAccess < cutoff)
      .toSorted((a, b) => a.lastAccess - b.lastAccess);
    for (const room of candidates) {
      if (this.rooms.size <= this.maxRooms) {
        break;
      }
      room.dispose();
      this.rooms.delete(room.topic);
      evicted.push(room.topic);
    }
    return evicted;
  }

  purgeThrottles(): void {
    for (const room of this.rooms.values()) {
      room.purgeThrottle();
    }
  }

  dispose(): void {
    for (const room of this.rooms.values()) {
      room.dispose();
    }
    this.rooms.clear();
  }
}
