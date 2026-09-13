/*
 * Ported from txtmark (https://github.com/rjeschke/txtmark).
 *
 * Copyright (C) 2011 René Jeschke <rene_jeschke@yahoo.de>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeMarkup(raw: string): string {
  return raw.replace(/[&<>"']/gu, (c) => ESCAPES[c] as string);
}

class Out {
  private buffer = '';

  html(raw: string): this {
    this.buffer += raw;
    return this;
  }

  text(raw: string): this {
    this.buffer += escapeMarkup(raw);
    return this;
  }

  reset(): void {
    this.buffer = '';
  }

  toString(): string {
    return this.buffer;
  }
}

type LineType = 'EMPTY' | 'OTHER' | 'ULIST' | 'OLIST' | 'BQUOTE';
type BlockType =
  'NONE' | 'LIST_ITEM' | 'ORDERED_LIST' | 'PARAGRAPH' | 'UNORDERED_LIST' | 'BLOCKQUOTE';

const OLIST_MIN_LENGTH = 3;

class Line {
  pos = 0;
  leading = 0;
  trailing = 0;
  isEmpty = true;
  value = '';
  previous: Line | null = null;
  next: Line | null = null;
  prevEmpty = false;
  nextEmpty = false;

  init(): void {
    this.leading = 0;
    while (this.leading < this.value.length && this.value[this.leading] === ' ') {
      this.leading++;
    }
    if (this.leading === this.value.length) {
      this.setEmpty();
    } else {
      this.isEmpty = false;
      this.trailing = 0;
      while (this.value[this.value.length - this.trailing - 1] === ' ') {
        this.trailing++;
      }
    }
  }

  initLeading(): void {
    this.leading = 0;
    while (this.leading < this.value.length && this.value[this.leading] === ' ') {
      this.leading++;
    }
    if (this.leading === this.value.length) {
      this.setEmpty();
    }
  }

  skipSpaces(): boolean {
    while (this.pos < this.value.length && this.value[this.pos] === ' ') {
      this.pos++;
    }
    return this.pos < this.value.length;
  }

  readUntil(...end: string[]): string | null {
    let out = '';
    let pos = this.pos;
    while (pos < this.value.length) {
      const ch = this.value[pos] as string;
      if (ch === '\\' && pos + 1 < this.value.length) {
        const c = this.value[pos + 1] as string;
        if ('\\[](){}#"\'.>*+-_!`'.includes(c)) {
          out += c;
          pos++;
        } else {
          out += ch;
        }
      } else {
        if (end.includes(ch)) {
          break;
        }
        out += ch;
      }
      pos++;
    }
    const ch = pos < this.value.length ? (this.value[pos] as string) : '\n';
    if (end.includes(ch)) {
      this.pos = pos;
      return out;
    }
    return null;
  }

  setEmpty(): void {
    this.value = '';
    this.leading = 0;
    this.trailing = 0;
    this.isEmpty = true;
    if (this.previous !== null) {
      this.previous.nextEmpty = true;
    }
    if (this.next !== null) {
      this.next.prevEmpty = true;
    }
  }

  lineType(): LineType {
    if (this.isEmpty) {
      return 'EMPTY';
    }
    if (this.value[this.leading] === '>') {
      return 'BQUOTE';
    }
    if (this.value.length - this.leading >= 2 && this.value[this.leading + 1] === ' ') {
      if (this.value[this.leading] === '*') {
        return 'ULIST';
      }
    }
    if (
      this.value.length - this.leading >= OLIST_MIN_LENGTH &&
      isDigit(this.value[this.leading] as string)
    ) {
      let i = this.leading + 1;
      while (i < this.value.length && isDigit(this.value[i] as string)) {
        i++;
      }
      if (i + 1 < this.value.length && this.value[i] === '.' && this.value[i + 1] === ' ') {
        return 'OLIST';
      }
    }
    return 'OTHER';
  }
}

function isDigit(c: string): boolean {
  return c >= '0' && c <= '9';
}

class Block {
  type: BlockType = 'NONE';
  lines: Line | null = null;
  lineTail: Line | null = null;
  blocks: Block | null = null;
  blockTail: Block | null = null;
  next: Block | null = null;
  meta = '';

  hasLines(): boolean {
    return this.lines !== null;
  }

  removeSurroundingEmptyLines(): void {
    if (this.lines !== null) {
      this.removeTrailingEmptyLines();
      this.removeLeadingEmptyLines();
    }
  }

  removeBlockQuotePrefix(): void {
    let line = this.lines;
    while (line !== null) {
      if (!line.isEmpty && line.value[line.leading] === '>') {
        let rem = line.leading + 1;
        if (line.leading + 1 < line.value.length && line.value[line.leading + 1] === ' ') {
          rem++;
        }
        line.value = line.value.slice(rem);
        line.initLeading();
      }
      line = line.next;
    }
  }

  removeListIndent(): void {
    let line = this.lines;
    while (line !== null) {
      if (!line.isEmpty) {
        switch (line.lineType()) {
          case 'ULIST':
            line.value = line.value.slice(line.leading + 2);
            break;
          case 'OLIST':
            line.value = line.value.slice(line.value.indexOf('.') + 2);
            break;
          default:
            line.value = line.value.slice(Math.min(line.leading, 4));
            break;
        }
        line.initLeading();
      }
      line = line.next;
    }
  }

  removeLeadingEmptyLines(): boolean {
    let removed = false;
    let line = this.lines;
    while (line !== null && line.isEmpty) {
      this.removeLine(line);
      line = this.lines;
      removed = true;
    }
    return removed;
  }

  removeTrailingEmptyLines(): void {
    let line = this.lineTail;
    while (line !== null && line.isEmpty) {
      this.removeLine(line);
      line = this.lineTail;
    }
  }

  split(line: Line): Block {
    const block = new Block();
    block.lines = this.lines;
    block.lineTail = line;
    this.lines = line.next;
    line.next = null;
    if (this.lines === null) {
      this.lineTail = null;
    } else {
      this.lines.previous = null;
    }
    if (this.blocks === null) {
      this.blocks = block;
      this.blockTail = block;
    } else {
      (this.blockTail as Block).next = block;
      this.blockTail = block;
    }
    return block;
  }

  removeLine(line: Line): void {
    if (line.previous === null) {
      this.lines = line.next;
    } else {
      line.previous.next = line.next;
    }
    if (line.next === null) {
      this.lineTail = line.previous;
    } else {
      line.next.previous = line.previous;
    }
    line.previous = null;
    line.next = null;
  }

  appendLine(line: Line): void {
    if (this.lineTail === null) {
      this.lines = line;
      this.lineTail = line;
    } else {
      this.lineTail.nextEmpty = line.isEmpty;
      line.prevEmpty = this.lineTail.isEmpty;
      line.previous = this.lineTail;
      this.lineTail.next = line;
      this.lineTail = line;
    }
  }

  expandListParagraphs(): void {
    if (this.type !== 'ORDERED_LIST' && this.type !== 'UNORDERED_LIST') {
      return;
    }
    let outer = this.blocks;
    let hasParagraph = false;
    while (outer !== null && !hasParagraph) {
      if (outer.type === 'LIST_ITEM') {
        let inner = outer.blocks;
        while (inner !== null && !hasParagraph) {
          if (inner.type === 'PARAGRAPH') {
            hasParagraph = true;
          }
          inner = inner.next;
        }
      }
      outer = outer.next;
    }
    if (!hasParagraph) {
      return;
    }
    outer = this.blocks;
    while (outer !== null) {
      if (outer.type === 'LIST_ITEM') {
        let inner = outer.blocks;
        while (inner !== null) {
          if (inner.type === 'NONE') {
            inner.type = 'PARAGRAPH';
          }
          inner = inner.next;
        }
      }
      outer = outer.next;
    }
  }
}

interface LinkRef {
  seqNumber: number;
  link: string;
  title: string | null;
}

type MarkToken =
  'NONE' | 'EM_STAR' | 'STRONG_STAR' | 'STRIKE' | 'CODE_SINGLE' | 'CODE_DOUBLE' | 'LINK' | 'ESCAPE';

const WHITESPACE = /\s/u;

function whitespaceToSpace(c: string): string {
  return WHITESPACE.test(c) ? ' ' : c;
}

function skipSpaces(input: string, start: number): number {
  let pos = start;
  while (pos < input.length && (input[pos] === ' ' || input[pos] === '\n')) {
    pos++;
  }
  return pos < input.length ? pos : -1;
}

function readMdLinkId(input: string, start: number): { text: string; pos: number } {
  let pos = start;
  let counter = 1;
  let out = '';
  while (pos < input.length) {
    const ch = input[pos] as string;
    let endReached = false;
    if (ch === '\n') {
      out += ' ';
    } else if (ch === '[') {
      counter++;
      out += ch;
    } else if (ch === ']') {
      counter--;
      if (counter === 0) {
        endReached = true;
      } else {
        out += ch;
      }
    } else {
      out += ch;
    }
    if (endReached) {
      break;
    }
    pos++;
  }
  return { text: out, pos: pos === input.length ? -1 : pos };
}

function readRawUntil(input: string, start: number, end: string): { text: string; pos: number } {
  let pos = start;
  let out = '';
  while (pos < input.length) {
    const ch = input[pos] as string;
    if (ch === end) {
      break;
    }
    out += ch;
    pos++;
  }
  return { text: out, pos: pos === input.length ? -1 : pos };
}

function hasHttpScheme(link: string): boolean {
  return link.startsWith('http://') || link.startsWith('https://');
}

class Emitter {
  private readonly linkRefs = new Map<string, LinkRef>();

  addLinkRef(key: string, link: string, title: string | null): LinkRef {
    const lower = key.toLowerCase();
    const existing = this.linkRefs.get(lower);
    const ref: LinkRef = {
      seqNumber: existing === undefined ? this.linkRefs.size + 1 : existing.seqNumber,
      link,
      title,
    };
    this.linkRefs.set(lower, ref);
    return ref;
  }

  emit(out: Out, root: Block): void {
    root.removeSurroundingEmptyLines();
    switch (root.type) {
      case 'PARAGRAPH':
        out.html('<p>');
        break;
      case 'BLOCKQUOTE':
        out.html('<blockquote>');
        break;
      case 'UNORDERED_LIST':
        out.html('<ul>\n');
        break;
      case 'ORDERED_LIST':
        out.html('<ol>\n');
        break;
      case 'LIST_ITEM':
        out.html('<li').html('>');
        break;
      default:
        break;
    }

    if (root.hasLines()) {
      this.emitMarkedLines(out, root.lines as Line);
    } else {
      let block = root.blocks;
      while (block !== null) {
        this.emit(out, block);
        block = block.next;
      }
    }

    switch (root.type) {
      case 'PARAGRAPH':
        out.html('</p>\n');
        break;
      case 'BLOCKQUOTE':
        out.html('</blockquote>\n');
        break;
      case 'UNORDERED_LIST':
        out.html('</ul>\n');
        break;
      case 'ORDERED_LIST':
        out.html('</ol>\n');
        break;
      case 'LIST_ITEM':
        out.html('</li>\n');
        break;
      default:
        break;
    }
  }

  private findToken(input: string, start: number, token: MarkToken): number {
    let pos = start;
    while (pos < input.length) {
      if (this.getToken(input, pos) === token) {
        return pos;
      }
      pos++;
    }
    return -1;
  }

  private checkLink(out: Out, input: string, start: number): number {
    let pos = start + 1;
    const id = readMdLinkId(input, pos);
    pos = id.pos;
    if (pos < start) {
      return -1;
    }
    const name = id.text;
    let ref: LinkRef | undefined;
    const oldPos = pos++;
    pos = skipSpaces(input, pos);
    if (pos < start) {
      ref = this.linkRefs.get(name.toLowerCase());
      if (ref !== undefined) {
        pos = oldPos;
      } else {
        return -1;
      }
    } else if (input[pos] === '[') {
      pos++;
      const raw = readRawUntil(input, pos, ']');
      pos = raw.pos;
      if (pos < start) {
        return -1;
      }
      ref = this.linkRefs.get((raw.text.length > 0 ? raw.text : name).toLowerCase());
    } else {
      ref = this.linkRefs.get(name.toLowerCase());
      if (ref !== undefined) {
        pos = oldPos;
      } else {
        return -1;
      }
    }

    if (ref === undefined) {
      return -1;
    }
    if (hasHttpScheme(ref.link)) {
      out.html('<a');
      out.html(' href="').text(ref.link).html('"');
      if (ref.title !== null && ref.title.length > 0) {
        out.html(' title="').text(ref.title).html('"');
      }
      out.html(' class="reference-link" rel="noopener nofollow" target="_blank">');
      this.recursiveEmitLine(out, name, 0, 'LINK');
      out.html('</a>');
    } else {
      out.html('<span class="reference-broken-link">');
      this.recursiveEmitLine(out, name, 0, 'LINK');
      out.html('</span>');
    }
    out.html('<span class="reference-link-index">').text(String(ref.seqNumber)).html('</span>');
    return pos;
  }

  private recursiveEmitLine(out: Out, input: string, start: number, token: MarkToken): number {
    let pos = start;
    const temp = new Out();
    while (pos < input.length) {
      const mt = this.getToken(input, pos);
      if (token !== 'NONE' && (mt === token || (token === 'EM_STAR' && mt === 'STRONG_STAR'))) {
        return pos;
      }
      switch (mt) {
        case 'LINK': {
          temp.reset();
          const b = this.checkLink(temp, input, pos);
          if (b > 0) {
            out.html(temp.toString());
            pos = b;
          } else {
            out.html(input[pos] as string);
          }
          break;
        }
        case 'EM_STAR': {
          temp.reset();
          const b = this.recursiveEmitLine(temp, input, pos + 1, mt);
          if (b > 0) {
            out.html('<em>').html(temp.toString()).html('</em>');
            pos = b;
          } else {
            out.html(input[pos] as string);
          }
          break;
        }
        case 'STRONG_STAR': {
          temp.reset();
          const b = this.recursiveEmitLine(temp, input, pos + 2, mt);
          if (b > 0) {
            out.html('<strong>').html(temp.toString()).html('</strong>');
            pos = b + 1;
          } else {
            out.html(input[pos] as string);
          }
          break;
        }
        case 'STRIKE': {
          temp.reset();
          const b = this.recursiveEmitLine(temp, input, pos + 2, mt);
          if (b > 0) {
            out.html('<s>').html(temp.toString()).html('</s>');
            pos = b + 1;
          } else {
            out.html(input[pos] as string);
          }
          break;
        }
        case 'CODE_SINGLE':
        case 'CODE_DOUBLE': {
          let a = pos + (mt === 'CODE_DOUBLE' ? 2 : 1);
          let b = this.findToken(input, a, mt);
          if (b > 0) {
            pos = b + (mt === 'CODE_DOUBLE' ? 1 : 0);
            while (a < b && input[a] === ' ') {
              a++;
            }
            if (a < b) {
              while (input[b - 1] === ' ') {
                b--;
              }
              out.html('<code>').html(input.slice(a, b)).html('</code>');
            }
          } else {
            out.html(input[pos] as string);
          }
          break;
        }
        case 'ESCAPE':
          pos++;
          out.html(input[pos] as string);
          break;
        default:
          out.html(input[pos] as string);
          break;
      }
      pos++;
    }
    return -1;
  }

  private getToken(input: string, pos: number): MarkToken {
    const c0 = pos > 0 ? whitespaceToSpace(input[pos - 1] as string) : ' ';
    const c = whitespaceToSpace(input[pos] as string);
    const c1 = pos + 1 < input.length ? whitespaceToSpace(input[pos + 1] as string) : ' ';
    const c2 = pos + 2 < input.length ? whitespaceToSpace(input[pos + 2] as string) : ' ';
    switch (c) {
      case '*':
        if (c1 === '*') {
          return c0 !== ' ' || c2 !== ' ' ? 'STRONG_STAR' : 'EM_STAR';
        }
        return c0 !== ' ' || c1 !== ' ' ? 'EM_STAR' : 'NONE';
      case '~':
        return c1 === '~' ? 'STRIKE' : 'NONE';
      case '[':
        return 'LINK';
      case ']':
        return 'NONE';
      case '`':
        return c1 === '`' ? 'CODE_DOUBLE' : 'CODE_SINGLE';
      case '\\':
        return '\\[](){}#"\'.><*+-_!`^'.includes(c1) ? 'ESCAPE' : 'NONE';
      default:
        return 'NONE';
    }
  }

  private emitMarkedLines(out: Out, lines: Line): void {
    const input = new Out();
    let line: Line | null = lines;
    while (line !== null) {
      if (!line.isEmpty) {
        input.text(line.value.slice(line.leading, line.value.length - line.trailing));
        if (line.trailing >= 2) {
          input.html('<br>');
        }
      }
      if (line.next !== null) {
        input.text('\n');
      }
      line = line.next;
    }
    this.recursiveEmitLine(out, input.toString(), 0, 'NONE');
  }
}

function readLines(input: string, emitter: Emitter): Block {
  const block = new Block();
  const source = input.split(/\r\n|\n|\r/u);
  const rows = source.length > 1 && source[source.length - 1] === '' ? source.slice(0, -1) : source;
  let lastLinkRef: LinkRef | null = null;

  for (const row of rows) {
    let expanded = '';
    let pos = 0;
    for (const c of row) {
      if (c === '\t') {
        const np = pos + (4 - (pos & 3));
        while (pos < np) {
          expanded += ' ';
          pos++;
        }
      } else {
        pos++;
        expanded += c;
      }
    }

    const line = new Line();
    line.value = expanded;
    line.init();

    let isLinkRef = false;
    let id: string | null = null;
    let link: string | null = null;
    let comment: string | null = null;
    if (!line.isEmpty && line.value[line.leading] === '[') {
      line.pos = line.leading + 1;
      id = line.readUntil(']');
      if (id !== null && line.pos + 2 < line.value.length) {
        if (line.value[line.pos + 1] === ':') {
          line.pos += 2;
          line.skipSpaces();
          if (line.value[line.pos] === '<') {
            line.pos++;
            link = line.readUntil('>');
            line.pos++;
          } else {
            link = line.readUntil(' ', '\n');
          }
          if (link !== null) {
            if (line.skipSpaces()) {
              const ch = line.value[line.pos] as string;
              if (ch === '"' || ch === "'" || ch === '(') {
                line.pos++;
                comment = line.readUntil(ch === '(' ? ')' : ch);
                if (comment !== null) {
                  isLinkRef = true;
                }
              }
            } else {
              isLinkRef = true;
            }
          }
        }
      }
    }

    if (isLinkRef) {
      const ref = emitter.addLinkRef(id as string, link as string, comment);
      if (comment === null) {
        lastLinkRef = ref;
      }
    } else {
      comment = null;
      if (!line.isEmpty && lastLinkRef !== null) {
        line.pos = line.leading;
        const ch = line.value[line.pos] as string;
        if (ch === '"' || ch === "'" || ch === '(') {
          line.pos++;
          comment = line.readUntil(ch === '(' ? ')' : ch);
        }
        if (comment !== null) {
          lastLinkRef.title = comment;
        }
        lastLinkRef = null;
      }
      if (comment === null) {
        line.pos = 0;
        block.appendLine(line);
      }
    }
  }
  return block;
}

function initListBlock(root: Block): void {
  let line = root.lines;
  line = line === null ? null : line.next;
  while (line !== null) {
    const t = line.lineType();
    if (t === 'OLIST' || t === 'ULIST' || (!line.isEmpty && line.prevEmpty && line.leading === 0)) {
      root.split(line.previous as Line).type = 'LIST_ITEM';
    }
    line = line.next;
  }
  root.split(root.lineTail as Line).type = 'LIST_ITEM';
}

function recurse(root: Block, listMode: boolean): void {
  if (listMode) {
    root.removeListIndent();
  }
  let line = root.lines;
  while (line !== null && line.isEmpty) {
    line = line.next;
  }
  if (line === null) {
    return;
  }

  while (line !== null) {
    const type = line.lineType();
    switch (type) {
      case 'OTHER': {
        const wasEmpty = line.prevEmpty;
        while (line !== null && !line.isEmpty) {
          const t = line.lineType();
          if (listMode && (t === 'OLIST' || t === 'ULIST')) {
            break;
          }
          if (t === 'BQUOTE') {
            break;
          }
          line = line.next;
        }
        if (line !== null && !line.isEmpty) {
          root.split(line.previous as Line).type = wasEmpty ? 'PARAGRAPH' : 'NONE';
          root.removeLeadingEmptyLines();
        } else {
          const bt: BlockType =
            listMode && (line === null || !line.isEmpty) && !wasEmpty ? 'NONE' : 'PARAGRAPH';
          root.split(line === null ? (root.lineTail as Line) : line).type = bt;
          root.removeLeadingEmptyLines();
        }
        line = root.lines;
        break;
      }
      case 'BQUOTE': {
        while (line !== null) {
          if (
            !line.isEmpty &&
            line.prevEmpty &&
            line.leading === 0 &&
            line.lineType() !== 'BQUOTE'
          ) {
            break;
          }
          line = line.next;
        }
        const block = root.split(line !== null ? (line.previous as Line) : (root.lineTail as Line));
        block.type = 'BLOCKQUOTE';
        block.removeSurroundingEmptyLines();
        block.removeBlockQuotePrefix();
        recurse(block, false);
        line = root.lines;
        break;
      }
      case 'OLIST':
      case 'ULIST': {
        while (line !== null) {
          const t = line.lineType();
          if (
            !line.isEmpty &&
            line.prevEmpty &&
            line.leading === 0 &&
            !(t === 'OLIST' || t === 'ULIST')
          ) {
            break;
          }
          line = line.next;
        }
        const list = root.split(line !== null ? (line.previous as Line) : (root.lineTail as Line));
        list.type = type === 'OLIST' ? 'ORDERED_LIST' : 'UNORDERED_LIST';
        (list.lines as Line).prevEmpty = false;
        (list.lineTail as Line).nextEmpty = false;
        list.removeSurroundingEmptyLines();
        (list.lines as Line).prevEmpty = false;
        (list.lineTail as Line).nextEmpty = false;
        initListBlock(list);
        let block = list.blocks;
        while (block !== null) {
          recurse(block, true);
          block = block.next;
        }
        list.expandListParagraphs();
        break;
      }
      default:
        line = line.next;
        break;
    }
  }
}

export function renderKmark(input: string): string {
  const emitter = new Emitter();
  const out = new Out();
  const parent = readLines(input, emitter);
  parent.removeSurroundingEmptyLines();
  recurse(parent, false);
  let block = parent.blocks;
  while (block !== null) {
    emitter.emit(out, block);
    block = block.next;
  }
  return out.toString();
}
