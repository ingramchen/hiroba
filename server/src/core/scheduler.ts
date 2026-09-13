import { lt } from 'drizzle-orm';
import { poster } from '../db/schema.js';
import { readTimeZone } from './timeZone.js';
import type { Services } from './types.js';

export const JOIN_RECORD_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const POSTER_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const OAUTH_STATE_RETENTION_MS = 10 * 60 * 1000;
export const PASSKEY_CHALLENGE_RETENTION_MS = 60 * 60 * 1000;
export interface ScheduledJob {
  name: string;
  hour: number;
  minute: number;
  run: (now: number) => void;
}

export function scheduledJobs(services: Services): ScheduledJob[] {
  return [
    {
      name: 'evict-squares',
      hour: 4,
      minute: 0,
      run: (now) => {
        services.hub.evict();
        services.directory.pruneExpired(now);
      },
    },
    {
      name: 'purge-kerma-throttles',
      hour: 4,
      minute: 3,
      run: (now) => {
        services.hub.purgeThrottles();
        services.permissions.purgeExpired(now);
        services.sessions.purgeExpired(now);
        services.oidc?.purgeStates(now - OAUTH_STATE_RETENTION_MS);
        services.passkeyChallenges.purgeExpired(now - PASSKEY_CHALLENGE_RETENTION_MS);
      },
    },
    {
      name: 'purge-join-records',
      hour: 4,
      minute: 7,
      run: (now) => {
        services.joinRecords.purgeBefore(now - JOIN_RECORD_RETENTION_MS);
      },
    },
    {
      name: 'purge-posters',
      hour: 4,
      minute: 19,
      run: (now) => {
        services.db
          .delete(poster)
          .where(lt(poster.createTime, new Date(now - POSTER_RETENTION_MS)))
          .run();
      },
    },
  ];
}

export function minuteOfDay(epochMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(epochMs));
  const value = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  return value('hour') * 60 + value('minute');
}

export class Scheduler {
  private readonly jobs: ScheduledJob[];
  private lastRunMinute: number | null = null;
  private handle: ReturnType<typeof setInterval> | null = null;

  constructor(
    services: Services,
    private readonly now: () => number,
    jobs?: ScheduledJob[],
    private readonly timeZone: string = readTimeZone(process.env),
  ) {
    this.jobs = jobs ?? scheduledJobs(services);
  }

  tick(): string[] {
    const current = this.now();
    const minute = minuteOfDay(current, this.timeZone);
    if (this.lastRunMinute === minute) {
      return [];
    }
    this.lastRunMinute = minute;
    const ran: string[] = [];
    for (const job of this.jobs) {
      if (job.hour * 60 + job.minute === minute) {
        job.run(current);
        ran.push(job.name);
      }
    }
    return ran;
  }

  start(intervalMs = 30_000): void {
    if (this.handle !== null) {
      return;
    }
    this.handle = setInterval(() => {
      this.tick();
    }, intervalMs);
    this.handle.unref();
  }

  stop(): void {
    if (this.handle !== null) {
      clearInterval(this.handle);
      this.handle = null;
    }
  }
}
