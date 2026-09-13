const DEFAULT_PROTOCOL = 'http';

export class ParsedUrl {
  readonly raw: string;
  readonly protocol: string;
  readonly anchor: string;
  readonly queryString: string;
  readonly hostName: string;
  readonly port: number;
  readonly path: string;

  constructor(raw: string) {
    this.raw = raw;
    let startPos = 0;
    let tailPos = raw.length;

    const endOfProtocol = raw.indexOf('://');
    if (endOfProtocol !== -1) {
      this.protocol = raw.slice(0, endOfProtocol).toLowerCase();
      startPos += endOfProtocol + 3;
    } else {
      this.protocol = DEFAULT_PROTOCOL;
    }

    const anchorPos = raw.indexOf('#');
    if (anchorPos !== -1) {
      this.anchor = raw.slice(anchorPos + 1, tailPos);
      tailPos = anchorPos;
    } else {
      this.anchor = '';
    }

    const queryPos = raw.indexOf('?');
    if (queryPos !== -1) {
      this.queryString = slice(raw, queryPos + 1, tailPos);
      tailPos = queryPos;
    } else {
      this.queryString = '';
    }

    const pathPos = raw.indexOf('/', startPos);
    if (pathPos !== -1) {
      this.path = slice(raw, pathPos, tailPos);
      tailPos = pathPos;
    } else {
      this.path = '';
    }

    const hostAndPort = javaSplit(slice(raw, startPos, tailPos), ':');
    this.hostName = hostAndPort[0] ?? '';
    if (hostAndPort.length > 1) {
      const port = hostAndPort[1] as string;
      if (!/^[+-]?\d+$/u.test(port)) {
        throw new RangeError(`invalid port in ${raw}`);
      }
      this.port = Number(port);
    } else {
      this.port = this.protocol.startsWith('https') ? 443 : 80;
    }
  }

  get suffix(): string {
    const dot = this.path.lastIndexOf('.');
    return dot === -1 ? '' : this.path.slice(dot + 1);
  }

  get secured(): boolean {
    return this.protocol.startsWith('https');
  }

  withSecure(): ParsedUrl {
    if (this.secured) {
      return this;
    }
    const next = this.raw.includes('://')
      ? this.raw.replace('http://', 'https://')
      : `https://${this.raw}`;
    return new ParsedUrl(next);
  }

  toString(): string {
    return this.raw;
  }
}

function javaSplit(value: string, separator: string): string[] {
  const parts = value.split(separator);
  while (parts.length > 0 && parts[parts.length - 1] === '') {
    parts.pop();
  }
  return parts;
}

function slice(raw: string, from: number, to: number): string {
  if (from > to) {
    throw new RangeError(`begin ${from} > end ${to}`);
  }
  return raw.slice(from, to);
}

export function forceSecure(url: ParsedUrl): {
  raw: ParsedUrl;
  secure: ParsedUrl;
  forced: boolean;
} {
  const secure = url.withSecure();
  return { raw: url, secure, forced: !url.secured && secure.secured };
}

