import type {
  SysAuditResponse,
  SysBanResponse,
  SysChattersResponse,
  SysForbidResponse,
  SysImageDeleteResponse,
  SysImagesResponse,
  SysJoinRecordsResponse,
  SysOkResponse,
  SysRemoveResponse,
  SysSealResponse,
  SysStatsResponse,
  SysTopicsResponse,
} from '@hiroba/shared';

export type { SysChatter, SysForbidden } from '@hiroba/shared';

export type SysResult<T> = { ok: true; data: T } | { ok: false; status: number };

async function call<T>(path: string, init: RequestInit = {}): Promise<SysResult<T>> {
  let res: Response;
  try {
    res = await fetch('/api/sys' + path, {
      credentials: 'same-origin',
      ...init,
      ...(init.body === undefined ? {} : { headers: { 'content-type': 'application/json' } }),
    });
  } catch {
    return { ok: false, status: 0 };
  }
  if (!res.ok) {
    return { ok: false, status: res.status };
  }
  return { ok: true, data: (await res.json()) as T };
}

function post<T>(path: string, body: unknown): Promise<SysResult<T>> {
  return call<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export function probeSession(): Promise<SysResult<SysOkResponse>> {
  return call<SysOkResponse>('/session');
}

export function authenticate(password: string): Promise<SysResult<SysOkResponse>> {
  return post<SysOkResponse>('/authenticate', { password });
}

export function loadTopics(): Promise<SysResult<SysTopicsResponse>> {
  return call<SysTopicsResponse>('/squares');
}

export function loadChatters(topic: string): Promise<SysResult<SysChattersResponse>> {
  return call<SysChattersResponse>('/squares/' + encodeURIComponent(topic) + '/chatters');
}

export function broadcast(topic: string, content: string): Promise<SysResult<SysTopicsResponse>> {
  return post<SysTopicsResponse>('/broadcast', { topic, content });
}

export function removeSquare(
  topic: string,
  permanent: boolean,
): Promise<SysResult<SysRemoveResponse>> {
  return post<SysRemoveResponse>('/squares/remove', { topic, permanent });
}

export function sealSquare(topic: string): Promise<SysResult<SysSealResponse>> {
  return post<SysSealResponse>('/squares/seal', { topic });
}

export function forbid(
  topic: string,
  targetPublicId: string,
  unforbid: boolean,
): Promise<SysResult<SysForbidResponse>> {
  return post<SysForbidResponse>('/forbid', { topic, targetPublicId, unforbid });
}

export function deleteImage(
  url: string,
  topic: string,
  senderPublicId: string,
): Promise<SysResult<SysImageDeleteResponse>> {
  return post<SysImageDeleteResponse>('/images/delete', { url, topic, senderPublicId });
}

export function ban(privateId: string, unban: boolean): Promise<SysResult<SysBanResponse>> {
  return post<SysBanResponse>('/ban', { privateId, unban });
}

export function loadStats(days: number): Promise<SysResult<SysStatsResponse>> {
  return call<SysStatsResponse>('/stats?days=' + String(days));
}

export function loadImages(limit: number): Promise<SysResult<SysImagesResponse>> {
  return call<SysImagesResponse>('/images?limit=' + String(limit));
}

export function loadAudit(limit: number): Promise<SysResult<SysAuditResponse>> {
  return call<SysAuditResponse>('/audit?limit=' + String(limit));
}

export function searchJoinRecords(query: {
  address?: string;
  publicId?: string;
  topic?: string;
}): Promise<SysResult<SysJoinRecordsResponse>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value.trim().length > 0) params.set(key, value.trim());
  }
  return call<SysJoinRecordsResponse>('/join-records?' + params.toString());
}

export function topTopics(minCrowd: number): Promise<SysResult<Record<string, number>>> {
  return (async () => {
    try {
      const res = await fetch('/stat/top-topic?min-no-of-crowd=' + String(minCrowd), {
        credentials: 'same-origin',
      });
      if (!res.ok) return { ok: false as const, status: res.status };
      return { ok: true as const, data: (await res.json()) as Record<string, number> };
    } catch {
      return { ok: false as const, status: 0 };
    }
  })();
}
