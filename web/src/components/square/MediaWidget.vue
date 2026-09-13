<script setup lang="ts">
import { elementRect, type AnchorRect } from '../../gwt/relativePosition';
import { computed, h, onBeforeUnmount, ref, watch, type VNode } from 'vue';
import { GwtTable, HorizontalPanel } from '../../gwt/panels';
import GwtImage from '../../gwt/GwtImage.vue';
import { IMG } from '../../assets/images';
import ExternalLink from '../ExternalLink.vue';
import { t, webLoaderKey } from '../../runtime';
import { webLoaderUrl } from '../../media/webloader';
import { nextImageLoadPhase, webLoaderWaitMs, type ImageLoadPhase } from '../../media/imageLoad';
import { isMasked, isPosterableKind, opensOnClick, type ModerationState } from '@hiroba/shared';
import type { MediaMode } from '../../live/medias';
import { autoPlaySupported } from '../../media/autoplay';

export interface MediaItem {
  kind: 'image' | 'youtube' | 'imgurGifv' | 'kekekeGif' | 'video';
  src: string;
  header: string;
  mine?: boolean;
  similarImage?: boolean;
  webmSrc?: string;
  sourceUrl?: string;
  senderPublicId?: string;
  gif?: boolean;
  gifv?: boolean;
  webLoader?: boolean;
  moderation?: ModerationState;
  key?: number;
}

const MaskWrap = (
  props: { classes: string[] | null },
  { slots }: { slots: { default: () => VNode[] } },
): VNode[] | VNode =>
  props.classes === null ? slots.default() : h('div', { class: props.classes }, slots.default());
MaskWrap.props = { classes: { type: Array, default: null } };

const props = withDefaults(
  defineProps<{
    media: MediaItem;
    interactive?: boolean;
    mode?: MediaMode;
    posterIcon?: boolean;
  }>(),
  { interactive: true, mode: 'SHOW', posterIcon: true },
);

const emit = defineEmits<{
  remove: [];
  enlarge: [src: string];
  poster: [];
  voteForbid: [anchor: AnchorRect];
}>();

const i18n = t();

const autoPlay = autoPlaySupported().value;

const gifLikeVideo = computed(
  () =>
    props.media.kind === 'kekekeGif' ||
    (props.media.kind === 'imgurGifv' && props.media.gifv === true),
);

const filtered = ref(props.mode === 'NSFW');
const loaded = ref(false);
const phase = ref<ImageLoadPhase>('direct');
const imageSrc = ref(props.media.src);
const converting = ref(props.media.kind === 'image' && props.media.webLoader === true);
let timer = 0;

function armTimeout(): void {
  window.clearTimeout(timer);
  if (!converting.value) {
    return;
  }
  timer = window.setTimeout(onImageError, webLoaderWaitMs());
}

function onImageLoad(): void {
  window.clearTimeout(timer);
  converting.value = false;
  loaded.value = true;
}

function onImageError(): void {
  window.clearTimeout(timer);
  converting.value = false;
  const key = webLoaderKey();
  const step = nextImageLoadPhase(
    phase.value,
    props.media.gif === true || key.length === 0,
    props.media.webLoader === true,
  );
  phase.value = step.phase;
  if (!step.retry) {
    return;
  }
  const source = props.media.sourceUrl ?? props.media.src;
  void webLoaderUrl(key, source).then((url) => {
    imageSrc.value = url;
  });
}

watch(
  () => props.media,
  (media) => {
    phase.value = 'direct';
    loaded.value = false;
    imageSrc.value = media.src;
    converting.value = media.kind === 'image' && media.webLoader === true;
    armTimeout();
  },
  { immediate: true },
);

watch(
  () => props.mode,
  (mode) => {
    filtered.value = mode === 'NSFW';
  },
);

onBeforeUnmount(() => {
  window.clearTimeout(timer);
  window.clearTimeout(maskTimer);
});

const nsfwMode = computed(() => props.mode === 'NSFW');
const image = computed(() => props.media.kind === 'image');
const youtube = computed(() => props.media.kind === 'youtube');

const maskMounted = ref(false);
const maskOverlay = ref(false);
const maskShade = ref(false);
let maskTimer = 0;

function maskOn(): void {
  maskMounted.value = true;
  maskOverlay.value = true;
  window.clearTimeout(maskTimer);
  maskTimer = window.setTimeout(() => {
    maskShade.value = true;
  }, 18);
}

function maskOff(): void {
  maskShade.value = false;
  window.clearTimeout(maskTimer);
  maskTimer = window.setTimeout(() => {
    maskOverlay.value = false;
  }, 250);
}

watch(
  filtered,
  (on) => {
    if (!youtube.value) {
      return;
    }
    if (on) {
      maskOn();
    } else if (maskMounted.value) {
      maskOff();
    }
  },
  { immediate: true },
);

const maskClass = computed(() => [
  'SquareCssResource-mediaTransition',
  ...(maskOverlay.value ? ['SquareCssResource-nsfwYoutube'] : []),
  ...(maskShade.value ? ['SquareCssResource-nsfwYoutubeMask'] : []),
]);

const moderation = computed<ModerationState>(() => props.media.moderation ?? 'pass');
const revealed = ref(false);

watch(moderation, () => {
  revealed.value = false;
});

const moderationMasked = computed(() => isMasked(moderation.value) && !revealed.value);

const moderationClass = computed(() =>
  moderationMasked.value
    ? [
        'SquareCssResource-moderationMask',
        `SquareCssResource-moderation${moderation.value.charAt(0).toUpperCase()}${moderation.value.slice(1)}`,
      ]
    : null,
);

