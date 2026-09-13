<script setup lang="ts">
import { computed } from 'vue';
import GwtImage from '../../gwt/GwtImage.vue';
import { IMG } from '../../assets/images';
import {
  EMOJI_CATEGORIES,
  categoryIconUrl,
  emojiUrl,
  type EmojiCategoryName,
  type EmojiEntry,
} from '../../emoji';
import { PICKER_MODES, listByCategoryName, padGrid, type PickerMode } from '../../emoji/picker';
import { isHighDensity, t } from '../../runtime';

const props = withDefaults(
  defineProps<{
    category?: EmojiCategoryName;
    recent?: string[];
    mode?: PickerMode;
    blanks?: number;
  }>(),
  { category: 'SMILE', recent: () => [], mode: 'FLOAT_AUTO_HIDE', blanks: 0 },
);

const emit = defineEmits<{
  select: [entry: EmojiEntry];
  category: [name: EmojiCategoryName];
  mode: [value: PickerMode];
  close: [];
}>();

const i18n = t();
const hd = isHighDensity();
const cells = computed(() => padGrid(listByCategoryName(props.category, props.recent)));
const entries = computed(() => cells.value.filter((cell): cell is EmojiEntry => cell !== null));
const blankCount = computed(() =>
  props.blanks > 0 ? props.blanks : cells.value.length - entries.value.length,
);
const modeLabels: Record<PickerMode, string> = {
  FLOAT_AUTO_HIDE: i18n.t('smileyModeFloatAutoHide'),
  FLOAT: i18n.t('smileyModeFloat'),
  STOCK: i18n.t('smileyModeStock'),
};
</script>

<template>
  <div>
    <div class="SquareCssResource-smileyTabPane">
      <div class="SquareCssResource-smileyGridStock">
        <img
          v-for="e in entries"
          :key="e.name"
          class="gwt-Image GlobalCssResource-smiley SquareCssResource-smileySelectCell"
          :title="e.symbol"
          :src="emojiUrl(e, { highDensity: hd })"
          @click="emit('select', e)"
        />
        <span
          v-for="n in blankCount"
          :key="'blank' + n"
          class="gwt-InlineLabel SquareCssResource-smileyBlankCell"
        ></span>
      </div>
    </div>
    <div>
      <div class="SquareCssResource-smileySelectorControl" style="float: right">
        <GwtImage
          :img="IMG.up"
          cls="GlobalCssResource-img16"
          style="padding-right: 5px"
          @click="emit('close')"
        />
        <select
          class="gwt-ListBox"
          :value="props.mode"
          @change="emit('mode', ($event.target as HTMLSelectElement).value as PickerMode)"
        >
          <option v-for="m in PICKER_MODES" :key="m" :value="m">{{ modeLabels[m] }}</option>
        </select>
      </div>
      <button
        v-for="c in EMOJI_CATEGORIES"
        :key="c.name"
        type="button"
        :class="[
          'gwt-Button',
          'SquareCssResource-smileyTab',
          c.name === props.category ? 'SquareCssResource-smileyTabSelected' : '',
        ]"
        @click="emit('category', c.name)"
      >
        <img
          class="GlobalCssResource-smileyCategory"
          :src="categoryIconUrl(c, { highDensity: hd })"
        />
      </button>
    </div>
  </div>
</template>
