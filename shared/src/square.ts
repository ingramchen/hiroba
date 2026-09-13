import type { ModerationStates } from './moderation.js';
import type { AccountView } from './account.js';
import type { AnchorSquareView, CoAnchorView } from './anchor.js';
import type { ChatroomType } from './kerma.js';
import type { PosterView } from './poster.js';
import type { SquareChatter } from './wire.js';

export interface SquareStartRequest {
  topic: string;
  anonymousId?: string | null;
  nickname?: string;
  locale?: string;
}

export interface SquareStart {
  topic: string;
  anonymousId: string | null;
  publicId: string;
  colorToken: string | null;
  colorHex: string;
  nickname: string;
  generatedNickname: boolean;
  ipsHash: string;
  sealed: boolean;
  serverTime: number;
  token: string;
  permit: string;
  kerma: number;
  minKermaValue: number | null;
  chatroomType: ChatroomType;
  kermaEnough: boolean;
  chatFreeze: boolean;
  forbidden: boolean;
  washGuardAllowance: number;
  anchorSquare: AnchorSquareView | null;
  coAnchors: CoAnchorView[];
  account: AccountView | null;
  forbidFromChatDuration: number;
  showColorDuration: number;
  poster: PosterView | null;
  moderation: ModerationStates;
}

export interface CrowdView {
  topic: string;
  crowd: number;
  chatters: SquareChatter[];
}

export interface KermaGrowRequest {
  topic: string;
  permit: string;
}

export interface KermaGrowth {
  kerma: number;
  serverTime: number;
}

export interface KermaShopRequest {
  topic: string;
  permit: string;
  item: string;
  nickname?: string;
}

export interface ShopResult {
  kerma: number;
  colorToken: string | null;
  colorHex: string;
  forbidFromChatDuration: number;
  showColorDuration: number;
}

export interface UploadMediaFields {
  topic: string;
  permit: string;
}

export interface UploadMediaResponse {
  url: string;
}
