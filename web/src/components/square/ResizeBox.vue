<script setup lang="ts">
import { ref, watch } from 'vue';
import GwtImage from '../../gwt/GwtImage.vue';
import { IMG } from '../../assets/images';
import { VerticalPanel } from '../../gwt/panels';

const props = withDefaults(defineProps<{ height?: number }>(), { height: 300 });

const RESIZE_STEP_PX = 50;

const height = ref(props.height);
const scroller = ref<HTMLElement | null>(null);

watch(
  () => props.height,
  (value) => {
    height.value = value;
  },
);

function resize(delta: number): void {
  const next = (scroller.value?.offsetHeight ?? height.value) + delta;
  if (next < 0) {
    return;
  }
  height.value = next;
}
</script>

<template>
  <VerticalPanel :table-style="{ width: '100%' }">
    <div style="width: 100%">
      <div
        ref="scroller"
        :style="{
          overflow: 'hidden auto',
          position: 'relative',
          zoom: 1,
          height: height + 'px',
        }"
      >
        <div style="position: relative; zoom: 1">
          <slot />
        </div>
      </div>
    </div>
    <div class="SquareCssResource-resizeBoxControl">
      <GwtImage
        :img="IMG.up"
        cls="GlobalCssResource-img16"
        pointer
        @click="resize(-RESIZE_STEP_PX)"
      />
      <GwtImage
        :img="IMG.down"
        cls="GlobalCssResource-img16"
        pointer
        @click="resize(RESIZE_STEP_PX)"
      />
    </div>
  </VerticalPanel>
</template>
