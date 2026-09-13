export interface RateRule {
  windowMs: number;
  max: number;
  lockMs?: number;
}

export interface RateVerdict {
  allowed: boolean;
  retryAfterMs: number;
}

export const RATE_LIMIT_MAX_KEYS = 10_000;

interface Bucket {
  hits: number[];
  lockedUntil: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly rule: RateRule,
    private readonly maxKeys: number = RATE_LIMIT_MAX_KEYS,
  ) {}

  peek(key: string, now: number): RateVerdict {
    const bucket = this.buckets.get(key);
    if (bucket === undefined) {
      return { allowed: true, retryAfterMs: 0 };
    }
    this.trim(bucket, now);
    if (bucket.lockedUntil > now) {
      return { allowed: false, retryAfterMs: bucket.lockedUntil - now };
    }
    if (bucket.hits.length >= this.rule.max) {
      const oldest = bucket.hits[0] as number;
      return { allowed: false, retryAfterMs: oldest + this.rule.windowMs - now };
    }
    return { allowed: true, retryAfterMs: 0 };
  }

  hit(key: string, now: number): RateVerdict {
    const verdict = this.peek(key, now);
    if (!verdict.allowed) {
      return verdict;
    }
    let bucket = this.buckets.get(key);
    if (bucket === undefined) {
      if (this.buckets.size >= this.maxKeys) {
        this.sweep(now);
      }
      if (this.buckets.size >= this.maxKeys) {
        const oldest = this.buckets.keys().next();
        if (!oldest.done) {
          this.buckets.delete(oldest.value);
        }
      }
      bucket = { hits: [], lockedUntil: 0 };
      this.buckets.set(key, bucket);
    }
    bucket.hits.push(now);
    if (bucket.hits.length >= this.rule.max && this.rule.lockMs !== undefined) {
      bucket.lockedUntil = now + this.rule.lockMs;
    }
    return { allowed: true, retryAfterMs: 0 };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  get size(): number {
    return this.buckets.size;
  }

  sweep(now: number): void {
    for (const [key, bucket] of this.buckets) {
      this.trim(bucket, now);
      if (bucket.hits.length === 0 && bucket.lockedUntil <= now) {
        this.buckets.delete(key);
      }
    }
  }

  private trim(bucket: Bucket, now: number): void {
    const cutoff = now - this.rule.windowMs;
    while (bucket.hits.length > 0 && (bucket.hits[0] as number) <= cutoff) {
      bucket.hits.shift();
    }
  }
}

export const GLOBAL_KEY = '*';

export class ClientAndGlobalLimiter {
  private readonly perClient: RateLimiter;
  private readonly global: RateLimiter;

  constructor(perClient: RateRule, global: RateRule) {
    this.perClient = new RateLimiter(perClient);
    this.global = new RateLimiter(global, 1);
  }

  peek(client: string, now: number): RateVerdict {
    const local = this.perClient.peek(client, now);
    if (!local.allowed) {
      return local;
    }
    return this.global.peek(GLOBAL_KEY, now);
  }

  hit(client: string, now: number): RateVerdict {
    const verdict = this.peek(client, now);
    if (!verdict.allowed) {
      return verdict;
    }
    this.perClient.hit(client, now);
    this.global.hit(GLOBAL_KEY, now);
    return verdict;
  }

  sweep(now: number): void {
    this.perClient.sweep(now);
    this.global.sweep(now);
  }
}

export function retryAfterSeconds(verdict: RateVerdict): string {
  return String(Math.max(1, Math.ceil(verdict.retryAfterMs / 1000)));
}
