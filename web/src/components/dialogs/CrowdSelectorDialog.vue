<script setup lang="ts">
import { computed, ref } from 'vue';
import Popup from '../../gwt/Popup.vue';
import { fixedOrCenter } from '../../gwt/relativePosition';
import { VerticalPanel, HorizontalPanel } from '../../gwt/panels';
import { chunk } from './chunk';

const props = withDefaults(
  defineProps<{
    caption: string;
    prompt: string;
    left?: number;
    top?: number;
    chatters?: { nickname: string; color: string }[];
    big?: boolean;
    width?: number;
    height?: number;
  }>(),
  { chatters: () => [], big: false },
);

const emit = defineEmits<{ select: [index: number]; search: [value: string]; autoHide: [] }>();

const word = ref('');
const hovered = ref(-1);

const perRow = computed(() => (props.big ? 7 : 5));
const width = computed(() => props.width ?? (props.big ? 800 : 600));
const height = computed(() => props.height ?? (props.big ? 500 : 400));

const found = computed(() => {
  const entries = props.chatters.map((chatter, index) => ({ chatter, index }));
  const needle = word.value.trim();
  return needle.length === 0
    ? entries
    : entries.filter((entry) => entry.chatter.nickname.includes(needle));
});

const grid = computed(() => chunk(found.value, perRow.value));

function onSearch(event: Event): void {
  word.value = (event.target as HTMLInputElement).value;
  emit('search', word.value);
}
</script>

<template>
  <Popup
    animated
    :caption="props.caption"
    :position="fixedOrCenter(props.left, props.top)"
    clipped
    auto-hide
    @auto-hide="emit('autoHide')"
  >
    <VerticalPanel>
      <div class="gwt-HTML">{{ props.prompt }}</div>
      <HorizontalPanel :spacing="10">
        <div class="gwt-Label">search:</div>
        <input type="text" class="gwt-TextBox" style="" :value="word" @keyup="onSearch" />
      </HorizontalPanel>
      <div
        :style="{
          overflow: 'auto',
          position: 'relative',
          zoom: 1,
          height: height + 'px',
          width: width + 'px',
        }"
      >
        <div style="position: relative; zoom: 1">
          <table cellspacing="5">
            <colgroup>
              <col />
            </colgroup>
            <tbody>
              <tr v-for="(line, r) in grid" :key="r">
                <td v-for="entry in line" :key="entry.index">
                  <div
                    :class="[
                      'gwt-HTML',
                      'SquareCssResource-chatName',
                      hovered === entry.index ? 'SquareCssResource-chatNameHover' : '',
                    ]"
                    @click="emit('select', entry.index)"
                    @mouseover="hovered = entry.index"
                    @mouseout="hovered = -1"
                  >
                    <span
                      class="GlobalCssResource-colorNickname"
                      :style="'color:' + entry.chatter.color"
                      >{{ entry.chatter.nickname }}</span
                    >
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </VerticalPanel>
  </Popup>
</template>
