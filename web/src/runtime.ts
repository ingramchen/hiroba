import type { ClientConfig } from '@hiroba/shared';
import { createTranslator, localeFromLocation, type Translator } from './i18n';

export type DeviceShape = 'RESPONSIVE' | 'DESKTOP' | 'COMPACT';

export const SHAPE_STORAGE_KEY = 'hiroba.deviceShape';

export function clearLoading(): void {
  (window as unknown as { hirobaClearLoading?: () => void }).hirobaClearLoading?.();
}

export function readShape(): DeviceShape {
  try {
    const raw = window.localStorage.getItem(SHAPE_STORAGE_KEY);
    if (raw === 'DESKTOP' || raw === 'COMPACT' || raw === 'RESPONSIVE') return raw;
  } catch {
    return 'DESKTOP';
  }
  return 'RESPONSIVE';
}

export function saveShape(shape: DeviceShape): void {
  try {
    window.localStorage.setItem(SHAPE_STORAGE_KEY, shape);
  } catch {
    /* storage unavailable */
  }
}

export function isWindows(): boolean {
  const ua = navigator.userAgent;
  return ua.indexOf('Windows') !== -1;
}

export function isHighDensity(): boolean {
  return window.devicePixelRatio > 1.3;
}

export function isEventSectionAsTop(shape: DeviceShape): boolean {
  if (shape === 'DESKTOP') return false;
  if (shape === 'COMPACT') return true;
  return document.documentElement.clientWidth <= 767;
}

export function applyViewportMeta(shape: DeviceShape): void {
  let meta = document.querySelector('meta[name="viewport"]');
  if (shape === 'DESKTOP') {
    if (meta) meta.setAttribute('content', '');
    return;
  }
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'viewport');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', 'width=device-width, initial-scale=1.0');
}

export function applyShellClasses(shape: DeviceShape, page: 'home' | 'square' | 'sys'): void {
  document.documentElement.classList.toggle('platform-windows', isWindows());
  const classes = ['shape-' + shape.toLowerCase()];
  if (page === 'square') classes.push('page-square');
  document.body.className = classes.join(' ');
}

let translator: Translator | null = null;

export function t(): Translator {
  if (!translator) {
    translator = createTranslator(
      localeFromLocation({ search: window.location.search, language: navigator.language }),
    );
  }
  return translator;
}

export function resetTranslator(): void {
  translator = null;
}

export function webLoaderKey(): string {
  const config = clientConfig();
  return config?.webLoaderKey ?? '';
}

export function mediaBase(): string {
  const config = clientConfig();
  return config?.mediaBase ?? '';
}

export function siteOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

function clientConfig(): Partial<ClientConfig> | undefined {
  return typeof window === 'undefined'
    ? undefined
    : (window as unknown as { hirobaConfig?: Partial<ClientConfig> }).hirobaConfig;
}
