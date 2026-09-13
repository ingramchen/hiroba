export const LOCALES = ['zh_TW', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export function normaliseLanguageTag(input: string | null | undefined): string {
  const tag = input ?? '';
  if (tag.length >= 5) {
    return `${tag.substring(0, 2)}_${tag.substring(3, 5).toUpperCase()}`;
  }
  if (tag.length === 2) {
    return tag.substring(0, 2);
  }
  return 'en_US';
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export interface LocaleSources {
  query?: string | null;
  language?: string | null;
}

export function resolveLocale(sources: LocaleSources = {}): Locale {
  const requested = sources.query;
  if (requested && isLocale(requested)) return requested;
  const detected = normaliseLanguageTag(sources.language);
  return isLocale(detected) ? detected : DEFAULT_LOCALE;
}

export function localeFromLocation(location: {
  search?: string;
  language?: string | null;
}): Locale {
  const params = new URLSearchParams(location.search ?? '');
  return resolveLocale({ query: params.get('locale'), language: location.language ?? null });
}
