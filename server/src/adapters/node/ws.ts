import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { canonicalTopic, CLOSE_CODES, LIMITS, type ServerFrame } from '@hiroba/shared';
import { WebSocketServer, type WebSocket } from 'ws';
import { addressSlots, joinSlots } from '../../core/ip.js';
import {
  failConnection,
  handleClientFrame,
  newConnectionState,
  parseClientFrame,
  type ConnectionState,
} from '../../core/room/gateway.js';
import type { Services } from '../../core/types.js';
import type { SocketRef } from '../../core/room/types.js';

export const WS_PATH_PREFIX = '/ws/';
export const MAX_BUFFERED_BYTES = 1024 * 1024;
export const HEARTBEAT_GRACE_MS = LIMITS.clientHeartbeatMs * 2 + 30_000;
export const HEARTBEAT_SWEEP_MS = 30_000;
export const CLOSE_LINGER_MS = 2000;

const OVERLOAD_TERMINATE_MS = 5_000;

export interface WsOptions {
  heartbeatGraceMs?: number;
  sweepIntervalMs?: number;
  overloadTerminateMs?: number;
  maxBufferedBytes?: number;
}

interface Connection {
  ref: SocketRef;
  socket: WebSocket;
  state: ConnectionState;
  lastSeen: number;
}

export function clientIpsOf(request: IncomingMessage): string {
  const header = request.headers['x-forwarded-for'];
  const raw = Array.isArray(header) ? header.join(',') : header;
  return joinSlots(addressSlots(raw, request.socket.remoteAddress ?? ''));
}

export interface WsGateway {
  close: () => Promise<void>;
  connections: () => number;
}

export function attachWebSockets(
  server: Server,
  services: Services,
  options: WsOptions = {},
): WsGateway {
  const grace = options.heartbeatGraceMs ?? HEARTBEAT_GRACE_MS;
  const sweepEvery = options.sweepIntervalMs ?? HEARTBEAT_SWEEP_MS;
  const terminateAfter = options.overloadTerminateMs ?? OVERLOAD_TERMINATE_MS;
  const maxBuffered = options.maxBufferedBytes ?? MAX_BUFFERED_BYTES;
  const wss = new WebSocketServer({ noServer: true, maxPayload: LIMITS.frameBytes });
  const connections = new Set<Connection>();

  const sweep = setInterval(() => {
    const cutoff = services.clock.now() - grace;
    for (const connection of connections) {
      if (connection.lastSeen < cutoff) {
        connection.socket.terminate();
      }
    }
  }, sweepEvery);
  sweep.unref();

  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = request.url ?? '';
    if (!url.startsWith(WS_PATH_PREFIX)) {
      // An unanswered upgrade would hold the socket open for ever and
      // block server.close(), which only sweeps idle keep-alive sockets.
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const raw = decodeURIComponent(url.slice(WS_PATH_PREFIX.length).split('?')[0] ?? '');
    const topic = canonicalTopic(raw);
    if (topic.length === 0) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }
    const ips = clientIpsOf(request);
    wss.handleUpgrade(request, socket, head, (ws) => {
      accept(ws, topic, ips);
    });
  });

  function accept(socket: WebSocket, topic: string, ips: string): void {
    const session = randomUUID();
    const ref: SocketRef = {
      session,
      send(frame: ServerFrame) {
        ref.sendEncoded(JSON.stringify(frame));
      },
      sendEncoded(encoded: string) {
        if (socket.readyState !== socket.OPEN) {
          return;
        }
        if (socket.bufferedAmount > maxBuffered) {
          socket.close(CLOSE_CODES.overloaded);
          const timer = setTimeout(() => {
            socket.terminate();
          }, terminateAfter);
          timer.unref();
          return;
        }
        socket.send(encoded);
      },
      close(code: number) {
        socket.close(code);
      },
    };
    const connection: Connection = {
      ref,
      socket,
      state: newConnectionState(),
      lastSeen: services.clock.now(),
    };
    connections.add(connection);

    socket.on('message', (data) => {
      connection.lastSeen = services.clock.now();
      const frame = parseClientFrame(data.toString());
      if (frame === null) {
        failConnection(ref, 'BAD_FRAME', true);
        return;
      }
      handleClientFrame(services, connection.state, ref, topic, ips, frame);
    });

    socket.on('close', () => {
      connections.delete(connection);
      connection.state.room?.leave(session);
      connection.state.room = null;
    });

    socket.on('error', () => {
      socket.terminate();
    });
  }

  return {
    connections: () => connections.size,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(sweep);
        for (const connection of connections) {
          connection.state.room = null;
          connection.socket.close(CLOSE_CODES.goingAway);
        }
        const linger = setTimeout(() => {
          for (const connection of connections) {
            connection.socket.terminate();
          }
        }, CLOSE_LINGER_MS);
        linger.unref();
        wss.close(() => {
          clearTimeout(linger);
          connections.clear();
          resolve();
        });
      }),
  };
}
