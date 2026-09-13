import Sqlite from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Store } from '../../db/client.js';
import * as schema from '../../db/schema.js';

export function openDatabase(path: string, migrationsFolder: string): Store {
  const sqlite = new Sqlite(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });

  return {
    db,
    migrate: async () => migrate(db, { migrationsFolder }),
    close: () => sqlite.close(),
  };
}
