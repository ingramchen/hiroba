<script setup lang="ts">
import { computed } from 'vue';
import { calculateColor, rgbCss } from '@hiroba/shared';
import type { PosterDisplayMode } from '../../poster/render';
import { renderPoster } from '../../poster/render';
import type { PosterView } from '../../poster/poster';
import { isHighDensity } from '../../runtime';

const props = defineProps<{ poster: PosterView; mode: PosterDisplayMode; locale: string }>();

const emit = defineEmits<{ enlarge: [src: string] }>();

const rendered = computed(() =>
  renderPoster(props.poster.content, { highDensity: isHighDensity() }),
);
const signature = computed(
  () =>
    `${new Intl.DateTimeFormat(props.locale, { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(props.poster.createTime),
    )}`,
);
const color = computed(() =>
  rgbCss(calculateColor(props.poster.creator.publicId, props.poster.creator.colorToken)),
);
const responsiveYoutube = computed(() => props.mode === 'FULL' || props.mode === 'BIG_MEDIA');

function onImageClick(): void {
  emit('enlarge', props.poster.mediaUrl);
}

const wrapperClass = computed(() =>
  props.mode === 'FULL'
    ? 'SquareCssResource-posterModeFull'
    : props.mode === 'BIG_MEDIA'
      ? 'SquareCssResource-posterModeBigMedia'
      : 'SquareCssResource-posterModeSmall',
);
</script>

<template>
  <div class="SquareCssResource-posterPanel">
    <div
      v-if="props.mode === 'FULL' || props.mode === 'BIG_MEDIA' || props.mode === 'SMALL'"
      :class="wrapperClass"
    >
      <div
        class="gwt-HTML KmarkCssResource-kmark SquareCssResource-posterContent"
        v-html="rendered"
      ></div>
      <img
        v-if="props.poster.posterType === 'IMAGE'"
        class="gwt-Image SquareCssResource-posterImage"
        :src="props.poster.mediaUrl"
        title="Click to see large size"
        @click="onImageClick"
      />
      <div
        v-else-if="responsiveYoutube"
        class="SquareCssResource-youtubeWrapper SquareCssResource-posterYoutube"
      >
        <iframe :src="props.poster.mediaUrl" frameborder="0" allowfullscreen></iframe>
      </div>
      <iframe
        v-else
        class="SquareCssResource-posterYoutube"
        :src="props.poster.mediaUrl"
        frameborder="0"
        allowfullscreen
      ></iframe>
      <div v-if="props.mode !== 'SMALL'" class="gwt-HTML SquareCssResource-posterSignature">
        <span class="GlobalCssResource-colorNickname" :style="'color:' + color">{{
          props.poster.creator.nickname
        }}</span>
        @{{ signature }}
      </div>
    </div>
    <div v-else-if="props.mode === 'ONE_LINE'" class="SquareCssResource-posterModeOneLine">
      <div class="gwt-Label SquareCssResource-posterContent">{{ props.poster.content }}</div>
    </div>
    <textarea
      v-else-if="props.mode === 'RAW'"
      class="gwt-TextArea SquareCssResource-posterModeRaw"
      readonly
      :value="props.poster.content"
    ></textarea>
  </div>
</template>
