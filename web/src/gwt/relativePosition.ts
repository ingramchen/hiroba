import type { PopupPosition } from './Popup.vue';

export interface AnchorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Viewport {
  clientWidth: number;
  clientHeight: number;
  scrollX: number;
  scrollY: number;
}

export interface PopupSize {
  width: number;
  height: number;
}

export function relativePosition(
  anchor: AnchorRect,
  popup: PopupSize,
  viewport: Viewport,
): { left: number; top: number } {
  let left = Math.trunc(anchor.left);
  const widthDiff = popup.width - anchor.width;
  if (widthDiff > 0) {
    const windowRight = viewport.clientWidth + viewport.scrollX;
    const distanceToRight = windowRight - left;
    const distanceFromLeft = left - viewport.scrollX;
    if (distanceToRight < popup.width && distanceFromLeft >= widthDiff) {
      left -= widthDiff;
    }
  }

  let top = Math.trunc(anchor.top);
  const windowBottom = viewport.scrollY + viewport.clientHeight;
  const distanceFromTop = top - viewport.scrollY;
  const distanceToBottom = windowBottom - (top + anchor.height);
  if (distanceToBottom < popup.height && distanceFromTop >= popup.height) {
    top -= popup.height;
  } else {
    top += anchor.height;
  }

  return { left, top };
}

export function elementRect(element: Element): AnchorRect {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left + window.scrollX,
    top: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
  };
}

export function fixedOrElse(
  fallback: PopupPosition,
  left: number | undefined,
  top: number | undefined,
): PopupPosition {
  return left === undefined || top === undefined ? fallback : { mode: 'fixed', left, top };
}

export function fixedOrCenter(left: number | undefined, top: number | undefined): PopupPosition {
  return fixedOrElse({ mode: 'center' }, left, top);
}

export function anchoredOrFixedOrCenter(
  anchor: AnchorRect | undefined | null,
  left: number | undefined,
  top: number | undefined,
): PopupPosition {
  return anchor ? { mode: 'relativeToElement', rect: anchor } : fixedOrCenter(left, top);
}
