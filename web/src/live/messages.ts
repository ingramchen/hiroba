import { createTranslator, formatMessage, type Locale, type MessageArg } from '../i18n';
import type { PasskeyErrorCode } from '@hiroba/shared';
import type { PasskeyClientCode } from './passkey';

export type LiveKey =
  | 'handleTitle'
  | 'handleDesc'
  | 'handleTaken'
  | 'handleInvalid'
  | 'handleReserved'
  | 'handleAlreadySet'
  | 'handleRequired'
  | 'loginUnavailable'
  | 'devLoginTitle'
  | 'devLoginDesc'
  | 'devLoginFailed'
  | 'devLoginTokenRequired'
  | 'googleNotConfigured'
  | 'passkeyLogin'
  | 'passkeyNeedsHttps'
  | 'passkeyNeedsHostname'
  | 'passkeyUnsupported'
  | 'passkeyCancelled'
  | 'passkeyExists'
  | 'passkeyVerifyFailed'
  | 'passkeyChallengeExpired'
  | 'passkeyUnknownCredential'
  | 'passkeyHandleTakenAfterCreate'
  | 'passkeyTooMany';

const TEXT: Record<Locale, Record<LiveKey, string>> = {
  zh_TW: {
    handleTitle: '選擇代號',
    handleDesc: '請選一個公開代號，1-15 個英文字母、數字或底線。其他人會用這個代號指定你。',
    handleTaken: '這個代號已經有人用了',
    handleInvalid: '代號只能用 1-15 個英文字母、數字或底線',
    handleReserved: '這個代號不開放使用',
    handleAlreadySet: '代號已經設定過，不能更改',
    handleRequired: '請先設定你的代號',
    loginUnavailable: '這個站台沒有開啟登入功能',
    devLoginTitle: '開發用登入',
    devLoginDesc: '僅供本機開發：輸入任一識別字串即可取得帳號連線，正式站台不會開啟。',
    devLoginFailed: '開發用登入失敗',
    devLoginTokenRequired:
      '這個瀏覽器不在 loopback 上，需要先用開發用登入權杖：在網址列開一次 /api/dev/login?token=<權杖>，權杖印在伺服器啟動時的警告訊息裡（README 的 "The development login"）。',
    googleNotConfigured: '未設定 Google 登入',
    passkeyLogin: '使用通行密鑰登入',
    passkeyNeedsHttps: '通行密鑰需要 https（或 localhost）',
    passkeyNeedsHostname: '通行密鑰不能用 IP 位址開的網頁，請改用網域名稱',
    passkeyUnsupported: '這個瀏覽器不支援通行密鑰',
    passkeyCancelled: '通行密鑰操作已取消',
    passkeyExists: '這個裝置已經有這個帳號的通行密鑰了',
    passkeyVerifyFailed: '通行密鑰驗證失敗，請再試一次',
    passkeyChallengeExpired: '逾時了，請重新開始',
    passkeyUnknownCredential: '這個通行密鑰不屬於任何帳號',
    passkeyHandleTakenAfterCreate:
      '代號剛被別人用掉了；請在密碼管理員刪除剛建立的通行密鑰，換個代號再試',
    passkeyTooMany: '嘗試太多次，請稍後再試',
  },
  en: {
    handleTitle: 'Choose a handle',
    handleDesc:
      'Pick a public handle: 1-15 letters, digits or underscores. Other people use it to refer to you.',
    handleTaken: 'That handle is already taken',
    handleInvalid: 'A handle is 1-15 letters, digits or underscores',
    handleReserved: 'That handle is not available',
    handleAlreadySet: 'Your handle is already set and cannot be changed',
    handleRequired: 'Set your handle first',
    loginUnavailable: 'Login is not enabled on this site',
    devLoginTitle: 'Development login',
    devLoginDesc:
      'Local development only: type any subject to get an account session. A real deployment never enables this.',
    devLoginFailed: 'Development login failed',
    devLoginTokenRequired:
      'This browser is not on plain loopback, so the development login needs its token: open /api/dev/login?token=<token> once in the address bar. The token is printed in the server startup warning (README, "The development login").',
    googleNotConfigured: 'Google login is not configured',
    passkeyLogin: 'Sign in with a passkey',
    passkeyNeedsHttps: 'Passkeys need https (or localhost)',
    passkeyNeedsHostname: 'Passkeys do not work on a page opened by IP address; use a host name',
    passkeyUnsupported: 'This browser does not support passkeys',
    passkeyCancelled: 'The passkey operation was cancelled',
    passkeyExists: 'This device already holds a passkey for this account',
    passkeyVerifyFailed: 'Passkey verification failed, please try again',
    passkeyChallengeExpired: 'Timed out, please start again',
    passkeyUnknownCredential: 'This passkey does not belong to any account',
    passkeyHandleTakenAfterCreate:
      'Someone just took that handle; delete the passkey you just created in your password manager and try another handle',
    passkeyTooMany: 'Too many attempts, try again later',
  },
};

export function liveText(locale: Locale, key: LiveKey, ...args: MessageArg[]): string {
  return formatMessage(TEXT[locale][key], args);
}

export function handleErrorText(locale: Locale, code: string): string {
  switch (code) {
    case 'HANDLE_TAKEN':
      return liveText(locale, 'handleTaken');
    case 'INVALID_HANDLE':
      return liveText(locale, 'handleInvalid');
    case 'HANDLE_RESERVED':
      return liveText(locale, 'handleReserved');
    case 'HANDLE_ALREADY_SET':
      return liveText(locale, 'handleAlreadySet');
    case 'NO_HANDLE':
      return liveText(locale, 'handleRequired');
    case 'DUPLICATE_TOPIC':
      return createTranslator(locale).t('duplicateTopicException');
    case 'NOT_LOGIN':
      return createTranslator(locale).t('notLoginException');
    case 'SQUARE_LOCK_PUBLIC':
      return createTranslator(locale).t('squareLockPublicException');
    default:
      return code;
  }
}

const PASSKEY_KEYS = {
  PASSKEY_UNAVAILABLE: 'passkeyNeedsHostname',
  CHALLENGE_EXPIRED: 'passkeyChallengeExpired',
  VERIFY_FAILED: 'passkeyVerifyFailed',
  COUNTER_REGRESSION: 'passkeyVerifyFailed',
  UNKNOWN_CREDENTIAL: 'passkeyUnknownCredential',
  CREDENTIAL_EXISTS: 'passkeyExists',
  AUTHENTICATOR_HAS_CREDENTIAL: 'passkeyExists',
  HANDLE_TAKEN_AFTER_CREATE: 'passkeyHandleTakenAfterCreate',
  CANCELLED: 'passkeyCancelled',
  ABORTED: 'passkeyCancelled',
  UNSUPPORTED: 'passkeyUnsupported',
  TOO_MANY_ATTEMPTS: 'passkeyTooMany',
} as const satisfies Record<
  Exclude<
    PasskeyErrorCode | PasskeyClientCode,
    'INVALID_HANDLE' | 'HANDLE_RESERVED' | 'HANDLE_TAKEN' | 'NOT_LOGIN'
  >,
  LiveKey
>;

export function passkeyErrorText(locale: Locale, code: string): string {
  if (code === 'INVALID_HANDLE' || code === 'HANDLE_RESERVED' || code === 'HANDLE_TAKEN') {
    return handleErrorText(locale, code);
  }
  if (code === 'NOT_LOGIN') {
    return createTranslator(locale).t('notLoginException');
  }
  const key = (PASSKEY_KEYS as Record<string, LiveKey | undefined>)[code];
  return key === undefined ? code : liveText(locale, key);
}
