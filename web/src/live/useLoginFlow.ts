import { ref, type Ref } from 'vue';
import { isReservedHandle, isValidHandle } from '@hiroba/shared';
import { t } from '../runtime';
import * as api from './api';
import { handleErrorText, liveText, passkeyErrorText } from './messages';
import {
  cancelPasskeyCeremony,
  detectPasskeyAvailability,
  loginWithPasskey,
  registerWithPasskey,
  type PasskeyAvailability,
} from './passkey';
import type { PopupPosition } from '../gwt/Popup.vue';

export function googleLoginUrl(pathname: string, remember: boolean): string {
  return (
    '/auth/google/start?return_to=' +
    encodeURIComponent(pathname) +
    '&remember=' +
    (remember ? '1' : '0')
  );
}

export interface LoginFlow {
  account: Ref<api.AccountView | null>;
  googleAvailable: Ref<boolean>;
  devLoginAvailable: Ref<boolean>;
  loginOpen: Ref<boolean>;
  loginRemember: Ref<boolean>;
  loginError: Ref<string>;
  passkeyAvailable: Ref<PasskeyAvailability>;
  devLoginOpen: Ref<boolean>;
  devLoginSubject: Ref<string>;
  devLoginError: Ref<string>;
  logoutConfirm: Ref<string>;
  handleOpen: Ref<boolean>;
  handleValue: Ref<string>;
  handleError: Ref<string>;
  handlePurpose: Ref<'claim' | 'register'>;
  loginAnchor: Ref<PopupPosition | null>;
  openRegisterHandle: () => void;
  closeHandleDialog: () => void;
  startLogin: (rect?: DOMRect) => void;
  openLoginDialog: () => void;
  closeLoginDialog: () => void;
  acceptLogin: (view: api.AccountView) => void;
  acceptLogout: () => void;
  startGoogleLogin: () => void;
  submitPasskeyLogin: () => Promise<void>;
  submitPasskeyRegister: () => Promise<void>;
  submitDevLogin: () => Promise<void>;
  submitHandle: () => Promise<void>;
}

export function useLoginFlow(options: { onOpenLogin?: () => void } = {}): LoginFlow {
  const i18n = t();
  const account = ref<api.AccountView | null>(null);
  const googleAvailable = ref(false);
  const devLoginAvailable = ref(false);
  const loginOpen = ref(false);
  const loginRemember = ref(true);
  const loginError = ref('');
  const passkeyAvailable = ref<PasskeyAvailability>('ok');
  const devLoginOpen = ref(false);
  const devLoginSubject = ref('');
  const devLoginError = ref('');
  const logoutConfirm = ref('');
  const handleOpen = ref(false);
  const handleValue = ref('');
  const handleError = ref('');
  const handlePurpose = ref<'claim' | 'register'>('claim');
  const loginAnchor = ref<PopupPosition | null>(null);

  function openRegisterHandle(): void {
    handlePurpose.value = 'register';
    handleValue.value = '';
    handleError.value = '';
    handleOpen.value = true;
  }

  function closeHandleDialog(): void {
    handleOpen.value = false;
    handlePurpose.value = 'claim';
  }

  function openLoginDialog(): void {
    options.onOpenLogin?.();
    devLoginOpen.value = false;
    loginError.value = '';
    passkeyAvailable.value = detectPasskeyAvailability();
    loginOpen.value = true;
  }

  function startLogin(rect?: DOMRect): void {
    loginAnchor.value =
      rect === undefined
        ? null
        : {
            mode: 'relativeToElement',
            rect: {
              left: rect.left + window.scrollX,
              top: rect.top + window.scrollY,
              width: rect.width,
              height: rect.height,
            },
          };
    if (devLoginAvailable.value) {
      devLoginError.value = '';
      devLoginOpen.value = true;
      return;
    }
    openLoginDialog();
  }

  function closeLoginDialog(): void {
    loginOpen.value = false;
    cancelPasskeyCeremony();
  }

  function acceptLogin(view: api.AccountView): void {
    loginOpen.value = false;
    loginError.value = '';
    account.value = view;
    if (view.username === null) {
      handleOpen.value = true;
    }
  }

  function acceptLogout(): void {
    logoutConfirm.value = '';
    void api.logout().then(() => {
      window.location.reload();
    });
  }

  function startGoogleLogin(): void {
    window.location.assign(googleLoginUrl(window.location.pathname, loginRemember.value));
  }

  async function submitPasskeyLogin(): Promise<void> {
    loginError.value = '';
    const result = await loginWithPasskey(loginRemember.value);
    if (!loginOpen.value) {
      return;
    }
    if (result.ok) {
      acceptLogin(result.value.account);
      return;
    }
    if (result.error === 'CANCELLED') {
      loginOpen.value = false;
      openRegisterHandle();
      return;
    }
    loginError.value = passkeyErrorText(i18n.locale, result.error);
  }

  async function submitPasskeyRegister(): Promise<void> {
    handleError.value = '';
    const handle = handleValue.value.trim();
    if (!isValidHandle(handle)) {
      handleError.value = liveText(i18n.locale, 'handleInvalid');
      return;
    }
    if (isReservedHandle(handle)) {
      handleError.value = liveText(i18n.locale, 'handleReserved');
      return;
    }
    const result = await registerWithPasskey(handle, loginRemember.value);
    if (result.ok) {
      closeHandleDialog();
      acceptLogin(result.value.account);
      return;
    }
    handleError.value = passkeyErrorText(i18n.locale, result.error);
  }

  async function submitDevLogin(): Promise<void> {
    const result = await api.devLogin(devLoginSubject.value);
    if (!result.ok) {
      devLoginError.value = liveText(
        i18n.locale,
        result.error === 'DEV_LOGIN_TOKEN_REQUIRED' ? 'devLoginTokenRequired' : 'devLoginFailed',
      );
      return;
    }
    devLoginOpen.value = false;
    account.value = result.value.account;
    if (result.value.account.username === null) {
      handleOpen.value = true;
    }
  }

  async function submitHandle(): Promise<void> {
    if (handlePurpose.value === 'register') {
      await submitPasskeyRegister();
      return;
    }
    const result = await api.claimHandle(handleValue.value);
    if (result.ok) {
      account.value = result.value.account;
      handleOpen.value = false;
      handleError.value = '';
      return;
    }
    handleError.value = handleErrorText(i18n.locale, result.error);
  }

  return {
    account,
    googleAvailable,
    devLoginAvailable,
    loginOpen,
    loginRemember,
    loginError,
    passkeyAvailable,
    devLoginOpen,
    devLoginSubject,
    devLoginError,
    logoutConfirm,
    handleOpen,
    handleValue,
    handleError,
    handlePurpose,
    loginAnchor,
    openRegisterHandle,
    closeHandleDialog,
    startLogin,
    openLoginDialog,
    closeLoginDialog,
    acceptLogin,
    acceptLogout,
    startGoogleLogin,
    submitPasskeyLogin,
    submitPasskeyRegister,
    submitDevLogin,
    submitHandle,
  };
}
