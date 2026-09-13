import type { MessageEvent } from './events.js';

export interface SquareThumb {
  url: string;
  width: number;
  height: number;
}

export interface StoreThumbnailRequest {
  url: string;
  topic?: string;
}

export interface SquareView {
  topic: string;
  crowd: number;
  latestMessages: MessageEvent[];
  thumb: SquareThumb | null;
}

export interface HomeView {
  totalCrowd: number;
  hot: SquareView[];
  latest: SquareView[];
}
