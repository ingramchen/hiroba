<script setup lang="ts">
import { ref } from 'vue';
import type { MenuEntry } from './types';

const props = withDefaults(
  defineProps<{ items: MenuEntry[]; vertical?: boolean; cls?: string; selected?: number }>(),
  { vertical: false, cls: '', selected: -1 },
);

const emit = defineEmits<{ select: [index: number] }>();

const hovered = ref(-1);

function onSelect(index: number): void {
  hovered.value = -1;
  emit('select', index);
}

function itemClass(index: number): string {
  return hovered.value === index || props.selected === index ? 'gwt-MenuItem-selected' : '';
}
</script>

<template>
  <div
    tabindex="0"
    role="menubar"
    hidefocus="true"
    style="outline: 0px"
    :class="[
      'gwt-MenuBar',
      props.vertical ? 'gwt-MenuBar-vertical' : 'gwt-MenuBar-horizontal',
      props.cls,
    ]"
  >
    <input
      type="text"
      tabindex="-1"
      aria-hidden="true"
      style="opacity: 0; height: 1px; width: 1px; z-index: -1; overflow: hidden; position: absolute"
    />
    <table>
      <tbody v-if="props.vertical">
        <tr v-for="(item, i) in props.items" :key="i">
          <td v-if="item.separator" class="gwt-MenuItemSeparator" colspan="2">
            <div class="menuSeparatorInner"></div>
          </td>
          <td
            v-else
            role="menuitem"
            colspan="2"
            :data-menu-id="item.id"
            :class="['gwt-MenuItem', item.cls, itemClass(i)]"
            @click="onSelect(i)"
            @mouseover="hovered = i"
            @mouseout="hovered = -1"
          >
            {{ item.label }}
          </td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr>
          <template v-for="(item, i) in props.items" :key="i">
            <td v-if="item.separator" class="gwt-MenuItemSeparator">
              <div class="menuSeparatorInner"></div>
            </td>
            <td
              v-else
              role="menuitem"
              :data-menu-id="item.id"
              :class="['gwt-MenuItem', item.cls, itemClass(i)]"
              @click="onSelect(i)"
              @mouseover="hovered = i"
              @mouseout="hovered = -1"
            >
              {{ item.label }}
            </td>
          </template>
        </tr>
      </tbody>
    </table>
  </div>
</template>
