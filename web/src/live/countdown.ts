export const VOTE_TICK_MS = 100;
export const VOTE_RED_THRESHOLD_MS = 15_000;

export interface VoteCountdown {
  text: string;
  red: boolean;
  ended: boolean;
}

function format(value: number, fractionDigits: number): string {
  const power = 10 ** fractionDigits;
  const text = (Math.round(value * power) / power).toFixed(fractionDigits);
  const dot = text.indexOf('.');
  const whole = dot === -1 ? text : text.slice(0, dot);
  return whole.padStart(2, '0') + (dot === -1 ? '' : text.slice(dot));
}

export function voteCountdown(remainMs: number, wasRed = false): VoteCountdown {
  const red = wasRed || remainMs <= VOTE_RED_THRESHOLD_MS;
  if (remainMs <= 0) {
    return { text: '', red, ended: true };
  }
  const minute = Math.trunc(remainMs / 60 / 1000);
  const second = (remainMs % (60 * 1000)) / 1000;
  const formatted = red ? format(second, 1) : format(second, 0);
  return { text: `${String(minute)}:${formatted}`, red, ended: false };
}
