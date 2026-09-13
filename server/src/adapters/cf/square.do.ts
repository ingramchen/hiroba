import { DurableObject } from 'cloudflare:workers';
import type { FlushResult } from '../../core/room/outbox.js';
import { TOPIC_HEADER, clientIpsOf } from './clientAddress.js';
import { newWebSocketPair, upgradeResponse, type Env, type HibernationSocket } from './platform.js';
import { SquareSockets, type AppEndpoint, type SocketTuple } from './realtime.js';

export class SquareDO extends DurableObject<Env> {
  private readonly sockets = new SquareSockets(
    {
      acceptWebSocket: (socket, tags) => {
        this.ctx.acceptWebSocket(socket, tags);
      },
      getWebSockets: (tag) => this.ctx.getWebSockets(tag),
    },
    this.endpoint(),
  );

  private endpoint(): AppEndpoint {
    const namespace = this.env.APP;
    const stub = (): ReturnType<typeof namespace.get> => namespace.get(namespace.idFromName('app'));
    return {
      inbound: (tuple, raw) => stub().inbound(tuple, raw),
      disconnect: (tuple) => stub().disconnect(tuple),
    };
  }

  async deliver(batch: FlushResult): Promise<void> {
    this.sockets.deliver(batch);
    return Promise.resolve();
  }

  tuples(): Promise<SocketTuple[]> {
    const held = this.ctx
      .getWebSockets()
      .map((socket) => socket.deserializeAttachment() as SocketTuple | null)
      .filter((tuple): tuple is SocketTuple => tuple !== null);
    return Promise.resolve(held);
  }

  fetch(request: Request): Promise<Response> {
    const topic = request.headers.get(TOPIC_HEADER) ?? '';
    if (topic.length === 0) {
      return Promise.resolve(new Response('no topic', { status: 400 }));
    }
    const pair = newWebSocketPair();
    this.sockets.accept(pair[1], {
      session: crypto.randomUUID(),
      topic,
      ips: clientIpsOf(request),
      auth: null,
      nickname: '',
    });
    return Promise.resolve(upgradeResponse(pair[0]));
  }

  webSocketMessage(socket: HibernationSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);
    return this.sockets.message(socket, raw);
  }

  webSocketClose(socket: HibernationSocket): Promise<void> {
    return this.sockets.closed(socket);
  }
}
