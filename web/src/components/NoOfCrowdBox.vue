<script setup lang="ts">
import { computed } from 'vue';
import ColorBox from './ColorBox.vue';

const props = withDefaults(defineProps<{ crowd?: number }>(), { crowd: 0 });

const level = computed(() => {
  const n = props.crowd;
  if (n < 50) return 1;
  if (n < 100) return 2;
  if (n < 200) return 3;
  if (n < 300) return 4;
  if (n < 500) return 5;
  if (n < 1000) return 6;
  return 7;
});
</script>

<template>
  <ColorBox :level="level">
    <div class="gwt-Label GlobalCssResource-noOfCrowd">{{ props.crowd }}</div>
  </ColorBox>
</template>