const posterable = computed(
  () =>
    props.posterIcon &&
    !isMasked(moderation.value) &&
    isPosterableKind(props.media.kind) &&
    props.media.gif !== true &&
    (!image.value || loaded.value),
);
const enlargeTitle = computed(() =>
  !moderationMasked.value && (!image.value || loaded.value) ? 'Click to see large size' : undefined,
);
const contentClass = computed(() => [
  ...(filtered.value
    ? ['SquareCssResource-nsfw', 'SquareCssResource-mediaTransition']
    : props.mode === 'NSFW'
      ? ['SquareCssResource-mediaTransition']
      : []),
  ...(moderationMasked.value ? ['SquareCssResource-moderationBlur'] : []),
]);

function onContentClick(): void {
  if (moderationMasked.value) {
    if (opensOnClick(moderation.value)) {
      revealed.value = true;
    }
    return;
  }
  if (filtered.value) {
    filtered.value = false;
    return;
  }
  if (image.value && !loaded.value) {
    return;
  }
  emit('enlarge', imageSrc.value);
}
</script>

<template>
  <GwtTable :columns="1" :rows="[[{}], [{}]]" class="SquareCssResource-media">
    <HorizontalPanel
      :spacing="3"
      :cells="[{ align: 'left' }, { align: 'right' }]"
      class="SquareCssResource-mediaHeader"
    >
      <div class="SquareCssResource-mediaHeaderLeft">
        <GwtImage
          :img="props.media.mine ? IMG.deleteMediaSelf : IMG.deleteMedia"
          cls="GlobalCssResource-img16 SquareCssResource-deleteIcon"
          :title="i18n.t('deleteMedia')"
          @click="emit('remove')"
        />
        <div class="gwt-HTML">{{ props.media.header }}</div>
        <div v-if="props.interactive" class="SquareCssResource-voteForbidNearChatter">
          <GwtImage
            :img="IMG.voteForbidSmall"
            cls="GlobalCssResource-img16"
            :title="i18n.t('forbidCrowdTitle')"
            pointer
            middle
            @click="emit('voteForbid', elementRect($event.currentTarget as Element))"
          />
        </div>
      </div>
      <div>
        <div v-if="posterable" class="SquareCssResource-posterCreator">
          <GwtImage
            :img="IMG.posterSmall"
            cls="GlobalCssResource-img16"
            :title="i18n.t('posterTitle')"
            pointer
            middle
            @click="emit('poster')"
          />
        </div>
        <GwtImage
          :img="filtered ? IMG.nsfwOff : IMG.nsfwOn"
          cls="GlobalCssResource-img16 SquareCssResource-nsfwControl"
          :hidden="!nsfwMode"
          @click="filtered = !filtered"
        />
        <div v-if="props.media.similarImage" class="gwt-HTML SquareCssResource-similarImageLink">
          <ExternalLink
            :href="
              'https://images.google.com/searchbyimage?image_url=' +
              (props.media.sourceUrl ?? props.media.src)
            "
            >{{ i18n.t('similarImage') }}</ExternalLink
          >
        </div>
      </div>
    </HorizontalPanel>
    <MaskWrap :classes="moderationClass">
      <div
        v-if="props.media.kind === 'youtube'"
        class="SquareCssResource-youtubeWrapper SquareCssResource-mediaContent"
      >
        <iframe :src="props.media.src" frameborder="0" allowfullscreen="true"></iframe>
        <div v-if="maskMounted" :class="maskClass" @click.stop="filtered = false"></div>
      </div>
      <video
        v-else-if="props.media.kind === 'imgurGifv'"
        :class="['SquareCssResource-mediaContent', ...contentClass]"
        :loop="gifLikeVideo"
        :muted="gifLikeVideo"
        :autoplay="gifLikeVideo && autoPlay"
        :controls="!gifLikeVideo || !autoPlay"
        playsinline
        @click="onContentClick"
      >
        <source v-if="props.media.webmSrc" :src="props.media.webmSrc" type="video/webm" />
        <source :src="props.media.src" type="video/mp4" />
      </video>
      <video
        v-else-if="props.media.kind === 'kekekeGif'"
        :class="[
          'SquareCssResource-gifVideoThumb',
          'SquareCssResource-mediaContent',
          ...contentClass,
        ]"
        :src="props.media.src"
        loop
        muted
        :autoplay="autoPlay"
        :controls="!autoPlay"
        playsinline
        @click="onContentClick"
      ></video>
      <video
        v-else-if="props.media.kind === 'video'"
        :class="['SquareCssResource-mediaContent', ...contentClass]"
        :src="props.media.src"
        controls
      ></video>
      <div v-else-if="props.media.webLoader" class="SquareCssResource-mediaContent">
        <img
          :class="['gwt-Image', 'SquareCssResource-imageMediaThumb', ...contentClass]"
          :title="enlargeTitle"
          :src="imageSrc"
          @load="onImageLoad"
          @error="onImageError"
          @click="onContentClick"
        />
        <div v-if="converting" class="gwt-HTML">{{ i18n.t('forceSecureUrl') }}</div>
        <div v-if="phase === 'failed'">
          <ExternalLink :href="props.media.sourceUrl ?? props.media.src">{{
            i18n.t('failShowSecureUrl')
          }}</ExternalLink>
        </div>
      </div>
      <img
        v-else
        :class="[
          'gwt-Image',
          'SquareCssResource-imageMediaThumb',
          'SquareCssResource-mediaContent',
          ...contentClass,
        ]"
        :title="enlargeTitle"
        :src="imageSrc"
        @load="onImageLoad"
        @error="onImageError"
        @click="onContentClick"
      />
    </MaskWrap>
  </GwtTable>
</template>
