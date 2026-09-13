import { ref, type Ref } from 'vue';
import { loadAutoPlayVideo, saveAutoPlayVideo } from '../live/storage';

export const AUTO_PLAY_PROBE_DELAY_MS = 10_000;
export const AUTO_PLAY_PROBE_WAIT_MS = 500;
export const AUTO_PLAY_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

export type AutoPlayStatus = 'SUPPORT' | 'NOT_SUPPORT';

const PROBE_SRC =
  'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhtZGF0';

export function parseAutoPlayStatus(raw: string | null, now: number): AutoPlayStatus | null {
  if (raw === null) {
    return null;
  }
  const split = raw.split(':');
  if (split.length !== 2) {
    return null;
  }
  const expire = Number(split[0]);
  if (!Number.isFinite(expire) || now > expire) {
    return null;
  }
  const status = split[1];
  return status === 'SUPPORT' || status === 'NOT_SUPPORT' ? status : null;
}

export function autoPlayStorageValue(status: AutoPlayStatus, now: number): string {
  return String(now + AUTO_PLAY_CACHE_MS) + ':' + status;
}

const cached = parseAutoPlayStatus(loadAutoPlayVideo(), Date.now());
const supported = ref(cached === 'SUPPORT');
let detected = cached !== null;
let scheduled = false;

export function autoPlaySupported(): Ref<boolean> {
  return supported;
}

function record(result: boolean): void {
  const status: AutoPlayStatus = result ? 'SUPPORT' : 'NOT_SUPPORT';
  detected = true;
  supported.value = result;
  saveAutoPlayVideo(autoPlayStorageValue(status, Date.now()));
}

function probe(): void {
  const element = document.createElement('video');
  if (!('autoplay' in element)) {
    record(false);
    return;
  }
  let timer = 0;
  const settle = (playing: boolean): void => {
    window.clearTimeout(timer);
    element.removeEventListener('playing', onPlaying);
    record(playing || element.currentTime !== 0);
    element.remove();
  };
  const onPlaying = (): void => {
    settle(true);
  };
  try {
    element.src = PROBE_SRC;
  } catch {
    record(false);
    return;
  }
  element.setAttribute('autoplay', '');
  element.muted = true;
  element.style.cssText = 'position:absolute;height:0;width:0;display:none';
  document.body.appendChild(element);
  window.setTimeout(() => {
    element.addEventListener('playing', onPlaying);
    timer = window.setTimeout(() => {
      settle(false);
    }, AUTO_PLAY_PROBE_WAIT_MS);
  }, 0);
}

export function startAutoPlayDetect(): void {
  if (detected || scheduled) {
    return;
  }
  scheduled = true;
  window.setTimeout(probe, AUTO_PLAY_PROBE_DELAY_MS);
}
