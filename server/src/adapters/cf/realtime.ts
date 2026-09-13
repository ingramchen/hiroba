import { LIMITS, type ChatterAuth } from '@hiroba/shared';
import {
  failConnection,
  handleClientFrame,
  parseClientFrame,
  type ConnectionState,
} from '../../core/room/gateway.js';
import {
  queueingSocketRef,
  runTurn,
  type FlushResult,
  type Outbox,
} from '../../core/room/outbox.js';
import type { Timers } from '../../core/room/types.js';
import type { Services } from '../../core/types.js';

export interface SocketTuple {
  session: string;
  topic: string;
  ips: string;
  auth: ChatterAuth | null;
  nickname: string;
}

export interface InboundResult extends FlushResult {
  tuple: SocketTuple;
}

export function attachmentBytes(tuple: SocketTuple): number {
  return new TextEncoder().encode(JSON.stringify(tuple)).byteLength;
}

export class RealtimeApp {
  private readonly states = new Map<string, ConnectionState>();

  constructor(
    private readonly services: Services,
    private readonly outbox: Outbox,
  ) {}

  get sessions(): number {
    return this.states.size;
  }

  async turn<T>(
    topic: string | undefined,
    fn: () => T | Promise<T>,
  ): Promise<{ result: T; flushed: FlushResult }> {
    return runTurn(this.outbox, topic, fn);
  }

  // A verdict lands after the request that stored the picture has answered and
  // flushed, so its announcement would wait in the outbox for whatever turn comes
  // next. Wait for the classifier and flush once more.
  async deliverVerdicts(): Promise<void> {
    const moderation = this.services.moderation;
    if (moderation === null || moderation.pending === 0) {
      return;
    }
    await runTurn(this.outbox, undefined, () => moderation.settled());
  }

  async inbound(tuple: SocketTuple, raw: string): Promise<InboundResult> {
    const ref = queueingSocketRef(this.outbox, tuple.topic, tuple.session);
    const state = this.resume(tuple, ref);
    const { flushed } = await runTurn(this.outbox, tuple.topic, () => {
      const frame = parseClientFrame(raw);
      if (frame === null) {
        failConnection(ref, 'BAD_FRAME', true);
        return;
      }
      handleClientFrame(this.services, state, ref, tuple.topic, tuple.ips, frame);
    });
    return {
      ...flushed,
      tuple: {
        ...tuple,
        auth: state.auth,
        nickname: state.nickname.slice(0, LIMITS.nicknameServer),
      },
    };
  }

  async readmit(tuples: readonly SocketTuple[]): Promise<FlushResult> {
    const { flushed } = await runTurn(this.outbox, undefined, () => {
      for (const tuple of tuples) {
        if (tuple.auth === null || this.states.has(tuple.session)) {
          continue;
        }
        this.resume(tuple, queueingSocketRef(this.outbox, tuple.topic, tuple.session));
      }
    });
    return flushed;
  }

  async disconnect(tuple: SocketTuple): Promise<FlushResult> {
    const state = this.states.get(tuple.session);
    this.states.delete(tuple.session);
    const { flushed } = await runTurn(this.outbox, tuple.topic, () => {
      if (state?.room != null) {
        state.room.leave(tuple.session);
        return;
      }
      if (tuple.auth !== null && this.services.hub.has(tuple.topic)) {
        this.services.hub.get(tuple.topic).leave(tuple.session);
      }
    });
    return flushed;
  }

  private resume(tuple: SocketTuple, ref: ReturnType<typeof queueingSocketRef>): ConnectionState {
    const known = this.states.get(tuple.session);
    if (known !== undefined) {
      return known;
    }
    const state: ConnectionState = { room: null, auth: tuple.auth, nickname: tuple.nickname };
    this.states.set(tuple.session, state);
    if (tuple.auth !== null) {
      const room = this.services.hub.get(tuple.topic);
      state.room = room;
      room.admit(ref, tuple.auth, tuple.nickname, tuple.ips);
    }
    return state;
  }
}

export function flushingTimers(base: Timers, outbox: Outbox): Timers {
  return {
    schedule: (fn, delayMs) =>
      base.schedule(() => {
        void runTurn(outbox, undefined, fn);
      }, delayMs),
    cancel: (handle) => {
      base.cancel(handle);
    },
  };
}

export interface HibernatableSocket {
  send(message: string): void;
  close(code?: number, reason?: string): void;
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}

export interface SocketHost {
  acceptWebSocket(socket: HibernatableSocket, tags?: string[]): void;
  getWebSockets(tag?: string): HibernatableSocket[];
}

export interface AppEndpoint {
  inbound(tuple: SocketTuple, raw: string): Promise<InboundResult>;
  disconnect(tuple: SocketTuple): Promise<FlushResult>;
}

export class SquareSockets {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly host: SocketHost,
    private readonly app: AppEndpoint,
  ) {}

  private serialize<T>(step: () => Promise<T>): Promise<T> {
    const next = this.chain.then(step, step);
    this.chain = next.catch(() => undefined);
    return next;
  }

  accept(socket: HibernatableSocket, tuple: SocketTuple): void {
    socket.serializeAttachment(tuple);
    this.host.acceptWebSocket(socket, [tuple.topic, tuple.session]);
  }

  message(socket: HibernatableSocket, raw: string): Promise<void> {
    return this.serialize(async () => {
      const tuple = socket.deserializeAttachment() as SocketTuple;
      const result = await this.app.inbound(tuple, raw);
      socket.serializeAttachment(result.tuple);
      this.deliver(result);
    });
  }

  closed(socket: HibernatableSocket): Promise<void> {
    return this.serialize(async () => {
      const tuple = socket.deserializeAttachment() as SocketTuple;
      this.deliver(await this.app.disconnect(tuple));
    });
  }

  deliver(batch: FlushResult): void {
    for (const frame of batch.frames) {
      for (const socket of this.host.getWebSockets(frame.session)) {
        socket.send(frame.encoded);
      }
    }
    for (const item of batch.closes) {
      for (const socket of this.host.getWebSockets(item.session)) {
        socket.close(item.code);
      }
    }
  }
}
