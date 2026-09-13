<script setup lang="ts">
import MenuBar from '../gwt/MenuBar.vue';
import type { MenuEntry } from '../gwt/types';

const props = withDefaults(
  defineProps<{ items: MenuEntry[]; square?: boolean; selected?: number }>(),
  { square: false, selected: -1 },
);

const emit = defineEmits<{ select: [index: number] }>();
</script>

<template>
  <MenuBar
    :items="props.items"
    :selected="props.selected"
    @select="emit('select', $event)"
    :cls="
      props.square
        ? 'GlobalCssResource-statusPanel SquareCssResource-squareStatusPanel'
        : 'GlobalCssResource-statusPanel'
    "
  />
</template>
