export const MAX_NICKNAME_LENGTH = 15;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(raw: string): string {
  return raw.replace(/[&<>"']/gu, (match) => HTML_ESCAPES[match] ?? match);
}
export const UNKNOWN_NICKNAME_SEPARATOR = '#';
export const UNKNOWN_NICKNAME_LABELS = { zh_TW: '誰啊', en: 'unknown' } as const;

export function unknownNicknameLabel(locale: unknown): string {
  return typeof locale === 'string' && Object.hasOwn(UNKNOWN_NICKNAME_LABELS, locale)
    ? UNKNOWN_NICKNAME_LABELS[locale as keyof typeof UNKNOWN_NICKNAME_LABELS]
    : UNKNOWN_NICKNAME_LABELS.zh_TW;
}

const STRONG_UNSAFE = /[{}[\]\\<>"&?'%$#;:/,=]/gu;
const NICKNAME_SPACE = /[\u200b\u3000 \t\n\v\f\r]+/gu;

export function removeStrongUnsafe(raw: string): string {
  return raw.replace(STRONG_UNSAFE, '');
}

export const ABBREVIATE_MARKER = '...';

export function abbreviate(raw: string, maxLength: number): string {
  if (raw.trim().length === 0) {
    return raw;
  }
  if (raw.length <= maxLength) {
    return raw;
  }
  return raw.slice(0, maxLength) + ABBREVIATE_MARKER;
}

export interface NicknameResult {
  nickname: string;
  generated: boolean;
}

export function bestNickname(
  raw: string | null | undefined,
  fallback: { unknownLabel: string; ipsHash: string },
): NicknameResult {
  const converted = removeStrongUnsafe(
    (raw ?? '').trim().slice(0, MAX_NICKNAME_LENGTH).replace(NICKNAME_SPACE, '-'),
  );
  if (
    converted.trim().length === 0 ||
    converted.includes('誰啊') ||
    converted.toLowerCase().includes('unknown')
  ) {
    const hash = fallback.ipsHash;
    return {
      nickname:
        fallback.unknownLabel +
        UNKNOWN_NICKNAME_SEPARATOR +
        hash.slice(Math.max(0, hash.length - 5)),
      generated: true,
    };
  }
  return { nickname: converted, generated: false };
}
