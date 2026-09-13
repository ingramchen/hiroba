import { htmlEncode } from '@hiroba/shared';
import { EMOJI, EMOJI_BASE_PATH, PUA_START, type EmojiEntry } from './index';

export const SMILEY_CSS_CLASS = 'GlobalCssResource-smiley';
export const POSTER_EXCLUDED = ['STAR', 'THINKING', 'END'] as const;
export const MAX_LINE_BREAKS = 2;

export interface EmojiRenderOptions {
  base?: string;
  highDensity?: boolean;
  cssClass?: string;
  excludes?: readonly string[];
}

export function emojiSrc(entry: EmojiEntry, options: EmojiRenderOptions = {}): string {
  const base = options.base ?? EMOJI_BASE_PATH;
  const file = options.highDensity === true && entry.file2x !== null ? entry.file2x : entry.file;
  return base + file;
}

export function emojiImgHtml(entry: EmojiEntry, options: EmojiRenderOptions = {}): string {
  if (entry.lineBreak) {
    return '<br/>';
  }
  const cssClass = options.cssClass ?? SMILEY_CSS_CLASS;
  return `<img class="${cssClass}" src="${emojiSrc(entry, options)}" alt="${htmlEncode(entry.symbol)}"/>`;
}

export type SmileyPart =
  | { kind: 'text'; text: string }
  | { kind: 'smiley'; entry: EmojiEntry; src: string; alt: string }
  | { kind: 'break' };

function selected(options: EmojiRenderOptions): EmojiEntry[] {
  const excludes = options.excludes;
  if (excludes === undefined || excludes.length === 0) {
    return [...EMOJI];
  }
  const set = new Set(excludes);
  return EMOJI.filter((entry) => !set.has(entry.name));
}

export function decorateSmileys(content: string, options: EmojiRenderOptions = {}): SmileyPart[] {
  let parts: SmileyPart[] = content.length === 0 ? [] : [{ kind: 'text', text: content }];
  let breaks = 0;
  for (const entry of selected(options)) {
    if (entry.lineBreak && breaks >= MAX_LINE_BREAKS) {
      continue;
    }
    const next: SmileyPart[] = [];
    for (const part of parts) {
      if (part.kind !== 'text') {
        next.push(part);
        continue;
      }
      let rest = part.text;
      for (;;) {
        const at = rest.indexOf(entry.symbol);
        if (at === -1 || (entry.lineBreak && breaks >= MAX_LINE_BREAKS)) {
          break;
        }
        if (at > 0) {
          next.push({ kind: 'text', text: rest.slice(0, at) });
        }
        if (entry.lineBreak) {
          breaks++;
          next.push({ kind: 'break' });
        } else {
          next.push({
            kind: 'smiley',
            entry,
            src: emojiSrc(entry, options),
            alt: entry.symbol,
          });
        }
        rest = rest.slice(at + entry.symbol.length);
      }
      if (rest.length > 0) {
        next.push({ kind: 'text', text: rest });
      }
    }
    parts = next;
  }
  return parts;
}

export function symbolsToPua(content: string, options: EmojiRenderOptions = {}): string {
  let out = content;
  let breaks = 0;
  for (const entry of selected(options)) {
    const pua = String.fromCharCode(PUA_START + entry.ordinal);
    if (entry.lineBreak) {
      while (breaks < MAX_LINE_BREAKS && out.includes(entry.symbol)) {
        out = out.replace(entry.symbol, pua);
        breaks++;
      }
      continue;
    }
    out = out.split(entry.symbol).join(pua);
  }
  return out;
}

export function puaToHtml(markup: string, options: EmojiRenderOptions = {}): string {
  let out = markup;
  for (const entry of selected(options)) {
    const pua = String.fromCharCode(PUA_START + entry.ordinal);
    if (!out.includes(pua)) {
      continue;
    }
    out = out.split(pua).join(emojiImgHtml(entry, options));
  }
  return out;
}

export function renderPosterBody(rendered: string, options: EmojiRenderOptions = {}): string {
  return puaToHtml(rendered, { ...options, excludes: POSTER_EXCLUDED });
}

export function preparePosterSource(content: string): string {
  return symbolsToPua(content, { excludes: POSTER_EXCLUDED });
}
