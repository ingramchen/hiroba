import { drizzle } from 'drizzle-orm/durable-sqlite';
import { migrate } from 'drizzle-orm/durable-sqlite/migrator';
import type { MigrationBundle, Store } from '../../db/client.js';
import * as schema from '../../db/schema.js';

export interface SqlCursorLike {
  toArray(): Record<string, unknown>[];
  raw(): { toArray(): unknown[][] };
  next(): { done?: boolean; value: Record<string, unknown> | undefined };
}

export interface SqlStorageLike {
  exec(query: string, ...bindings: unknown[]): SqlCursorLike;
}

export interface DurableObjectStorageLike {
  sql: SqlStorageLike;
  transactionSync<T>(closure: () => T): T;
}

export function openDurableDatabase(
  storage: DurableObjectStorageLike,
  bundle: MigrationBundle,
): Store {
  const db = drizzle(storage as never, { schema });
  return {
    db,
    migrate: async () => migrate(db, bundle),
    close: () => undefined,
  };
}
