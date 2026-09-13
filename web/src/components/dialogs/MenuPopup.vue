<script setup lang="ts">
import Popup from '../../gwt/Popup.vue';
import MenuBar from '../../gwt/MenuBar.vue';
import type { MenuEntry } from '../../gwt/types';

const props = withDefaults(defineProps<{ items: MenuEntry[]; index: number }>(), {});

const emit = defineEmits<{ select: [index: number]; autoHide: [] }>();
</script>

<template>
  <Popup
    cls="gwt-MenuBarPopup"
    prefix="menuPopup"
    :caption="null"
    :position="{ mode: 'menuBarPopup', index: props.index }"
    auto-hide
    @auto-hide="emit('autoHide')"
  >
    <MenuBar :items="props.items" vertical @select="emit('select', $event)" />
  </Popup>
</template>
