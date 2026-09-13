import * as en from './generated/en';
import * as zhTW from './generated/zh-TW';
import { formatMessage, type MessageArg } from './format';
import { DEFAULT_LOCALE, type Locale } from './locale';

export type MessageKey = keyof typeof zhTW.messages;
export type TransportKey = keyof typeof zhTW.transport;

const BUNDLES = {
  zh_TW: zhTW,
  en: en,
} as const satisfies Record<Locale, { messages: unknown; transport: unknown }>;

export interface Translator {
  locale: Locale;
  t(key: MessageKey, ...args: MessageArg[]): string;
  transport(key: TransportKey, ...args: MessageArg[]): string;
}

export function createTranslator(locale: Locale = DEFAULT_LOCALE): Translator {
  const bundle = BUNDLES[locale] ?? BUNDLES[DEFAULT_LOCALE];
  const fallback = BUNDLES[DEFAULT_LOCALE];
  return {
    locale,
    t(key, ...args) {
      const template: string | undefined = bundle.messages[key] ?? fallback.messages[key];
      return template === undefined ? key : formatMessage(template, args);
    },
    transport(key, ...args) {
      const template: string | undefined = bundle.transport[key] ?? fallback.transport[key];
      return template === undefined ? key : formatMessage(template, args);
    },
  };
}

export { BUNDLES };
export * from './format';
export * from './locale';
