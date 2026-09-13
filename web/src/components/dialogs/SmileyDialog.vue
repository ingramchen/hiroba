<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import Popup from '../../gwt/Popup.vue';
import SmileyPanel from './SmileyPanel.vue';
import type { EmojiCategoryName, EmojiEntry } from '../../emoji';
import type { PickerMode } from '../../emoji/picker';

const props = withDefaults(
  defineProps<{
    category?: EmojiCategoryName;
    recent?: string[];
    mode?: PickerMode;
    blanks?: number;
    left?: number;
    top?: number;
  }>(),
  { category: 'SMILE', recent: () => [], mode: 'FLOAT_AUTO_HIDE', blanks: 0, left: 230, top: 122 },
);

const emit = defineEmits<{
  select: [entry: EmojiEntry];
  category: [name: EmojiCategoryName];
  mode: [value: PickerMode];
  close: [];
}>();

const root = ref<HTMLElement | null>(null);

function onOutside(event: MouseEvent): void {
  if (props.mode !== 'FLOAT_AUTO_HIDE') {
    return;
  }
  const target = event.target;
  const box = root.value?.closest('.gwt-DialogBox') ?? root.value;
  if (target instanceof Node && box?.contains(target) === true) {
    return;
  }
  emit('close');
}

onMounted(() => {
  document.addEventListener('mousedown', onOutside, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onOutside, true);
});
</script>

<template>
  <Popup
    animated
    caption=":)"
    :position="{ mode: 'fixed', left: props.left, top: props.top }"
    clipped
  >
    <div ref="root" class="SquareCssResource-smileyDialog">
      <SmileyPanel
        :category="props.category"
        :recent="props.recent"
        :mode="props.mode"
        :blanks="props.blanks"
        @select="emit('select', $event)"
        @category="emit('category', $event)"
        @mode="emit('mode', $event)"
        @close="emit('close')"
      />
    </div>
  </Popup>
</template>
