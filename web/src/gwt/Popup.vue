<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import DecoratedBox from './DecoratedBox.vue';
import { dragOffset, dragPosition, registerPreview, type DragOffset } from './preview';
import { playHide, playShow, reducedMotion, shouldAnimate } from './popupAnimation';
import { relativePosition, type AnchorRect } from './relativePosition';
import type { MenuId } from './types';

export type PopupPosition =
  | { mode: 'center' }
  | { mode: 'topCenter' }
  | { mode: 'menuBarPopup'; index: number }
  | { mode: 'notification'; index: number }
  | { mode: 'relativeToMenuItem'; menuId: MenuId }
  | { mode: 'relativeToElement'; rect: AnchorRect }
  | { mode: 'fixed'; left: number; top: number };

const props = withDefaults(
  defineProps<{
    cls?: string;
    prefix?: string;
    caption?: string | null;
    captionHtml?: string | null;
    contentClass?: string;
    position?: PopupPosition;
    clipped?: boolean;
    inner?: boolean;
    zIndex?: number | undefined;
    autoHide?: boolean;
    modal?: boolean;
    visible?: boolean;
    animated?: boolean;
    placeKey?: number;
  }>(),
  {
    cls: 'gwt-DialogBox',
    prefix: 'dialog',
    caption: null,
    captionHtml: null,
    contentClass: '',
    position: () => ({ mode: 'center' }) as PopupPosition,
    clipped: false,
    inner: true,
    zIndex: undefined,
    autoHide: false,
    modal: false,
    visible: true,
    animated: false,
    placeKey: 0,
  },
);

const emit = defineEmits<{ autoHide: [] }>();

const root = ref<HTMLElement | null>(null);
const left = ref(0);
const top = ref(0);
const hidden = ref(false);
const moved = ref(false);

const viewportFixed = computed(() => {
  const mode = props.position.mode;
  return mode === 'center' || mode === 'topCenter' || mode === 'notification' || mode === 'fixed';
});

const STATUS_BAR = '.GlobalCssResource-statusPanel';

function trunc(value: number): number {
  return Math.trunc(value);
}

function statusItem(index: number): HTMLElement | null {
  const bar = document.querySelector(STATUS_BAR);
  if (!bar) return null;
  const cells = bar.querySelectorAll('.gwt-MenuItem, .gwt-MenuItemSeparator');
  const cell = cells[index] as HTMLElement | undefined;
  return cell && cell.classList.contains('gwt-MenuItem') ? cell : null;
}

function menuItem(menuId: MenuId): HTMLElement | null {
  const bar = document.querySelector(STATUS_BAR);
  if (!bar) return null;
  return bar.querySelector<HTMLElement>(`.gwt-MenuItem[data-menu-id="${menuId}"]`);
}

function anchorElement(): HTMLElement | null {
  const pos = props.position;
  if (pos.mode === 'menuBarPopup') return statusItem(pos.index);
  if (pos.mode === 'relativeToMenuItem') return menuItem(pos.menuId);
  return null;
}

function place() {
  const el = root.value;
  if (!el || moved.value) return;
  const pos = props.position;
  if (pos.mode === 'fixed') {
    left.value = pos.left;
    top.value = pos.top;
    return;
  }

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const clientW = document.documentElement.clientWidth;
  const clientH = document.documentElement.clientHeight;
  const popupW = el.offsetWidth;
  const popupH = el.offsetHeight;

  if (pos.mode === 'menuBarPopup') {
    const bar = document.querySelector(STATUS_BAR) as HTMLElement | null;
    const item = statusItem(pos.index);
    if (!bar || !item) return;
    const barRect = bar.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    let x = trunc(itemRect.left + scrollX);
    if (popupW < clientW) {
      x = Math.min(x, scrollX + clientW - popupW);
      x = Math.max(scrollX, x);
    }
    left.value = x;
    top.value = trunc(barRect.top + scrollY) + bar.offsetHeight;
    return;
  }

  if (pos.mode === 'relativeToMenuItem' || pos.mode === 'relativeToElement') {
    let anchor: AnchorRect;
    if (pos.mode === 'relativeToElement') {
      anchor = pos.rect;
    } else {
      const item = menuItem(pos.menuId);
      if (!item) return;
      const rect = item.getBoundingClientRect();
      anchor = {
        left: rect.left + scrollX,
        top: rect.top + scrollY,
        width: item.offsetWidth,
        height: item.offsetHeight,
      };
    }
    const placed = relativePosition(
      anchor,
      { width: popupW, height: popupH },
      { clientWidth: clientW, clientHeight: clientH, scrollX, scrollY },
    );
    left.value = placed.left;
    top.value = placed.top;
    return;
  }

  if (pos.mode === 'notification') {
    left.value = clientW - popupW - 50;
    top.value = 30 + (popupH + 10) * pos.index;
    return;
  }

  if (pos.mode === 'topCenter') {
    left.value = Math.max((clientW - popupW) >> 1, 0);
    top.value = Math.min(100, Math.max(0, trunc((clientH - popupH) / 2)));
    return;
  }

  left.value = Math.max((clientW - popupW) >> 1, 0);
  top.value = Math.max((clientH - popupH) >> 1, 0);
}

