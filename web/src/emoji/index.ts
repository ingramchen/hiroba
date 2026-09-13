import {
  EMOJI,
  EMOJI_CATEGORIES,
  type EmojiCategory,
  type EmojiCategoryName,
  type EmojiEntry,
} from './generated/emoji-data';

export { EMOJI, EMOJI_CATEGORIES };
export type { EmojiCategory, EmojiCategoryName, EmojiEntry };

export const EMOJI_BASE_PATH = '/-/emoji/';

export const PUA_START = 0xe900;

const BY_NAME = new Map(EMOJI.map((e) => [e.name, e]));
const BY_SYMBOL = new Map(EMOJI.map((e) => [e.symbol, e]));
const BY_PUA = new Map(EMOJI.map((e) => [String.fromCharCode(PUA_START + e.ordinal), e]));

export function findByName(name: string): EmojiEntry | undefined {
  return BY_NAME.get(name);
}

export function findBySymbol(symbol: string): EmojiEntry | undefined {
  return BY_SYMBOL.get(symbol);
}

export function findByPua(pua: string): EmojiEntry | undefined {
  return BY_PUA.get(pua);
}

export function puaOf(entry: EmojiEntry): string {
  return String.fromCharCode(PUA_START + entry.ordinal);
}

export function listByCategory(category: EmojiCategoryName): EmojiEntry[] {
  return EMOJI.filter((e) => e.category === category);
}

export interface EmojiUrlOptions {
  base?: string;
  highDensity?: boolean;
}

export function emojiUrl(entry: EmojiEntry, options: EmojiUrlOptions = {}): string {
  const base = options.base ?? EMOJI_BASE_PATH;
  const file = options.highDensity && entry.file2x !== null ? entry.file2x : entry.file;
  return base + file;
}

export function emojiUrlBySymbol(symbol: string, options: EmojiUrlOptions = {}): string | null {
  const entry = findBySymbol(symbol);
  return entry === undefined ? null : emojiUrl(entry, options);
}

export function categoryIconUrl(category: EmojiCategory, options: EmojiUrlOptions = {}): string {
  const base = options.base ?? EMOJI_BASE_PATH;
  const suffix = options.highDensity ? '_2x' : '';
  return `${base}category/${category.icon}${suffix}.png`;
}
