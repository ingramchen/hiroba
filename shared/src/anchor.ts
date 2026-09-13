export interface CoAnchorView {
  username: string;
  accountDomain: string;
}

export interface AnchorSquareView {
  topic: string;
  anchorUsername: string;
  sealed: boolean;
}

export interface AnchorTopicRequest {
  topic: string;
}

export interface CoAnchorRequest {
  topic: string;
  username: string;
}

export interface AnchorForbidRequest {
  topic: string;
  targetPublicId: string;
  nickname: string;
  unforbid: boolean;
}

export interface AnchorExistsResponse {
  exists: boolean;
}

export interface AnchorOkResponse {
  ok: boolean;
}

export interface CoAnchorsResponse {
  coAnchors: CoAnchorView[];
}

export interface AnchorForbidResponse {
  affected: string[];
}
