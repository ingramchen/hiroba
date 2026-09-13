export const KERMA_MIN = 0;
export const KERMA_MAX = 200;
export const KERMA_GROWTH_MS = 60 * 60 * 1000;
export const BURN_PUNISH_KERMA = 20;

export const KERMA_COST = {
  changeColor: 1,
  forbidFromChat: 1,
  showColor: 1,
  euroSpray: 5,
} as const;

export type KermaShopItem = keyof typeof KERMA_COST;

export const SHOP_DURATION_MS = 30 * 60 * 1000;

export function clampKerma(value: number): number {
  return Math.min(KERMA_MAX, Math.max(KERMA_MIN, Math.trunc(value)));
}

export function truncateToSecond(epochMs: number): number {
  return Math.floor(epochMs / 1000) * 1000;
}

export interface TimeKerma {
  value: number;
  lastUpdateTime: number;
}

export function createTimeKerma(now: number, value = KERMA_MIN): TimeKerma {
  return { value: clampKerma(value), lastUpdateTime: truncateToSecond(now) };
}

export function increaseKerma(current: TimeKerma, now: number): TimeKerma {
  const elapsed = now - current.lastUpdateTime;
  if (elapsed < KERMA_GROWTH_MS) {
    return current;
  }
  return { value: clampKerma(current.value + 1), lastUpdateTime: truncateToSecond(now) };
}

export function isKermaExtendable(
  current: TimeKerma,
  now: number,
  forbidForever: boolean,
): boolean {
  if (forbidForever) {
    return false;
  }
  return increaseKerma(current, now).value > current.value;
}

export function isKermaEnough(value: number, minimum: number, forbidForever: boolean): boolean {
  if (forbidForever) {
    return false;
  }
  return value >= minimum;
}

export function calcFreezeValue(minKermaValue: number): number {
  if (minKermaValue >= 160) {
    return 20;
  }
  if (minKermaValue >= 120) {
    return 10;
  }
  if (minKermaValue >= 80) {
    return 5;
  }
  if (minKermaValue >= 40) {
    return 1;
  }
  return 0;
}

export function isSquareUnlimited(minValue: number | null): boolean {
  return minValue === null || minValue === 0;
}

export function isChatFreeze(minValue: number | null, myValue: number): boolean {
  if (isSquareUnlimited(minValue)) {
    return false;
  }
  return myValue < calcFreezeValue(minValue as number);
}

export const CHATROOM_TYPES = ['ANCHOR_SQUARE', 'CHAT_FREEZE', 'FREE', 'DEGRADE_FREE'] as const;

export type ChatroomType = (typeof CHATROOM_TYPES)[number];

export function chatroomType(options: {
  anchorSquare: boolean;
  minValue: number | null;
  myValue: number;
}): ChatroomType {
  if (options.anchorSquare) {
    return 'ANCHOR_SQUARE';
  }
  if (isChatFreeze(options.minValue, options.myValue)) {
    return 'CHAT_FREEZE';
  }
  if (options.minValue === null || options.minValue <= options.myValue) {
    return 'FREE';
  }
  return 'DEGRADE_FREE';
}