const END_STRINGS = [' ', '　', '\r\n', '\n', '，', '。', '>', '&quot;', '<', '"'];
const KNOWN_PREFIX = ['http://', 'https://', 'www.'];
export function restrictedPrefixes(siteOrigin: string): string[] {
  const match = /^https?:\/\/([^/?#]+)/iu.exec(siteOrigin.trim());
  if (match === null) {
    return [];
  }
  const host = (match[1] as string).toLowerCase();
  const apex = host.startsWith('www.') ? host.slice(4) : host;
  const hosts = apex === host ? [apex, `www.${apex}`] : [apex, host];
  return hosts.flatMap((name) => [`http://${name}`, `https://${name}`]);
}

const ENTITIES: Record<string, string> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  '#123': '{',
  '#125': '}',
  '#91': '[',
  '#93': ']',
  '#92': '\\',
  '#10': '\n',
  '#13': '\r',
  '#36': '$',
};

export function htmlDecode(text: string): string {
  let out = '';
  for (let i = 0; i < text.length;) {
    const c = text[i] as string;
    i++;
    if (c !== '&') {
      out += c;
      continue;
    }
    const semi = text.indexOf(';', i);
    if (semi === -1) {
      throw new Error('unterminated html entity');
    }
    const entity = text.slice(i, semi);
    i = semi + 1;
    const replacement = ENTITIES[entity];
    if (replacement === undefined) {
      throw new Error(`Unknown/unsupported html entity &${entity};`);
    }
    out += replacement;
  }
  return out;
}

const ENCODES: Record<string, string> = {
  '{': '&#123;',
  '}': '&#125;',
  '[': '&#91;',
  ']': '&#93;',
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  '\\': '&#92;',
  '\r': '&#13;',
  '\n': '&#10;',
  $: '&#36;',
};

export function htmlEncode(text: string): string {
  let out = '';
  for (const c of text) {
    out += ENCODES[c] ?? c;
  }
  return out;
}

export function removeAngleBracket(raw: string): string {
  return raw.replace(/[<>]/gu, '');
}

function decodeAsSafeUrl(url: string): string {
  return removeAngleBracket(htmlDecode(url));
}

function searchKnownUrlPos(content: string, from: number, prefixes: string[]): number {
  let leftMost = -1;
  for (const prefix of prefixes) {
    const at = content.indexOf(prefix, from);
    if (at === -1) {
      continue;
    }
    leftMost = leftMost === -1 ? at : Math.min(leftMost, at);
  }
  return leftMost;
}

function urlEndPos(content: string, from: number): number {
  let min = content.length;
  for (const end of END_STRINGS) {
    const at = content.indexOf(end, from);
    if (at === -1) {
      continue;
    }
    min = Math.min(min, at);
  }
  return min;
}

function gatherUrlPositions(
  content: string,
  restricted: boolean,
  siteOrigin: string,
): [number, number][] {
  const prefixes = restricted ? restrictedPrefixes(siteOrigin) : KNOWN_PREFIX;
  const positions: [number, number][] = [];
  for (let from = 0; from < content.length;) {
    const start = searchKnownUrlPos(content, from, prefixes);
    if (start === -1) {
      break;
    }
    const end = urlEndPos(content, start);
    positions.push([start, end]);
    from = end;
  }
  return positions;
}

const ABBREVIATE_PRE = 25;
const ABBREVIATE_POST = 10;
const ABBREVIATE_LIMIT = ABBREVIATE_PRE + ABBREVIATE_POST + 3;

export function abbreviateUrl(url: string): string {
  if (url.length <= ABBREVIATE_LIMIT) {
    return url;
  }
  return `${url.slice(0, ABBREVIATE_PRE)}...${url.slice(url.length - ABBREVIATE_POST)}`;
}

export type ContentPart =
  { kind: 'text'; text: string } | { kind: 'link'; href: string; text: string };

export function decorateUrls(
  content: string,
  restricted: boolean,
  siteOrigin: string,
): ContentPart[] {
  const positions = gatherUrlPositions(content, restricted, siteOrigin);
  if (positions.length === 0) {
    return content.length === 0 ? [] : [{ kind: 'text', text: content }];
  }
  const parts: ContentPart[] = [];
  let from = 0;
  for (const [start, end] of positions) {
    if (start > from) {
      parts.push({ kind: 'text', text: content.slice(from, start) });
    }
    const encoded = content.slice(start, end);
    let safe: string;
    try {
      safe = decodeAsSafeUrl(encoded);
    } catch {
      safe = encoded;
    }
    const href = safe.startsWith('http') ? safe : `http://${safe}`;
    parts.push({ kind: 'link', href, text: abbreviateUrl(encoded) });
    from = end;
  }
  if (from < content.length) {
    parts.push({ kind: 'text', text: content.slice(from) });
  }
  return parts;
}

export function extractUrls(content: string, restricted: boolean, siteOrigin: string): ParsedUrl[] {
  const urls: ParsedUrl[] = [];
  for (const [start, end] of gatherUrlPositions(content, restricted, siteOrigin)) {
    try {
      urls.push(new ParsedUrl(decodeAsSafeUrl(content.slice(start, end))));
    } catch {
      continue;
    }
  }
  return urls;
}
