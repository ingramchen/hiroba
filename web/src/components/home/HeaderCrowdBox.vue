<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import ColorBox from '../ColorBox.vue';
import { CROWD_RAMP_INTERVAL_MS, crowdRamp } from './crowdRamp';

const props = withDefaults(defineProps<{ crowd?: number }>(), { crowd: 0 });

const shown = ref(0);
let timer = 0;

function stop(): void {
  if (timer !== 0) {
    window.clearInterval(timer);
    timer = 0;
  }
}

watch(
  () => props.crowd,
  (next) => {
    stop();
    const values = crowdRamp(shown.value, next);
    if (values.length === 1) {
      shown.value = next;
      return;
    }
    let at = 0;
    timer = window.setInterval(() => {
      shown.value = values[at] ?? next;
      at += 1;
      if (at >= values.length) {
        stop();
      }
    }, CROWD_RAMP_INTERVAL_MS);
  },
  { immediate: true },
);

onBeforeUnmount(stop);
</script>

<template>
  <ColorBox :level="1">
    <div class="gwt-Label GlobalCssResource-noOfCrowd">{{ shown }}</div>
  </ColorBox>
</template>
