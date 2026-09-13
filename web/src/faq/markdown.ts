import { escapeMarkup } from '@hiroba/shared';

export interface FaqImage {
  src: string;
  width: number;
  height: number;
}

export type FaqImages = Record<string, FaqImage>;

const HEADING = /^(#{1,6})\s+(.*)$/u;
const BULLET = /^-\s+(.*)$/u;

function isSafeHref(href: string): boolean {
  return /^https?:\/\//iu.test(href);
}

function attribute(value: string): string {
  return escapeMarkup(value);
}

function closingBracket(source: string, start: number): number {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function target(source: string, start: number): { value: string; end: number } | null {
  if (source[start] !== '(') return null;
  const close = source.indexOf(')', start);
  if (close < 0) return null;
  return { value: source.slice(start + 1, close).trim(), end: close };
}

function image(name: string, alt: string, images: FaqImages): string {
  const found = images[name];
  if (found === undefined) return escapeMarkup(alt);
  return (
    '<img src="' +
    attribute(found.src) +
    '" alt="' +
    attribute(alt) +
    '" width="' +
    String(found.width) +
    '" height="' +
    String(found.height) +
    '" />'
  );
}

export function renderInline(source: string, images: FaqImages): string {
  let out = '';
  let plain = '';
  let i = 0;
  const flush = () => {
    out += escapeMarkup(plain);
    plain = '';
  };
  while (i < source.length) {
    const c = source[i] as string;
    if (c === '!' && source[i + 1] === '[') {
      const close = closingBracket(source, i + 1);
      const link = close < 0 ? null : target(source, close + 1);
      if (close > 0 && link !== null) {
        flush();
        out += image(link.value, source.slice(i + 2, close), images);
        i = link.end + 1;
        continue;
      }
    }
    if (c === '[') {
      const close = closingBracket(source, i);
      const link = close < 0 ? null : target(source, close + 1);
      if (close > 0 && link !== null) {
        flush();
        const text = renderInline(source.slice(i + 1, close), images);
        out += isSafeHref(link.value)
          ? '<a href="' +
            attribute(link.value) +
            '" target="_blank" rel="noopener">' +
            text +
            '</a>'
          : text;
        i = link.end + 1;
        continue;
      }
    }
    plain += c;
    i++;
  }
  flush();
  return out;
}

function list(lines: string[], images: FaqImages): string {
  const items: string[] = [];
  for (const line of lines) {
    const bullet = BULLET.exec(line);
    if (bullet !== null) {
      items.push(bullet[1] as string);
      continue;
    }
    if (items.length === 0) continue;
    items[items.length - 1] += '\n' + line;
  }
  return (
    '<ul>' + items.map((item) => '<li>' + renderInline(item, images) + '</li>').join('') + '</ul>'
  );
}

function block(lines: string[], images: FaqImages): string {
  const heading = HEADING.exec(lines[0] as string);
  if (heading !== null) {
    const level = String((heading[1] as string).length);
    return '<h' + level + '>' + renderInline(heading[2] as string, images) + '</h' + level + '>';
  }
  if (BULLET.test(lines[0] as string)) return list(lines, images);
  return '<p>' + renderInline(lines.join('\n'), images) + '</p>';
}

export function renderFaq(source: string, images: FaqImages = {}): string {
  const blocks: string[][] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length > 0) blocks.push(current);
    current = [];
  };
  for (const raw of source.split(/\r?\n/u)) {
    const line = raw.trimEnd();
    if (line.trim() === '') {
      flush();
      continue;
    }
    if (HEADING.test(line)) {
      flush();
      blocks.push([line]);
      continue;
    }
    current.push(line);
  }
  flush();
  return blocks.map((lines) => block(lines, images)).join('\n');
}
