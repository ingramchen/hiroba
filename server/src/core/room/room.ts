import {
  LIMITS,
  isMeteredSend,
  isVisibleToForbidden,
  PROTOCOL_VERSION,
  validateClientSend,
  type ChatterAuth,
  type ErrorCode,
  type MessageEvent,
  type ReadyFrame,
  type SendFrame,
  type ServerFrame,
  type SquareChatter,
} from '@hiroba/shared';
import { CrowdBroadcaster } from './crowd.js';
import { SendPolicy } from './sendPolicy.js';
import {
  RESERVED_TOPIC,
  type Chatter,
  type Clock,
  type RoomStore,
  type SocketRef,
  type Timers,
} from './types.js';

interface Member {
  ref: SocketRef;
  chatter: Chatter;
  forbidden: boolean;
}

export interface RoomDeps {
  store: RoomStore;
  clock: Clock;
  timers: Timers;
  blockedMedia: (content: string) => boolean;
}

function visibleToForbidden(frame: ServerFrame): boolean {
  if (frame.t === 'crowd') {
    return false;
  }
  return frame.t !== 'event' || isVisibleToForbidden(frame.event.eventType);
}

function boundNickname(raw: unknown): string {
  const value = typeof raw === 'string' ? raw : '';
  return value.length > LIMITS.nicknameServer ? value.slice(0, LIMITS.nicknameServer) : value;
}

export class Room {
  private readonly ring: MessageEvent[];
  private readonly members = new Map<string, Member>();
  private readonly crowd = new Map<string, Map<string, Chatter>>();
  private readonly policy = new SendPolicy();
  private readonly broadcaster: CrowdBroadcaster;
  private accessTime: number;
  private disposedFlag = false;

  constructor(
    readonly topic: string,
    private readonly deps: RoomDeps,
  ) {
    this.ring = deps.store.loadRing(topic).slice(-LIMITS.historyRing);
    this.accessTime = deps.clock.now();
    this.broadcaster = new CrowdBroadcaster(deps.timers, (crowd) => {
      this.policy.crowdChanged(crowd, deps.clock.now());
      this.broadcast({ t: 'crowd', crowd });
      this.writeLive();
    });
  }

  get noOfCrowd(): number {
    return this.crowd.size;
  }

  get noOfSockets(): number {
    return this.members.size;
  }

  get lastAccess(): number {
    return this.accessTime;
  }

  get disposed(): boolean {
    return this.disposedFlag;
  }

  get history(): MessageEvent[] {
    return [...this.ring];
  }

  crowdView(): SquareChatter[] {
    const seen = new Map<string, SquareChatter>();
    for (const sessions of this.crowd.values()) {
      for (const chatter of sessions.values()) {
        seen.set(chatter.auth.publicId, {
          publicId: chatter.auth.publicId,
          nickname: chatter.nickname,
          colorToken: chatter.auth.colorToken,
        });
      }
    }
    return [...seen.values()];
  }

  private enroll(ref: SocketRef, auth: ChatterAuth, nickname: string, ips: string): boolean {
    const chatter: Chatter = { auth, nickname: boundNickname(nickname) };
    const forbidden = this.deps.store.isForbidden(this.topic, ips, auth.publicId);
    this.members.set(ref.session, { ref, chatter, forbidden });
    let sessions = this.crowd.get(auth.publicId);
    if (sessions === undefined) {
      sessions = new Map();
      this.crowd.set(auth.publicId, sessions);
    }
    sessions.set(ref.session, chatter);
    this.policy.register(auth, this.noOfCrowd, this.deps.clock.now());
    return forbidden;
  }

  admit(ref: SocketRef, auth: ChatterAuth, nickname: string, ips = ''): void {
    this.enroll(ref, auth, nickname, ips);
    this.broadcaster.changed(this.noOfCrowd);
  }

  join(ref: SocketRef, auth: ChatterAuth, nickname: string, ips = ''): void {
    const forbidden = this.enroll(ref, auth, nickname, ips);
    const ready: ReadyFrame = {
      t: 'ready',
      v: PROTOCOL_VERSION,
      topic: this.topic,
      publicId: auth.publicId,
      colorToken: auth.colorToken,
      serverTime: this.deps.clock.now(),
      crowd: this.noOfCrowd,
      history: forbidden ? [] : this.history,
    };
    ref.send(ready);
    this.broadcaster.changed(this.noOfCrowd);
  }

