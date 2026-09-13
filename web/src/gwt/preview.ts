export type PreviewEntry = {
  root: () => HTMLElement | null;
  partner: () => HTMLElement | null;
  autoHide: boolean;
  modal: boolean;
  hide: () => void;
};

const TYPES = [
  'click',
  'dblclick',
  'mousedown',
  'mouseup',
  'mousemove',
  'mouseover',
  'mouseout',
  'wheel',
  'keydown',
  'keyup',
  'keypress',
  'touchstart',
  'touchend',
  'touchmove',
  'touchcancel',
];

const OPTIONS: AddEventListenerOptions = { capture: true, passive: false };

const stack: PreviewEntry[] = [];
let listening = false;

function targets(entry: PreviewEntry, root: HTMLElement, target: Node | null): boolean {
  if (!target) return false;
  if (root.contains(target)) return true;
  const partner = entry.partner();
  return !!partner && partner.contains(target);
}

function preview(event: Event) {
  const target = event.target as Node | null;
  let canceled = false;
  let consumed = false;
  for (let i = stack.length - 1; i >= 0; i--) {
    const entry = stack[i];
    const root = entry.root();
    if (!root) continue;
    if (canceled || consumed) {
      if (entry.modal) canceled = true;
      continue;
    }
    const inside = targets(entry, root, target);
    if (inside) consumed = true;
    if (entry.modal) canceled = true;
    if (!inside && entry.autoHide && (event.type === 'mousedown' || event.type === 'touchstart'))
      entry.hide();
  }
  if (canceled && !consumed) {
    event.stopPropagation();
    if (event.cancelable) event.preventDefault();
  }
}

function listen(on: boolean) {
  if (on === listening) return;
  listening = on;
  for (const type of TYPES) {
    if (on) window.addEventListener(type, preview, OPTIONS);
    else window.removeEventListener(type, preview, true);
  }
}

export function registerPreview(entry: PreviewEntry): () => void {
  stack.push(entry);
  listen(true);
  return () => {
    const at = stack.indexOf(entry);
    if (at >= 0) stack.splice(at, 1);
    if (stack.length === 0) listen(false);
  };
}

export type DragOffset = { x: number; y: number };

export function dragOffset(pageX: number, pageY: number, left: number, top: number): DragOffset {
  return { x: pageX - left, y: pageY - top };
}

export function dragPosition(
  pageX: number,
  pageY: number,
  offset: DragOffset,
  windowWidth: number,
): { left: number; top: number } | null {
  if (pageX < 0 || pageX >= windowWidth || pageY < 0) return null;
  return { left: pageX - offset.x, top: pageY - offset.y };
}
