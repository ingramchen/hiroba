const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const BASE = BigInt(ALPHABET.length);

export const FLAKE_EPOCH_MS = 1_420_070_400_000;
export const SUB_MILLI_BITS = 12n;
export const NODE_ID_BITS = 10n;

export function toBase62(value: bigint): string {
  if (value <= 0n) {
    return '';
  }
  let rest = value;
  let out = '';
  while (rest > 0n) {
    out = (ALPHABET[Number(rest % BASE)] as string) + out;
    rest /= BASE;
  }
  return out;
}

export function fromBase62(value: string): bigint {
  let out = 0n;
  for (const c of value) {
    const index = ALPHABET.indexOf(c);
    if (index === -1) {
      throw new Error(`not base62: ${value}`);
    }
    out = out * BASE + BigInt(index);
  }
  return out;
}

export function flakeEpochMillis(value: bigint): number {
  return Number((value >> (SUB_MILLI_BITS + NODE_ID_BITS)) + BigInt(FLAKE_EPOCH_MS));
}

function sequenceTimeFromEpochMilli(epochMilli: number): bigint {
  return BigInt(epochMilli - FLAKE_EPOCH_MS) << SUB_MILLI_BITS;
}

function millisOfSequenceTime(sequenceTime: bigint): bigint {
  return sequenceTime >> SUB_MILLI_BITS;
}

export class FlakeIdGenerator {
  private lastSequenceTime = 0n;

  constructor(
    private readonly nodeId: number,
    private readonly now: () => number = Date.now,
  ) {}

  next(): bigint {
    const sequenceTime = this.nextSequenceTime();
    return (sequenceTime << NODE_ID_BITS) | BigInt(this.nodeId);
  }

  nextString(): string {
    return toBase62(this.next());
  }

  private nextSequenceTime(): bigint {
    for (;;) {
      const now = sequenceTimeFromEpochMilli(this.now());
      const last = this.lastSequenceTime;
      if (now > last) {
        this.lastSequenceTime = now;
        return now;
      }
      if (millisOfSequenceTime(now) < millisOfSequenceTime(last)) {
        this.lastSequenceTime = last + 1n;
        return this.lastSequenceTime;
      }
      const candidate = last + 1n;
      if (millisOfSequenceTime(candidate) === millisOfSequenceTime(last)) {
        this.lastSequenceTime = candidate;
        return candidate;
      }
    }
  }
}
