export const TITLE_BLINK_MS = 1000;

export function squareTitle(topic: string, hostname: string): string {
  return `${topic} | ${hostname}`;
}

export class TitleBlinker {
  private timer: number | null = null;
  private base = '';
  private alternate = '';
  private showingBase = true;
  private blurred = false;

  constructor(
    private readonly doc: Document = document,
    private readonly setTimer: (fn: () => void, ms: number) => number = (fn, ms) =>
      window.setInterval(fn, ms),
    private readonly clearTimer: (handle: number) => void = (handle) => {
      window.clearInterval(handle);
    },
  ) {}

  setBase(title: string): void {
    this.base = title;
    if (this.timer === null) {
      this.doc.title = title;
    }
  }

  onWindowBlurred(): void {
    this.blurred = true;
  }

  onWindowFocused(): void {
    this.blurred = false;
    this.restore();
  }

  notify(content: string): void {
    if (content.length === 0 || !this.blurred) {
      return;
    }
    this.alternate = content;
    if (this.timer !== null) {
      return;
    }
    this.showingBase = true;
    this.timer = this.setTimer(() => {
      this.showingBase = !this.showingBase;
      this.doc.title = this.showingBase ? this.base : this.alternate;
    }, TITLE_BLINK_MS);
  }

  restore(): void {
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    this.doc.title = this.base;
  }
}
