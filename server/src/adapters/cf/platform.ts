import type { FlushResult } from '../../core/room/outbox.js';
import type { DurableObjectStorageLike } from './db.js';
import type { InboundResult, SocketTuple } from './realtime.js';

export interface HibernationSocket {
  send(message: string): void;
  close(code?: number, reason?: string): void;
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}

export interface AlarmStorageLike {
  getAlarm(): Promise<number | null>;
  setAlarm(at: number): Promise<void>;
}

export interface WipeStorageLike {
  deleteAll(): Promise<void>;
  deleteAlarm(): Promise<void>;
}

export interface DurableObjectStateLike {
  storage: DurableObjectStorageLike & AlarmStorageLike & WipeStorageLike;
  acceptWebSocket(socket: HibernationSocket, tags?: string[]): void;
  getWebSockets(tag?: string): HibernationSocket[];
  abort(reason?: string): void;
  waitUntil(promise: Promise<unknown>): void;
}

export interface AppRpc {
  inbound(tuple: SocketTuple, raw: string): Promise<InboundResult>;
  disconnect(tuple: SocketTuple): Promise<FlushResult>;
  wipe(): Promise<{ deleted: number }>;
}

export interface SquareRpc {
  deliver(batch: FlushResult): Promise<void>;
  tuples(): Promise<SocketTuple[]>;
}

export interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

export interface NamespaceLike<T> {
  idFromName(name: string): unknown;
  get(id: unknown): T & Fetcher;
}

export interface WebSocketPairLike {
  0: HibernationSocket;
  1: HibernationSocket;
}

export interface Env extends Record<string, unknown> {
  APP: NamespaceLike<AppRpc>;
  SQUARE: NamespaceLike<SquareRpc>;
  ASSETS?: Fetcher;
  TOKEN_SECRET?: string;
  SYS_PASSWORD?: string;
  /** Workers VPC service binding for the image classifier, when the deployment has one. */
  IMGMOD?: VpcFetcher;
}

export interface VpcFetcher {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
}

/** The host `IMGMOD_URL` defaults to when the classifier is reached through a VPC binding. */
export const VPC_CLASSIFIER_URL = 'http://imgmod.vpc';

/**
 * The fetch the classifier is called through, when the deployment binds it as a VPC service.
 * A VPC binding routes by the service definition, not by the url, so the url only has to be
 * present: when `IMGMOD_URL` is unset the binding alone turns moderation on, under a name that
 * says where the request goes. Returns `undefined` when there is no binding, so the plain
 * `fetch` applies and `IMGMOD_URL` keeps its ordinary meaning.
 */
export function vpcClassifierFetch(
  env: Env,
  vars: Record<string, string | undefined>,
): typeof fetch | undefined {
  const binding = env.IMGMOD;
  if (binding === undefined || typeof binding.fetch !== 'function') {
    return undefined;
  }
  if (vars['IMGMOD_URL'] === undefined || vars['IMGMOD_URL'].trim() === '') {
    vars['IMGMOD_URL'] = VPC_CLASSIFIER_URL;
  }
  return ((input, init) => binding.fetch(input, init)) as typeof fetch;
}

export function stringVars(env: Env): Record<string, string | undefined> {
  const vars: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') {
      vars[key] = value;
    }
  }
  return vars;
}

export function newWebSocketPair(): WebSocketPairLike {
  const factory = (globalThis as unknown as { WebSocketPair: new () => WebSocketPairLike })
    .WebSocketPair;
  return new factory();
}

export function upgradeResponse(client: HibernationSocket): Response {
  return new Response(null, { status: 101, webSocket: client } as ResponseInit);
}
