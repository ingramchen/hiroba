export const SYS_CONSOLE_PATH = '/-/sys';

export interface SysChatter {
  publicId: string;
  privateId: string;
  nickname: string;
  colorToken: string | null;
  ips: string;
  address: string;
  kermaForbidForever: boolean;
}

export interface SysForbidden {
  publicId: string;
  nickname: string;
}

export interface SysOkResponse {
  ok: boolean;
}

export interface SysTopicsResponse {
  topics: string[];
}

export interface SysChattersResponse {
  topic: string;
  chatters: SysChatter[];
}

export interface SysRemoveResponse {
  topic: string;
  permanent: boolean;
}

export interface SysSealResponse {
  topic: string;
  sealed: boolean;
}

export interface SysForbidResponse {
  affected: SysForbidden[];
}

export type SysAuditTargetType = 'none' | 'topic' | 'publicId' | 'privateId';

export interface SysAuditEntry {
  id: number;
  time: number;
  actor: string;
  session: string;
  action: string;
  targetType: SysAuditTargetType;
  target: string;
  topic: string;
  detail: string;
}

export interface SysAuditResponse {
  entries: SysAuditEntry[];
}

export interface SysBanResponse {
  privateId: string;
  publicId: string;
  forbidForever: boolean;
}

export interface SysStatPoint {
  day: string;
  count: number;
}

export interface SysStatTotals {
  accounts: number;
  anonymous: number;
  messages: number;
  squares: number;
}

export interface SysStatsResponse {
  days: number;
  since: number;
  timeZone: string;
  timeZoneConfigured: boolean;
  accounts: SysStatPoint[];
  anonymous: SysStatPoint[];
  messages: SysStatPoint[];
  squares: SysStatPoint[];
  posters: SysStatPoint[];
  votings: SysStatPoint[];
  totals: SysStatTotals;
  crowd: number;
  liveSquares: number;
}

export interface SysImage {
  url: string;
  topic: string;
  time: number;
  senderPublicId: string;
  senderNickname: string;
}

export interface SysImagesResponse {
  images: SysImage[];
  startedAt: number;
}

export interface SysImageDeleteResponse {
  url: string;
  deleted: boolean;
}

export interface SysJoinRecord {
  topic: string;
  publicId: string;
  privateId: string;
  nickname: string;
  ips: string;
  address: string;
  joinTime: number;
  forbid: boolean;
}

export interface SysJoinRecordsResponse {
  records: SysJoinRecord[];
  retentionMs: number;
}
