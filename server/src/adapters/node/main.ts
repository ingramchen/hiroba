import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig } from '../../core/config.js';
import { startServer } from './server.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const config = readConfig(process.env);

const running = await startServer({
  config,
  migrationsFolder: join(root, 'drizzle'),
  webRoot: root,
});

console.log(JSON.stringify({ level: 'info', msg: 'listening', port: running.port }));

const SHUTDOWN_TIMEOUT_MS = 10_000;

let stopping = false;

function shutdown(): void {
  if (stopping) {
    process.exit(1);
  }
  stopping = true;
  const forced = setTimeout(() => {
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forced.unref();
  void running.close().then(
    () => {
      process.exit(0);
    },
    () => {
      process.exit(1);
    },
  );
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, shutdown);
}
