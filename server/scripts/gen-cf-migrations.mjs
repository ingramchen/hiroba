import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const folder = join(here, '..', 'drizzle');
const out = join(here, '..', 'src', 'adapters', 'cf', 'migrations.generated.ts');

const journal = JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8'));
const migrations = {};
for (const entry of journal.entries) {
  migrations[`m${String(entry.idx).padStart(4, '0')}`] = readFileSync(
    join(folder, `${entry.tag}.sql`),
    'utf8',
  );
}
const entries = journal.entries.map(({ idx, when, tag, breakpoints }) => ({
  idx,
  when,
  tag,
  breakpoints,
}));
const bundle = { journal: { entries }, migrations };

mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `import type { MigrationBundle } from '../../db/client.js';\n\n` +
    `export const migrationBundle: MigrationBundle = ${JSON.stringify(bundle, null, 2)};\n`,
  'utf8',
);
