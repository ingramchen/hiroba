import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { migrationKey, type MigrationBundle, type MigrationJournalEntry } from '../../db/client.js';

export function loadMigrationBundle(folder: string): MigrationBundle {
  const journal = JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8')) as {
    entries: MigrationJournalEntry[];
  };
  const migrations: Record<string, string> = {};
  for (const entry of journal.entries) {
    migrations[migrationKey(entry.idx)] = readFileSync(join(folder, `${entry.tag}.sql`), 'utf8');
  }
  return { journal: { entries: journal.entries }, migrations };
}
