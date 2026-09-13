import type { ServerFrame } from '@hiroba/shared';
import type { SocketRef } from './types.js';

export interface OutboundFrame {
  session: string;
  encoded: string;
}

export interface OutboundClose {
  session: string;
  code: number;
}

export interface FlushResult {
  frames: OutboundFrame[];
  closes: OutboundClose[];
}

export const EMPTY_FLUSH: FlushResult = { frames: [], closes: [] };

export interface Outbox {
  queue(topic: string, session: string, encoded: string): void;
  queueClose(topic: string, session: string, code: number): void;
  flush(currentTopic?: string): Promise<FlushResult>;
}

export interface SquareTransport {
  deliver(topic: string, batch: FlushResult): Promise<void>;
}

interface Item {
  topic: string;
  session: string;
  encoded: string | null;
  code: number;
}

export class BufferedOutbox implements Outbox {
  private items: Item[] = [];

  constructor(
    private readonly transport: SquareTransport,
    private readonly onDeliveryError: (topic: string, error: unknown) => void = () => undefined,
  ) {}

  queue(topic: string, session: string, encoded: string): void {
    this.items.push({ topic, session, encoded, code: 0 });
  }

  queueClose(topic: string, session: string, code: number): void {
    this.items.push({ topic, session, encoded: null, code });
  }

  get pending(): number {
    return this.items.length;
  }

  async flush(currentTopic?: string): Promise<FlushResult> {
    const taken = this.items;
    this.items = [];
    const here: Item[] = [];
    const elsewhere = new Map<string, Item[]>();
    for (const item of taken) {
      if (item.topic === currentTopic) {
        here.push(item);
        continue;
      }
      const batch = elsewhere.get(item.topic);
      if (batch === undefined) {
        elsewhere.set(item.topic, [item]);
      } else {
        batch.push(item);
      }
    }
    for (const [topic, batch] of elsewhere) {
      try {
        await this.transport.deliver(topic, toResult(batch));
      } catch (error) {
        this.onDeliveryError(topic, error);
      }
    }
    return toResult(here);
  }
}

function toResult(items: readonly Item[]): FlushResult {
  const frames: OutboundFrame[] = [];
  const closes: OutboundClose[] = [];
  for (const item of items) {
    if (item.encoded === null) {
      closes.push({ session: item.session, code: item.code });
    } else {
      frames.push({ session: item.session, encoded: item.encoded });
    }
  }
  return { frames, closes };
}

export function queueingSocketRef(outbox: Outbox, topic: string, session: string): SocketRef {
  return {
    session,
    send(frame: ServerFrame) {
      outbox.queue(topic, session, JSON.stringify(frame));
    },
    sendEncoded(encoded: string) {
      outbox.queue(topic, session, encoded);
    },
    close(code: number) {
      outbox.queueClose(topic, session, code);
    },
  };
}

export async function runTurn<T>(
  outbox: Outbox,
  currentTopic: string | undefined,
  fn: () => T | Promise<T>,
): Promise<{ result: T; flushed: FlushResult }> {
  let result: T;
  try {
    result = await fn();
  } catch (error) {
    await outbox.flush(currentTopic);
    throw error;
  }
  return { result, flushed: await outbox.flush(currentTopic) };
}
