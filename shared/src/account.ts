export interface AccountView {
  username: string | null;
  nickname: string;
}

export interface AccountAvailability {
  google: boolean;
  passkey: boolean;
  devLogin: boolean;
  account: AccountView | null;
}

export interface AccountResponse {
  account: AccountView;
}

export interface HandleRequest {
  handle: string;
}

export interface DevLoginRequest {
  subject: string;
}

export interface LogoutResponse {
  ok: boolean;
}
