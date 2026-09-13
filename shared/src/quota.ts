export const MIN_ENOUGH_CHAR_QUOTA = 60;
export const MAX_CHAR_QUOTA = MIN_ENOUGH_CHAR_QUOTA * 3;
export const MIN_OVER_CHAR_QUOTA = -MAX_CHAR_QUOTA;
export const CROWD_QUOTA_THRESHOLD = 1000;
export const DEGRADE_WAIT_SECONDS = 60;
export const DEGRADE_SERVER_WAIT_SECONDS = 30;
export const DEGRADE_MAX_LENGTH = 80;

export interface InputQuota {
  consume(charCount: number): void;
  giveQuota(): void;
  isEnough(input: string): boolean;
  readonly status: number;
  readonly maxLength: number;
}

export class CharCountInputQuota implements InputQuota {
  private quota = MIN_ENOUGH_CHAR_QUOTA - MAX_CHAR_QUOTA;

  constructor(readonly maxLength: number) {}

  get status(): number {
    return this.quota;
  }

  consume(charCount: number): void {
    this.quota -= Math.max(MIN_OVER_CHAR_QUOTA, Math.max(charCount, MIN_ENOUGH_CHAR_QUOTA));
  }

  giveQuota(): void {
    this.quota = Math.min(this.quota + MIN_ENOUGH_CHAR_QUOTA / 20, MAX_CHAR_QUOTA);
  }

  isEnough(input: string): boolean {
    return this.quota >= Math.max(input.length, MIN_ENOUGH_CHAR_QUOTA);
  }
}

export class SpeedInputQuota implements InputQuota {
  private seconds = 0;

  constructor(private readonly waitSeconds: number) {}

  get status(): number {
    return this.seconds;
  }

  get maxLength(): number {
    return DEGRADE_MAX_LENGTH;
  }

  consume(_charCount: number): void {
    this.seconds = 0;
  }

  giveQuota(): void {
    this.seconds = Math.min(this.seconds + 1, this.waitSeconds);
  }

  isEnough(_input: string): boolean {
    return this.seconds >= this.waitSeconds;
  }
}

export class InfiniteInputQuota implements InputQuota {
  constructor(readonly maxLength: number) {}

  get status(): number {
    return 0;
  }

  consume(_charCount: number): void {}

  giveQuota(): void {}

  isEnough(_input: string): boolean {
    return true;
  }
}

export class FreezeInputQuota implements InputQuota {
  constructor(readonly maxLength: number) {}

  get status(): number {
    return 0;
  }

  consume(_charCount: number): void {}

  giveQuota(): void {}

  isEnough(_input: string): boolean {
    return false;
  }
}

export class CrowdOrientedInputQuota implements InputQuota {
  private readonly charCount: CharCountInputQuota;
  private readonly infinite: InfiniteInputQuota;
  private current: InputQuota;

  constructor(readonly maxLength: number) {
    this.charCount = new CharCountInputQuota(maxLength);
    this.infinite = new InfiniteInputQuota(maxLength);
    this.current = this.charCount;
  }

  get status(): number {
    return this.current.status;
  }

  onCrowdChange(noOfCrowd: number): void {
    this.current = noOfCrowd >= CROWD_QUOTA_THRESHOLD ? this.charCount : this.infinite;
  }

  consume(charCount: number): void {
    this.current.consume(charCount);
  }

  giveQuota(): void {
    this.current.giveQuota();
  }

  isEnough(input: string): boolean {
    return this.current.isEnough(input);
  }
}
