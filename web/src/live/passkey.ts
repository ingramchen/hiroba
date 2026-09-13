import {
  startAuthentication,
  startRegistration,
  WebAuthnAbortService,
} from '@simplewebauthn/browser';
import { isIpLiteral } from '@hiroba/shared';
import type {
  AccountResponse,
  PasskeyLoginVerifyRequest,
  PasskeyRegisterVerifyRequest,
} from '@hiroba/shared';
import * as api from './api';
import type { ApiResult } from './api';

export type PasskeyAvailability = 'ok' | 'insecure' | 'ip-host' | 'unsupported';

export type PasskeyClientCode =
  | 'CANCELLED'
  | 'ABORTED'
  | 'AUTHENTICATOR_HAS_CREDENTIAL'
  | 'UNSUPPORTED'
  | 'HANDLE_TAKEN_AFTER_CREATE';

export function passkeyAvailability(env: {
  isSecureContext: boolean;
  hasPublicKeyCredential: boolean;
  hostname: string;
}): PasskeyAvailability {
  if (!env.isSecureContext) {
    return 'insecure';
  }
  if (!env.hasPublicKeyCredential) {
    return 'unsupported';
  }
  if (isIpLiteral(env.hostname)) {
    return 'ip-host';
  }
  return 'ok';
}

export function detectPasskeyAvailability(): PasskeyAvailability {
  return passkeyAvailability({
    isSecureContext: window.isSecureContext,
    hasPublicKeyCredential: typeof window.PublicKeyCredential === 'function',
    hostname: window.location.hostname,
  });
}

export function ceremonyErrorCode(error: unknown): PasskeyClientCode | 'VERIFY_FAILED' {
  const outer = error as { name?: unknown; cause?: unknown } | null;
  const cause = (outer?.cause ?? outer) as { name?: unknown } | null;
  const name = typeof cause?.name === 'string' ? cause.name : '';
  switch (name) {
    case 'NotAllowedError':
      return 'CANCELLED';
    case 'AbortError':
      return 'ABORTED';
    case 'InvalidStateError':
      return 'AUTHENTICATOR_HAS_CREDENTIAL';
    case 'SecurityError':
    case 'NotSupportedError':
      return 'UNSUPPORTED';
    default:
      return 'VERIFY_FAILED';
  }
}

function failed(error: unknown): ApiResult<never> {
  return { ok: false, status: 0, error: ceremonyErrorCode(error) };
}

export function cancelPasskeyCeremony(): void {
  WebAuthnAbortService.cancelCeremony();
}

export async function registerWithPasskey(
  handle: string,
  rememberMe: boolean,
): Promise<ApiResult<AccountResponse>> {
  const options = await api.passkeyRegisterOptions(handle);
  if (!options.ok) {
    return options;
  }
  let body: PasskeyRegisterVerifyRequest;
  try {
    body = {
      response: await startRegistration({ optionsJSON: options.value.options }),
      rememberMe,
    };
  } catch (error) {
    return failed(error);
  }
  const verified = await api.passkeyRegisterVerify(body);
  if (!verified.ok && verified.error === 'HANDLE_TAKEN') {
    return { ...verified, error: 'HANDLE_TAKEN_AFTER_CREATE' };
  }
  return verified;
}

export async function loginWithPasskey(rememberMe: boolean): Promise<ApiResult<AccountResponse>> {
  const options = await api.passkeyLoginOptions();
  if (!options.ok) {
    return options;
  }
  let body: PasskeyLoginVerifyRequest;
  try {
    body = {
      response: await startAuthentication({ optionsJSON: options.value.options }),
      rememberMe,
    };
  } catch (error) {
    return failed(error);
  }
  return api.passkeyLoginVerify(body);
}
