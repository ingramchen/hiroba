export type MessageArg = string | number;

const PLACEHOLDER = /\{(\d+)(?:,number,#)?\}/g;

function formatArg(value: MessageArg, numberPattern: boolean): string {
  if (!numberPattern) return String(value);
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return String(roundHalfEven(n));
}

function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

export function formatMessage(template: string, args: readonly MessageArg[] = []): string {
  return template.replace(PLACEHOLDER, (whole, index: string) => {
    const value = args[Number(index)];
    if (value === undefined) return whole;
    return formatArg(value, whole.includes(',number,#'));
  });
}

export function placeholderIndexes(template: string): number[] {
  const found = new Set<number>();
  for (const m of template.matchAll(PLACEHOLDER)) found.add(Number(m[1]));
  return [...found].toSorted((a, b) => a - b);
}
