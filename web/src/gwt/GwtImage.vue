<script setup lang="ts">
import type { BundleImage } from '../assets/images';

const props = withDefaults(
  defineProps<{
    img: BundleImage;
    cls?: string;
    title?: string | undefined;
    pointer?: boolean;
    middle?: boolean;
    hidden?: boolean;
  }>(),
  { cls: '', title: undefined, pointer: false, middle: false, hidden: false },
);
</script>

<template>
  <img
    :class="['gwt-Image', props.cls]"
    :src="props.img.src"
    :width="props.img.width"
    :height="props.img.height"
    :title="props.title"
    :style="{
      ...(props.hidden ? { display: 'none' } : {}),
      ...(props.pointer ? { cursor: 'pointer' } : {}),
      ...(props.middle ? { 'vertical-align': 'middle' } : {}),
    }"
  />
</template>
