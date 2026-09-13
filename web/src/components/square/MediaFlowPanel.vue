<script setup lang="ts">
import type { AnchorRect } from '../../gwt/relativePosition';
import EventSectionHeader from './EventSectionHeader.vue';
import MediaWidget from './MediaWidget.vue';
import type { MediaItem } from './MediaWidget.vue';
import type { MediaMode } from '../../live/medias';
import { VerticalPanel } from '../../gwt/panels';
import { t } from '../../runtime';
import { startAutoPlayDetect } from '../../media/autoplay';

startAutoPlayDetect();

const props = withDefaults(
  defineProps<{
    medias?: MediaItem[];
    interactive?: boolean;
    posterIcon?: boolean;
    mode?: MediaMode;
  }>(),
  {
    medias: () => [],
    interactive: true,
    posterIcon: true,
    mode: 'SHOW',
  },
);
const emit = defineEmits<{
  mode: [value: MediaMode];
  remove: [index: number];
  enlarge: [index: number, src: string];
  poster: [index: number];
  voteForbid: [index: number, anchor: AnchorRect];
}>();
const i18n = t();
const options = [
  { value: 'SHOW', label: i18n.t('mediaFlowShow') },
  { value: 'HIDE', label: i18n.t('mediaFlowHide') },
  { value: 'NSFW', label: i18n.t('mediaFlowNsfw') },
];

function onMode(value: string): void {
  emit('mode', value as MediaMode);
}
</script>

<template>
  <table
    cellspacing="0"
    cellpadding="0"
    class="SquareCssResource-mediaFlow SquareCssResource-eventSection"
  >
    <tbody>
      <tr>
        <td align="left" style="vertical-align: top">
          <EventSectionHeader
            :title="i18n.t('comingMedia')"
            :options="options"
            :selected="props.mode"
            @select="onMode"
          />
        </td>
      </tr>
      <tr>
        <td align="left" style="vertical-align: top">
          <VerticalPanel
            :table-style="
              props.mode === 'HIDE' ? { width: '100%', display: 'none' } : { width: '100%' }
            "
          >
            <MediaWidget
              v-for="(m, i) in props.medias"
              :key="m.key ?? i"
              :media="m"
              :interactive="props.interactive"
              :poster-icon="props.posterIcon"
              :mode="props.mode"
              @remove="emit('remove', i)"
              @enlarge="emit('enlarge', i, $event)"
              @poster="emit('poster', i)"
              @vote-forbid="emit('voteForbid', i, $event)"
            />
          </VerticalPanel>
        </td>
      </tr>
    </tbody>
  </table>
</template>
