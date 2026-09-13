<script setup lang="ts">
import { computed } from 'vue';

const LEVELS: Record<number, [string, string]> = {
  1: ['#2B8F00', '#EAF6E5'],
  2: ['#002590', '#E8EEF5'],
  3: ['#926F04', '#F6EFE4'],
  4: ['#90001E', '#F6E4EA'],
  5: ['#EAF6E5', '#2B8F00'],
  6: ['#E8EEF5', '#002590'],
  7: ['#F6E4EA', '#90001E'],
};

const props = withDefaults(defineProps<{ level?: number }>(), { level: 1 });
const pair = computed(() => LEVELS[props.level] ?? LEVELS[7]);
</script>

<template>
  <div class="GlobalCssResource-colorBox" :style="{ color: pair[0], 'background-color': pair[1] }">
    <slot />
  </div>
</template>
