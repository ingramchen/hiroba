import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';

export type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
};

export type PasskeyErrorCode =
  | 'PASSKEY_UNAVAILABLE'
  | 'INVALID_HANDLE'
  | 'HANDLE_RESERVED'
  | 'HANDLE_TAKEN'
  | 'CHALLENGE_EXPIRED'
  | 'VERIFY_FAILED'
  | 'UNKNOWN_CREDENTIAL'
  | 'COUNTER_REGRESSION'
  | 'CREDENTIAL_EXISTS'
  | 'NOT_LOGIN'
  | 'TOO_MANY_ATTEMPTS';

export interface PasskeyRegisterOptionsRequest {
  handle: string;
}

export interface PasskeyCreationOptionsResponse {
  options: PublicKeyCredentialCreationOptionsJSON;
}

export interface PasskeyRegisterVerifyRequest {
  response: RegistrationResponseJSON;
  rememberMe: boolean;
}

export type PasskeyLoginOptionsRequest = Record<string, never>;

export interface PasskeyRequestOptionsResponse {
  options: PublicKeyCredentialRequestOptionsJSON;
}

export interface PasskeyLoginVerifyRequest {
  response: AuthenticationResponseJSON;
  rememberMe: boolean;
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u;

export function isIpLiteral(host: string): boolean {
  if (host.includes(':')) {
    return true;
  }
  const match = IPV4.exec(host);
  if (match === null) {
    return false;
  }
  return match.slice(1).every((part) => part.length <= 3 && Number(part) <= 255);
}
