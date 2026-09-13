export const WEB_LOADER_MIN_WAIT_MS = 10_000;
export const WEB_LOADER_WAIT_SPREAD_MS = 5000;

export function webLoaderWaitMs(random: () => number = Math.random): number {
  return WEB_LOADER_MIN_WAIT_MS + Math.floor(random() * WEB_LOADER_WAIT_SPREAD_MS);
}

export type ImageLoadPhase = 'direct' | 'proxy' | 'failed';

export interface ImageLoadStep {
  phase: ImageLoadPhase;
  retry: boolean;
}

export function nextImageLoadPhase(
  phase: ImageLoadPhase,
  gif: boolean,
  webLoader: boolean,
): ImageLoadStep {
  if (phase === 'direct' && !gif && webLoader) {
    return { phase: 'proxy', retry: true };
  }
  return { phase: 'failed', retry: false };
}
