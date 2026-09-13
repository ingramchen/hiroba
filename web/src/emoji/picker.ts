import { EMOJI, EMOJI_CATEGORIES, type EmojiCategoryName, type EmojiEntry } from './index';

export const RECENT_COLUMNS = 13;
export const RECENT_ROWS = 4;
export const MAX_RECENT_SMILEY = RECENT_COLUMNS * RECENT_ROWS;
export const RECENT_STORAGE_KEY = 'hiroba.recentSmiley';
export const PICKER_MODE_STORAGE_KEY = 'hiroba.smileyMode';

export const INPUT_SCOPES: Record<string, string> = {
  FREE: 'free',
  ANCHOR_SQUARE: 'anchor',
  DEGRADE_FREE: 'degrade',
  CHAT_FREEZE: 'chatFreeze',
};

export function inputScopeOf(roomType: string): string {
  return INPUT_SCOPES[roomType] ?? 'free';
}

export const PICKER_MODES = ['FLOAT_AUTO_HIDE', 'FLOAT', 'STOCK'] as const;
export type PickerMode = (typeof PICKER_MODES)[number];

export function parsePickerMode(raw: string | null | undefined): PickerMode {
  return raw !== null && raw !== undefined && (PICKER_MODES as readonly string[]).includes(raw)
    ? (raw as PickerMode)
    : 'FLOAT_AUTO_HIDE';
}

const MAX_CELL_COUNT = ((): number => {
  const counts = new Map<string, number>();
  for (const entry of EMOJI) {
    counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  }
  let max = 0;
  for (const category of EMOJI_CATEGORIES) {
    max = Math.max(max, counts.get(category.name) ?? 0);
  }
  return Math.max(MAX_RECENT_SMILEY, max);
})();

export function maxCellCount(): number {
  return MAX_CELL_COUNT;
}

export function addRecent(existing: readonly string[], name: string): string[] {
  if (existing.includes(name)) {
    return [...existing];
  }
  const next = [...existing, name];
  return next.length > MAX_RECENT_SMILEY ? next.slice(next.length - MAX_RECENT_SMILEY) : next;
}

export function readRecent(raw: string | null): string[] {
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((value): value is string => typeof value === 'string')
      .slice(0, MAX_RECENT_SMILEY);
  } catch {
    return [];
  }
}

export function listByCategoryName(
  category: EmojiCategoryName,
  recent: readonly string[],
): EmojiEntry[] {
  if (category !== 'RECENT') {
    return EMOJI.filter((entry) => entry.category === category);
  }
  const byName = new Map(EMOJI.map((entry) => [entry.name, entry]));
  const found: EmojiEntry[] = [];
  for (const name of recent) {
    const entry = byName.get(name);
    if (entry !== undefined) {
      found.push(entry);
    }
  }
  return found;
}

export function padGrid(
  entries: readonly EmojiEntry[],
  size = maxCellCount(),
): (EmojiEntry | null)[] {
  const cells: (EmojiEntry | null)[] = [...entries];
  while (cells.length < size) {
    cells.push(null);
  }
  return cells;
}
