<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import Popup from '../../gwt/Popup.vue';
import GwtImage from '../../gwt/GwtImage.vue';
import { VerticalPanel, HorizontalPanel } from '../../gwt/panels';
import { IMG } from '../../assets/images';
import { t } from '../../runtime';
import type { UploadMediaFields } from '@hiroba/shared';
import { UPLOAD_INTERVAL_MS, UPLOAD_RESET_MS } from '../../upload/reduce';
import { UploadedImageCache, uploadFailedMessage, uploadImageFile } from '../../upload/upload';

const props = withDefaults(
  defineProps<{
    left?: number;
    top?: number;
    visible?: boolean;
    fields?: UploadMediaFields | null;
  }>(),
  {
    left: 228,
    top: 126,
    visible: true,
    fields: null,
  },
);
const emit = defineEmits<{ success: [url: string]; hide: [] }>();
const i18n = t();

const uploading = ref(false);
const failed = ref(false);
const failedMessage = ref('');
const resettable = ref(false);
const countdown = ref(0);
const input = ref<HTMLInputElement | null>(null);
const cache = new UploadedImageCache();
let countdownTimer = 0;
let resetTimer = 0;

function stopTimers(): void {
  window.clearInterval(countdownTimer);
  window.clearTimeout(resetTimer);
}

function startCountdown(): void {
  countdown.value = Math.round(UPLOAD_INTERVAL_MS / 1000);
  window.clearInterval(countdownTimer);
  countdownTimer = window.setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      window.clearInterval(countdownTimer);
      countdown.value = 0;
    }
  }, 1000);
}

function onReset(): void {
  stopTimers();
  uploading.value = false;
  failed.value = false;
  failedMessage.value = '';
  resettable.value = false;
  countdown.value = 0;
}

async function onUpload(): Promise<void> {
  const file = input.value?.files?.[0] ?? null;
  if (file === null || uploading.value || countdown.value > 0) {
    return;
  }
  const cached = cache.find(file);
  if (cached !== null) {
    startCountdown();
    emit('success', cached);
    return;
  }
  uploading.value = true;
  failed.value = false;
  failedMessage.value = '';
  resettable.value = false;
  window.clearTimeout(resetTimer);
  resetTimer = window.setTimeout(() => {
    resettable.value = true;
  }, UPLOAD_RESET_MS);
  const outcome = await uploadImageFile(file, props.fields);
  window.clearTimeout(resetTimer);
  uploading.value = false;
  resettable.value = false;
  if (!outcome.ok) {
    failed.value = true;
    failedMessage.value = uploadFailedMessage(i18n, outcome);
    return;
  }
  cache.add(file, outcome.url);
  startCountdown();
  emit('success', outcome.url);
}

onBeforeUnmount(stopTimers);
</script>

<template>
  <Popup
    animated
    :caption="i18n.t('uploadImageTitle')"
    :position="{ mode: 'fixed', left: props.left, top: props.top }"
    clipped
    :visible="props.visible"
  >
    <form class="SquareCssResource-uploadFileForm" @submit.prevent>
      <VerticalPanel :spacing="5">
        <input ref="input" type="file" class="gwt-FileUpload" />
        <HorizontalPanel :spacing="5">
          <button
            type="button"
            class="gwt-Button"
            :style="uploading ? { display: 'none' } : undefined"
            :disabled="countdown > 0 ? true : undefined"
            @click="onUpload"
          >
            {{ countdown > 0 ? i18n.t('intSecond', String(countdown)) : i18n.t('uploadButton') }}
          </button>
          <GwtImage :img="IMG.largeLoading" cls="GlobalCssResource-img32" :hidden="!uploading" />
          <button
            type="button"
            class="gwt-Button"
            :style="uploading ? { display: 'none' } : undefined"
            @click="emit('hide')"
          >
            {{ i18n.t('hide') }}
          </button>
          <div class="gwt-HTML" :style="failed ? undefined : { display: 'none' }">
            {{ failedMessage }}
          </div>
          <button
            type="button"
            class="gwt-Button"
            :style="resettable ? undefined : { display: 'none' }"
            @click="onReset"
          >
            {{ i18n.t('tooLongReset') }}
          </button>
        </HorizontalPanel>
        <div class="gwt-HTML SquareCssResource-uploadNotes">
          <ul class="SquareCssResource-uploadNotesUl">
            <li>{{ i18n.t('uploadImageSize', 1024) }}</li>
            <li v-html="i18n.t('uploadDesc')"></li>
            <li>{{ i18n.t('uploadByClipboardDesc').replace(/'/g, '') }}</li>
          </ul>
        </div>
      </VerticalPanel>
    </form>
  </Popup>
</template>
