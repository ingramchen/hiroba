export const CONNECTED_HIDE_MS = 500;
export const PROCESSING_DONE_MS = 1000;

export type IndicatorPhase = 'hidden' | 'busy' | 'settled';

export class Indicator {
  private phase: IndicatorPhase = 'hidden';
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly settledMs: number,
    private readonly onChange: (phase: IndicatorPhase) => void,
  ) {}

  start(): void {
    this.clear();
    this.set('busy');
  }

  settle(): void {
    if (this.phase === 'hidden') return;
    this.clear();
    this.set('settled');
    this.timer = setTimeout(() => {
      this.timer = null;
      this.set('hidden');
    }, this.settledMs);
  }

  hide(): void {
    this.clear();
    this.set('hidden');
  }

  private clear(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  private set(phase: IndicatorPhase): void {
    this.phase = phase;
    this.onChange(phase);
  }
}
