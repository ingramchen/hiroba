export const WASH_GUARD_INTERVAL_MS = 7000;
export const WASH_GUARD_LOCK_MS = 100_000;
export const WASH_GUARD_PUNISH_MS = WASH_GUARD_LOCK_MS + 20_000;
export const WASH_GUARD_ALLOW_ANCHORABLE = 20;
export const WASH_GUARD_ALLOW_DEFAULT = 4;

export function washGuardAllowance(anchorable: boolean): number {
  return anchorable ? WASH_GUARD_ALLOW_ANCHORABLE : WASH_GUARD_ALLOW_DEFAULT;
}

export class WashGuard {
  private readonly accesses: number[];

  constructor(
    private readonly maxAllowCount: number,
    startedAt: number,
    private readonly intervalMs: number = WASH_GUARD_INTERVAL_MS,
  ) {
    this.accesses = [startedAt];
  }

  get newestAccess(): number {
    return this.accesses[0] as number;
  }

  check(now: number): boolean {
    this.accesses.unshift(now);
    if (this.accesses.length > this.maxAllowCount) {
      const oldest = this.accesses.pop() as number;
      const interval = now - oldest;
      if (interval > 0 && interval <= this.intervalMs) {
        return false;
      }
    }
    return true;
  }

  static lockUntil(now: number): number {
    return now + WASH_GUARD_LOCK_MS;
  }
}
