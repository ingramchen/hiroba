import type { AlarmStorageLike } from './platform.js';

export const SCHEDULER_TICK_MS = 30_000;

export async function armAlarm(
  storage: AlarmStorageLike,
  now: number,
  everyMs = SCHEDULER_TICK_MS,
): Promise<void> {
  if ((await storage.getAlarm()) === null) {
    await storage.setAlarm(now + everyMs);
  }
}

export async function runAlarm(
  storage: AlarmStorageLike,
  tick: () => Promise<unknown>,
  now: () => number,
  everyMs = SCHEDULER_TICK_MS,
): Promise<void> {
  try {
    await tick();
  } finally {
    await storage.setAlarm(now() + everyMs);
  }
}
