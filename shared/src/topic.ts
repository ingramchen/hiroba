export const MAX_TOPIC_LENGTH = 50;

const UNSAFE = /[{}[\]\\<>"]/gu;
const ASCII_SPACE = /[ \t\n\v\f\r]+/gu;

export function canonicalTopic(raw: string): string {
  const headSlashRemoved = raw.trim().startsWith('/') ? raw.trim().slice(1).trim() : raw.trim();
  const translated = headSlashRemoved
    .toLowerCase()
    .replace(ASCII_SPACE, '-')
    .replace(UNSAFE, '')
    .split('/', 1)[0];
  return (translated ?? '').slice(0, MAX_TOPIC_LENGTH);
}

export function isCanonicalTopic(raw: string): boolean {
  return raw === canonicalTopic(raw);
}
