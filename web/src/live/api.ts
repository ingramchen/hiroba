import { isStoreTooLargeFailure } from '@hiroba/shared';
import type {
  AccountResponse,
  AccountAvailability,
  AnchorExistsResponse,
  AnchorForbidRequest,
  AnchorForbidResponse,
  AnchorOkResponse,
  AnchorTopicRequest,
  CoAnchorRequest,
  CoAnchorsResponse,
  CrowdView,
  DevLoginRequest,
  HandleRequest,
  HomeView,
  KermaGrowRequest,
  KermaGrowth,
  LogoutResponse,
  PasskeyCreationOptionsResponse,
  PasskeyLoginVerifyRequest,
  PasskeyRegisterOptionsRequest,
  PasskeyRegisterVerifyRequest,
  PasskeyRequestOptionsResponse,
  PosterCreateRequest,
  PosterCreateResponse,
  PosterResponse,
  RecentVotesResponse,
  ShopResult,
  SquareStart,
  SquareStartRequest,
  SquareThumb,
  StoreThumbnailRequest,
  KermaShopRequest,
  UploadMediaFields,
  UploadMediaResponse,
  VoteApplyRequest,
  VoteAppliedResponse,
  VoteCastRequest,
  VoteCastResponse,
  VoteCreatedResponse,
} from '@hiroba/shared';

export type {
  AccountAvailability,
  AccountView,
  AnchorSquareView,
  CoAnchorView,
  HomeView,
  KermaGrowth,
  PosterView,
  ShopResult,
  SquareStart,
  SquareView,
  VoteCreator,
  VoteView,
} from '@hiroba/shared';

export type ApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string; type?: string; limitInBytes?: number };
// `type` is the storage failure family (STORE_*_TYPE in shared); `limitInBytes`
// rides along only on a too-large refusal

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: 'same-origin', ...init });
  } catch {
    return { ok: false, status: 0, error: 'NETWORK' };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const refused =
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : null;
  if (!res.ok) {
    const type =
      typeof body === 'object' &&
      body !== null &&
      typeof (body as { type?: unknown }).type === 'string'
        ? (body as { type: string }).type
        : null;
    return {
      ok: false,
      status: res.status,
      error: refused ?? 'HTTP_' + String(res.status),
      ...(type !== null ? { type } : {}),
      ...(isStoreTooLargeFailure(body) ? { limitInBytes: body.limitInBytes } : {}),
    };
  }
  if (refused !== null) {
    return { ok: false, status: res.status, error: refused };
  }
  return { ok: true, value: body as T };
}

function post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function startSquare(body: SquareStartRequest): Promise<ApiResult<SquareStart>> {
  return post<SquareStart>('/api/square/start', body);
}

export function growKerma(topic: string, permit: string): Promise<ApiResult<KermaGrowth>> {
  const body: KermaGrowRequest = { topic, permit };
  return post<KermaGrowth>('/api/kerma/grow', body);
}

export function buyKermaItem(body: KermaShopRequest): Promise<ApiResult<ShopResult>> {
  return post<ShopResult>('/api/kerma/shop', body);
}

export function loadHome(): Promise<ApiResult<HomeView>> {
  return request<HomeView>('/api/home');
}

export function loadCrowd(topic: string): Promise<ApiResult<CrowdView>> {
  return request<CrowdView>('/api/square/' + encodeURIComponent(topic) + '/crowd');
}

export function loadAccount(): Promise<ApiResult<AccountAvailability>> {
  return request<AccountAvailability>('/api/account');
}

export function claimHandle(handle: string): Promise<ApiResult<AccountResponse>> {
  const body: HandleRequest = { handle };
  return post<AccountResponse>('/api/account/handle', body);
}

export function logout(): Promise<ApiResult<LogoutResponse>> {
  return post<LogoutResponse>('/api/account/logout', {});
}

export function passkeyRegisterOptions(
  handle: string,
): Promise<ApiResult<PasskeyCreationOptionsResponse>> {
  const body: PasskeyRegisterOptionsRequest = { handle };
  return post<PasskeyCreationOptionsResponse>('/api/passkey/register/options', body);
}

