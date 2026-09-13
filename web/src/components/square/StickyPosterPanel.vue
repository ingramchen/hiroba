<script setup lang="ts">
import EventSectionHeader from './EventSectionHeader.vue';
import PosterPanel from './PosterPanel.vue';
import { VerticalPanel } from '../../gwt/panels';
import { t } from '../../runtime';
import type { PosterDisplayMode } from '../../poster/render';
import type { PosterView } from '../../poster/poster';

const props = withDefaults(
  defineProps<{
    visible?: boolean;
    poster?: PosterView | null;
    mode?: PosterDisplayMode;
    fade?: boolean;
    locale?: string;
  }>(),
  { visible: false, poster: null, mode: 'SMALL', fade: false, locale: 'zh-TW' },
);
const emit = defineEmits<{ mode: [value: PosterDisplayMode]; enlarge: [src: string] }>();
const i18n = t();
const options = [
  { value: 'FULL', label: i18n.t('posterDisplayFull') },
  { value: 'BIG_MEDIA', label: i18n.t('posterDisplayBigMedia') },
  { value: 'SMALL', label: i18n.t('posterDisplaySmall') },
  { value: 'ONE_LINE', label: i18n.t('posterDisplayOneLine') },
  { value: 'HIDE', label: i18n.t('posterDisplayHide') },
  { value: 'RAW', label: i18n.t('posterDisplayRaw') },
];

function onMode(value: string): void {
  emit('mode', value as PosterDisplayMode);
}
</script>

<template>
  <div
    :class="[
      'SquareCssResource-stickyPoster',
      'SquareCssResource-eventSection',
      props.fade ? 'SquareCssResource-yellowFadeOut' : '',
    ]"
    :style="props.visible ? undefined : { display: 'none' }"
  >
    <EventSectionHeader
      :title="i18n.t('stickyPoster')"
      :options="options"
      :selected="props.poster === null ? '' : props.mode"
      @select="onMode"
    />
    <VerticalPanel :table-style="{ width: '100%' }">
      <PosterPanel
        v-if="props.poster !== null && props.mode !== 'HIDE'"
        :poster="props.poster"
        :mode="props.mode"
        :locale="props.locale"
        @enlarge="emit('enlarge', $event)"
      />
    </VerticalPanel>
  </div>
</template>