function partnerElement(): HTMLElement | null {
  if (props.position.mode !== 'menuBarPopup') return null;
  return (anchorElement()?.closest('.gwt-MenuBar') as HTMLElement | null) ?? null;
}

let handle: HTMLElement | null = null;
let offset: DragOffset | null = null;

function onHandleMouseDown(event: MouseEvent) {
  event.preventDefault();
}

function pointerX(event: PointerEvent): number {
  return viewportFixed.value ? event.clientX : event.pageX;
}

function pointerY(event: PointerEvent): number {
  return viewportFixed.value ? event.clientY : event.pageY;
}

function onHandlePointerDown(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || offset !== null) return;
  offset = dragOffset(pointerX(event), pointerY(event), left.value, top.value);
  handle?.setPointerCapture(event.pointerId);
}

function onHandlePointerMove(event: PointerEvent) {
  if (offset === null) return;
  const next = dragPosition(
    pointerX(event),
    pointerY(event),
    offset,
    document.documentElement.clientWidth,
  );
  if (!next) return;
  left.value = next.left;
  top.value = next.top;
  moved.value = true;
}

function onHandlePointerEnd() {
  offset = null;
}

function bindDrag() {
  if (props.caption === null && props.captionHtml === null) return;
  handle = root.value?.querySelector(`.${props.prefix}Top`) ?? null;
  if (!handle) return;
  handle.addEventListener('mousedown', onHandleMouseDown);
  handle.addEventListener('pointerdown', onHandlePointerDown);
  handle.addEventListener('pointermove', onHandlePointerMove);
  handle.addEventListener('pointerup', onHandlePointerEnd);
  handle.addEventListener('pointercancel', onHandlePointerEnd);
  handle.addEventListener('lostpointercapture', onHandlePointerEnd);
}

function unbindDrag() {
  if (!handle) return;
  handle.removeEventListener('mousedown', onHandleMouseDown);
  handle.removeEventListener('pointerdown', onHandlePointerDown);
  handle.removeEventListener('pointermove', onHandlePointerMove);
  handle.removeEventListener('pointerup', onHandlePointerEnd);
  handle.removeEventListener('pointercancel', onHandlePointerEnd);
  handle.removeEventListener('lostpointercapture', onHandlePointerEnd);
  handle = null;
  offset = null;
}

function replace() {
  moved.value = false;
  place();
}

watch(() => JSON.stringify(props.position), replace, { flush: 'post' });
watch(() => props.placeKey, replace, { flush: 'post' });
watch(
  () => props.visible,
  (visible) => {
    if (!visible) return;
    replace();
    if (animating() && root.value) playShow(root.value);
  },
  { flush: 'post' },
);

let observer: ResizeObserver | null = null;

function onViewportChange() {
  place();
}

let unregister: (() => void) | null = null;
let closed = false;

function animating(): boolean {
  return shouldAnimate(props.animated, reducedMotion());
}

function close() {
  if (closed) return;
  closed = true;
  const el = root.value;
  if (el && animating()) playHide(el);
}

onMounted(() => {
  place();
  bindDrag();
  window.addEventListener('resize', onViewportChange);
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    observer = new ResizeObserver(onViewportChange);
    observer.observe(root.value);
  }
  if (props.visible && animating() && root.value) playShow(root.value);
  unregister = registerPreview({
    root: () => root.value,
    partner: partnerElement,
    autoHide: props.autoHide,
    modal: props.modal,
    hide: () => {
      if (hidden.value) return;
      close();
      hidden.value = true;
      emit('autoHide');
    },
  });
});

onBeforeUnmount(() => {
  close();
  window.removeEventListener('resize', onViewportChange);
  observer?.disconnect();
  observer = null;
  unbindDrag();
  unregister?.();
  unregister = null;
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="!hidden"
      ref="root"
      :class="props.cls"
      :style="{
        left: left + 'px',
        top: top + 'px',
        ...(props.zIndex === undefined ? {} : { 'z-index': String(props.zIndex) }),
        ...(props.visible ? {} : { display: 'none' }),
        visibility: 'visible',
        position: viewportFixed ? 'fixed' : 'absolute',
        ...(props.clipped ? { clip: 'rect(auto, auto, auto, auto)' } : {}),
        overflow: 'visible',
      }"
    >
      <DecoratedBox
        :prefix="props.prefix"
        :caption="props.caption"
        :caption-html="props.captionHtml"
        :content-class="props.contentClass"
        :inner="props.inner"
      >
        <slot />
      </DecoratedBox>
    </div>
  </Teleport>
</template>
