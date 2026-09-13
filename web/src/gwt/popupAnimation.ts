export const POPUP_ANIMATION_DURATION = 200;
export const POPUP_ANIMATION_EASING = 'cubic-bezier(0.37, 0, 0.63, 1)';

const CLIPPED = 'inset(50% 50% 50% 50%)';
const OPEN = 'inset(0% 0% 0% 0%)';

export function reducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function shouldAnimate(animated: boolean, reduced: boolean): boolean {
  return animated && !reduced;
}

export function popupKeyframes(showing: boolean): { clipPath: string }[] {
  return showing
    ? [{ clipPath: CLIPPED }, { clipPath: OPEN }]
    : [{ clipPath: OPEN }, { clipPath: CLIPPED }];
}

function run(el: HTMLElement, showing: boolean): Animation | null {
  if (typeof el.animate !== 'function') return null;
  return el.animate(popupKeyframes(showing), {
    duration: POPUP_ANIMATION_DURATION,
    easing: POPUP_ANIMATION_EASING,
    fill: 'none',
  });
}

export function playShow(el: HTMLElement): void {
  run(el, true);
}

export function playHide(el: HTMLElement): void {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.setAttribute('aria-hidden', 'true');
  clone.style.pointerEvents = 'none';
  for (const embed of clone.querySelectorAll('iframe, video, audio')) embed.removeAttribute('src');
  const parent = el.parentNode ?? document.body;
  parent.appendChild(clone);
  const animation = run(clone, false);
  if (!animation) {
    clone.remove();
    return;
  }
  const done = () => clone.remove();
  animation.addEventListener('finish', done);
  animation.addEventListener('cancel', done);
}