export function passkeyRegisterVerify(
  body: PasskeyRegisterVerifyRequest,
): Promise<ApiResult<AccountResponse>> {
  return post<AccountResponse>('/api/passkey/register/verify', body);
}

export function passkeyLoginOptions(): Promise<ApiResult<PasskeyRequestOptionsResponse>> {
  return post<PasskeyRequestOptionsResponse>('/api/passkey/login/options', {});
}

export function passkeyLoginVerify(
  body: PasskeyLoginVerifyRequest,
): Promise<ApiResult<AccountResponse>> {
  return post<AccountResponse>('/api/passkey/login/verify', body);
}
export function createVote(body: Record<string, unknown>): Promise<ApiResult<VoteCreatedResponse>> {
  return post<VoteCreatedResponse>('/api/vote/create', body);
}

export function castVote(body: VoteCastRequest): Promise<ApiResult<VoteCastResponse>> {
  return post<VoteCastResponse>('/api/vote/cast', body);
}

export function applyVote(body: VoteApplyRequest): Promise<ApiResult<VoteAppliedResponse>> {
  return post<VoteAppliedResponse>('/api/vote/apply', body);
}

export function loadRecentVotes(topic: string): Promise<ApiResult<RecentVotesResponse>> {
  return request<RecentVotesResponse>('/api/vote/recent?topic=' + encodeURIComponent(topic));
}

export function anchorExists(topic: string): Promise<ApiResult<AnchorExistsResponse>> {
  return request<AnchorExistsResponse>('/api/anchor/exists?topic=' + encodeURIComponent(topic));
}

export function loadCoAnchors(topic: string): Promise<ApiResult<CoAnchorsResponse>> {
  return request<CoAnchorsResponse>('/api/anchor/co-anchors?topic=' + encodeURIComponent(topic));
}

export function createAnchor(topic: string): Promise<ApiResult<AnchorOkResponse>> {
  const body: AnchorTopicRequest = { topic };
  return post<AnchorOkResponse>('/api/anchor/create', body);
}

export function addCoAnchor(
  topic: string,
  username: string,
): Promise<ApiResult<CoAnchorsResponse>> {
  const body: CoAnchorRequest = { topic, username };
  return post<CoAnchorsResponse>('/api/anchor/co-anchor', body);
}

export function dismissAnchor(topic: string): Promise<ApiResult<AnchorOkResponse>> {
  const body: AnchorTopicRequest = { topic };
  return post<AnchorOkResponse>('/api/anchor/dismiss', body);
}

export function storeThumbnail(url: string, topic: string): Promise<ApiResult<SquareThumb>> {
  const body: StoreThumbnailRequest = { url, topic };
  return post('/api/storage/store-thumbnail', body);
}

export function uploadMedia(
  file: Blob,
  filename: string,
  fields: UploadMediaFields | null,
): Promise<ApiResult<UploadMediaResponse>> {
  const form = new FormData();
  form.append('file', file, filename);
  if (fields !== null) {
    form.append('topic', fields.topic);
    form.append('permit', fields.permit);
  }
  return request<UploadMediaResponse>('/api/storage/upload-media', { method: 'POST', body: form });
}

export function devLogin(subject: string): Promise<ApiResult<AccountResponse>> {
  const body: DevLoginRequest = { subject };
  return post<AccountResponse>('/api/dev/login', body);
}

export function createPoster(body: PosterCreateRequest): Promise<ApiResult<PosterCreateResponse>> {
  return post<PosterCreateResponse>('/api/poster/create', body);
}

export function loadPoster(topic: string): Promise<ApiResult<PosterResponse>> {
  return request<PosterResponse>('/api/poster?topic=' + encodeURIComponent(topic));
}

export function forbidByAnchor(
  topic: string,
  targetPublicId: string,
  nickname: string,
  unforbid: boolean,
): Promise<ApiResult<AnchorForbidResponse>> {
  const body: AnchorForbidRequest = { topic, targetPublicId, nickname, unforbid };
  return post<AnchorForbidResponse>('/api/anchor/forbid', body);
}
