export const POSTER_TYPES = ['IMAGE', 'YOUTUBE'] as const;

export type PosterType = (typeof POSTER_TYPES)[number];

export interface PosterCreator {
  publicId: string;
  nickname: string;
  colorToken: string | null;
}

export interface PosterView {
  id: string;
  topic: string;
  creator: PosterCreator;
  mediaUrl: string;
  posterType: PosterType;
  content: string;
  createTime: number;
}

export interface PosterCreateRequest {
  topic: string;
  permit: string;
  nickname: string;
  colorToken: string | null;
  posterType: string;
  mediaUrl: string;
  content: string;
}

export interface PosterCreateResponse {
  poster: PosterView;
}

export interface PosterResponse {
  topic: string;
  poster: PosterView | null;
}
