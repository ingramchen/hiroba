import type { Locale } from '../i18n';
import { handleErrorText } from './messages';

export function isTransportFailure(code: string): boolean {
  return code.length === 0 || code === 'NETWORK' || code.startsWith('HTTP_');
}

export function startFailureText(locale: Locale, code: string, fallback: string): string {
  return isTransportFailure(code) ? fallback : handleErrorText(locale, code);
}