  leave(session: string): void {
    const member = this.members.get(session);
    if (member === undefined) {
      return;
    }
    this.members.delete(session);
    const publicId = member.chatter.auth.publicId;
    const sessions = this.crowd.get(publicId);
    if (sessions !== undefined) {
      sessions.delete(session);
      if (sessions.size === 0) {
        this.crowd.delete(publicId);
        this.policy.release(publicId, this.deps.clock.now());
      }
    }
    this.broadcaster.changed(this.noOfCrowd);
  }

  updateNickname(session: string, nickname: string): void {
    const member = this.members.get(session);
    if (member === undefined) {
      return;
    }
    const bounded = boundNickname(nickname);
    member.chatter.nickname = bounded;
    const sessions = this.crowd.get(member.chatter.auth.publicId);
    if (sessions !== undefined) {
      for (const chatter of sessions.values()) {
        chatter.nickname = bounded;
      }
    }
  }

  setForbidden(publicIds: readonly string[], forbidden: boolean): void {
    const targets = new Set(publicIds);
    for (const member of this.members.values()) {
      if (targets.has(member.chatter.auth.publicId)) {
        member.forbidden = forbidden;
      }
    }
  }

  refreshAuth(publicId: string, patch: Pick<ChatterAuth, 'kermaEnough' | 'chatFreeze'>): void {
    const sessions = this.crowd.get(publicId);
    if (sessions === undefined) {
      return;
    }
    let changed = false;
    for (const chatter of sessions.values()) {
      if (
        chatter.auth.kermaEnough !== patch.kermaEnough ||
        chatter.auth.chatFreeze !== patch.chatFreeze
      ) {
        chatter.auth = { ...chatter.auth, ...patch };
        changed = true;
      }
    }
    const first = sessions.values().next();
    if (changed && !first.done) {
      this.policy.register(first.value.auth, this.noOfCrowd, this.deps.clock.now());
    }
  }

  send(session: string, frame: SendFrame): ErrorCode | null {
    const member = this.members.get(session);
    if (member === undefined) {
      return 'NOT_SUBSCRIBED';
    }
    if (member.forbidden) {
      return 'FORBIDDEN';
    }
    const auth = member.chatter.auth;
    const now = this.deps.clock.now();
    if (auth.chatFreeze) {
      return 'CHAT_FREEZE';
    }
    const result = validateClientSend(frame, auth, now);
    if (!result.ok) {
      return result.code;
    }
    if (isMeteredSend(frame.eventType) && this.deps.blockedMedia(result.event.content)) {
      return 'INVALID_MESSAGE';
    }
    const verdict = this.policy.check(auth, frame, now);
    if (verdict !== null) {
      return verdict;
    }
    this.publish(result.event);
    this.policy.accept(auth, frame, now);
    return null;
  }

  publish(event: MessageEvent): void {
    this.append(event);
    this.broadcast({ t: 'event', event });
  }

  private append(event: MessageEvent): void {
    this.accessTime = this.deps.clock.now();
    if (this.disposedFlag || this.topic === RESERVED_TOPIC) {
      return;
    }
    this.ring.push(event);
    while (this.ring.length > LIMITS.historyRing) {
      this.ring.shift();
    }
    this.deps.store.appendMessage(this.topic, event);
    this.writeLive();
  }

  broadcast(frame: ServerFrame): void {
    let encoded: string | null = null;
    for (const member of this.members.values()) {
      if (member.forbidden && !visibleToForbidden(frame)) {
        continue;
      }
      encoded ??= JSON.stringify(frame);
      member.ref.sendEncoded(encoded);
    }
  }

  writeLive(): void {
    if (this.disposedFlag || this.topic === RESERVED_TOPIC) {
      return;
    }
    this.deps.store.writeLive({
      topic: this.topic,
      crowd: this.noOfCrowd,
      lastAccess: this.accessTime,
      latestMessages: this.ring.slice(-LIMITS.homeListMessages).toReversed(),
    });
  }

  purgeThrottle(): void {
    this.policy.purge(new Set(this.crowd.keys()));
  }

  dispose(): void {
    this.disposedFlag = true;
    this.broadcaster.cancel();
    this.members.clear();
    this.crowd.clear();
    this.policy.purge(new Set());
  }
}
