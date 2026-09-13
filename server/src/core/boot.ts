import type { Database, Store } from '../db/client.js';
import { buildServices, type BuildServicesOptions } from './services.js';
import { resetLiveCrowd } from './store.js';
import type { Services } from './types.js';

export interface BootOptions extends Omit<BuildServicesOptions, 'db'> {
  store: Store;
  beforeReset?: (db: Database) => void;
}

export async function bootServices(options: BootOptions): Promise<Services> {
  const { store, beforeReset, ...rest } = options;
  await store.migrate();
  beforeReset?.(store.db);
  resetLiveCrowd(store.db);
  return buildServices({ ...rest, db: store.db });
}
