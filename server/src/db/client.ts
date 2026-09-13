import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from './schema.js';

export type Database = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export const SELECT_BATCH = 500;

export interface Store {
  db: Database;
  migrate: () => Promise<void>;
  close: () => void;
}

export interface MigrationJournalEntry {
  idx: number;
  when: number;
  tag: string;
  breakpoints: boolean;
}

export interface MigrationBundle {
  journal: { entries: MigrationJournalEntry[] };
  migrations: Record<string, string>;
}

export function migrationKey(idx: number): string {
  return `m${idx.toString().padStart(4, '0')}`;
}
