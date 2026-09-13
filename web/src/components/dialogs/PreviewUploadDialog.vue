<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import Popup from '../../gwt/Popup.vue';
import GwtImage from '../../gwt/GwtImage.vue';
import { VerticalPanel } from '../../gwt/panels';
import { IMG } from '../../assets/images';
import type { UploadMediaFields } from '@hiroba/shared';
import { t } from '../../runtime';
import { uploadFailedMessage, uploadPastedImage } from '../../upload/upload';

const props = defineProps<{ file: File; fields: UploadMediaFields | null }>();
const emit = defineEmits<{ success: [url: string]; close: [] }>();
const i18n = t();

const dataUrl = ref('');
const ready = ref(false);
const uploading = ref(false);
const failed = ref(false);
const failedMessage = ref('');
const maxWidth = ref(0);
const maxHeight = ref(0);
const uploadButton = ref<HTMLButtonElement | null>(null);

function onPreviewLoad(): void {
  ready.value = true;
  void nextTick(() => {
    uploadButton.value?.focus();
  });
}

onMounted(() => {
  maxWidth.value = Math.floor((document.documentElement.clientWidth * 2) / 3);
  maxHeight.value = Math.floor((document.documentElement.clientHeight * 2) / 3);
  dataUrl.value = URL.createObjectURL(props.file);
});

onBeforeUnmount(() => {
  if (dataUrl.value.length > 0) {
    URL.revokeObjectURL(dataUrl.value);
  }
});

async function onUpload(): Promise<void> {
  if (uploading.value) {
    return;
  }
  uploading.value = true;
  failed.value = false;
  failedMessage.value = '';
  const outcome = await uploadPastedImage(props.file, props.fields);
  uploading.value = false;
  failed.value = !outcome.ok;
  if (outcome.ok) {
    emit('success', outcome.url);
    return;
  }
  failedMessage.value = uploadFailedMessage(i18n, outcome);
}
</script>

<template>
  <Popup :caption="i18n.t('uploadImageTitle')" clipped modal>
    <VerticalPanel :spacing="5" align="center">
      <img
        class="gwt-Image"
        :src="dataUrl"
        :style="{ maxWidth: maxWidth + 'px', maxHeight: maxHeight + 'px' }"
        @load="onPreviewLoad"
      />
      <div class="SquareCssResource-previewUploadDialogControl">
        <button
          ref="uploadButton"
          type="button"
          class="gwt-Button"
          style="width: 100px"
          :disabled="!ready || uploading ? true : undefined"
          @click="onUpload"
        >
          {{ i18n.t('uploadButton') }}
        </button>
        <button type="button" class="gwt-Button" style="width: 100px" @click="emit('close')">
          {{ i18n.t('close') }}
        </button>
        <GwtImage :img="IMG.largeLoading" cls="GlobalCssResource-img32" :hidden="!uploading" />
        <div class="gwt-HTML" :style="failed ? undefined : { display: 'none' }">
          {{ failedMessage }}
        </div>
      </div>
    </VerticalPanel>
  </Popup>
</template>
