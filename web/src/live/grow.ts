export const GROW_INTERVAL_MS = 5 * 60 * 1000;

export type GrowOutcome =
  | { kind: 'grown'; kerma: number; serverTime: number }
  | { kind: 'invalidSession' }
  | { kind: 'failed' };

export interface GrowLoopOptions {
  grow: () => Promise<GrowOutcome>;
  isActive: () => boolean;
  onKerma: (kerma: number, serverTime: number) => void;
  onInvalidSession: () => void;
  now?: () => number;
  intervalMs?: number;
  setTimer?: (fn: () => void, ms: number) => number;
  clearTimer?: (handle: number) => void;
}

export class GrowLoop {
  private handle: number | null = null;
  private nextAt = 0;
  private running = false;
  private pending = false;
  private readonly interval: number;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => number;
  private readonly clearTimer: (handle: number) => void;

  constructor(private readonly options: GrowLoopOptions) {
    this.interval = options.intervalMs ?? GROW_INTERVAL_MS;
    this.now = options.now ?? (() => Date.now());
    this.setTimer = options.setTimer ?? ((fn, ms) => window.setTimeout(fn, ms));
    this.clearTimer =
      options.clearTimer ??
      ((handle) => {
        window.clearTimeout(handle);
      });
  }

  get dueAt(): number {
    return this.nextAt;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.schedule(this.interval);
  }

  stop(): void {
    this.running = false;
    if (this.handle !== null) {
      this.clearTimer(this.handle);
      this.handle = null;
    }
  }

  wake(): void {
    if (!this.running || this.pending) {
      return;
    }
    if (this.now() >= this.nextAt) {
      this.schedule(0);
    }
  }

  private schedule(delay: number): void {
    if (this.handle !== null) {
      this.clearTimer(this.handle);
    }
    this.nextAt = this.now() + Math.max(0, delay);
    this.handle = this.setTimer(
      () => {
        this.handle = null;
        void this.tick();
      },
      Math.max(0, delay),
    );
  }

  private async tick(): Promise<void> {
    if (!this.running) {
      return;
    }
    if (!this.options.isActive()) {
      this.schedule(this.interval);
      return;
    }
    this.pending = true;
    let outcome: GrowOutcome;
    try {
      outcome = await this.options.grow();
    } catch {
      outcome = { kind: 'failed' };
    }
    this.pending = false;
    if (!this.running) {
      return;
    }
    if (outcome.kind === 'invalidSession') {
      this.stop();
      this.options.onInvalidSession();
      return;
    }
    if (outcome.kind === 'grown') {
      this.options.onKerma(outcome.kerma, outcome.serverTime);
    }
    this.schedule(this.interval);
  }
}
