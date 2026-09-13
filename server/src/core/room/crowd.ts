import { crowdBroadcastDelayMs } from '@hiroba/shared';
import type { TimerHandle, Timers } from './types.js';

export class CrowdBroadcaster {
  private pending: TimerHandle | null = null;
  private pendingCrowd = 0;

  constructor(
    private readonly timers: Timers,
    private readonly emit: (crowd: number) => void,
  ) {}

  changed(crowd: number): void {
    const delay = crowdBroadcastDelayMs(crowd);
    if (delay <= 0) {
      this.cancel();
      this.emit(crowd);
      return;
    }
    this.pendingCrowd = crowd;
    if (this.pending !== null) {
      return;
    }
    this.pending = this.timers.schedule(() => {
      this.pending = null;
      this.emit(this.pendingCrowd);
    }, delay);
  }

  cancel(): void {
    if (this.pending !== null) {
      this.timers.cancel(this.pending);
      this.pending = null;
    }
  }

  get hasPending(): boolean {
    return this.pending !== null;
  }
}
