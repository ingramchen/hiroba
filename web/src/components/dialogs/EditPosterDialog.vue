<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Popup from '../../gwt/Popup.vue';
import { VerticalPanel } from '../../gwt/panels';
import GwtImage from '../../gwt/GwtImage.vue';
import { IMG } from '../../assets/images';
import { t } from '../../runtime';
import { POSTER_DRAFT_SAVE_MS, POSTER_MAX_CONTENT_LENGTH, renderPoster } from '../../poster/render';
import type { PosterType } from '../../poster/poster';

const props = withDefaults(
  defineProps<{
    mediaUrl?: string;
    posterType?: PosterType;
    draft?: string;
    placeKey?: number;
    submitLabel?: string;
    error?: string;
    busy?: boolean;
  }>(),
  {
    mediaUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    posterType: 'YOUTUBE',
    draft: '',
    placeKey: 0,
    submitLabel: '',
    error: '',
    busy: false,
  },
);

const emit = defineEmits<{
  submit: [content: string];
  draft: [content: string];
  close: [];
}>();

const i18n = t();
const TABS = [
  i18n.t('editPosterContentBoxTab'),
  i18n.t('editPosterPreviewTab'),
  i18n.t('editPosterSyntaxHelpTab'),
  i18n.t('editPosterRuleHelpTab'),
];
const MEDIA_PREVIEW_DELAY_MS = 400;
const tab = ref(0);
const mediaShown = ref(false);
let mediaTimer = 0;

onMounted(() => {
  mediaTimer = window.setTimeout(() => {
    mediaShown.value = true;
  }, MEDIA_PREVIEW_DELAY_MS);
});
const content = ref(props.draft);
const preview = ref('');
let autoSave = 0;

watch(
  () => props.draft,
  (value) => {
    content.value = value;
  },
);

function startAutoSave(): void {
  if (autoSave !== 0) {
    return;
  }
  autoSave = window.setInterval(() => {
    emit('draft', content.value);
  }, POSTER_DRAFT_SAVE_MS);
}

function onInput(event: Event): void {
  content.value = (event.target as HTMLTextAreaElement).value;
  startAutoSave();
}

function selectTab(index: number): void {
  tab.value = index;
  if (index === 1) {
    preview.value = content.value.trim().length === 0 ? '' : renderPoster(content.value);
  }
}

function onSubmit(): void {
  if (content.value.trim().length === 0) {
    return;
  }
  emit('submit', content.value);
}

onBeforeUnmount(() => {
  window.clearTimeout(mediaTimer);
  if (autoSave !== 0) {
    window.clearInterval(autoSave);
    autoSave = 0;
  }
});

function outerStyle(index: number): Record<string, string> {
  const base = { width: '100%', height: '100%', padding: '0px', margin: '0px' };
  return index === tab.value ? base : { ...base, display: 'none' };
}

function innerStyle(index: number, extra: Record<string, string> = {}): Record<string, string> {
  const base = { width: '100%', height: '100%', ...extra };
  return index === tab.value ? base : { ...base, display: 'none' };
}
</script>

<template>
  <Popup
    animated
    cls="gwt-DialogBox SquareCssResource-editPosterPanel"
    :caption="i18n.t('editPosterTitle')"
    :position="{ mode: 'center' }"
    :place-key="props.placeKey"
    clipped
  >
    <VerticalPanel
      :spacing="10"
      align="center"
      valign="middle"
      class="SquareCssResource-editPosterContent"
    >
      <table
        cellspacing="0"
        cellpadding="0"
        class="gwt-TabPanel SquareCssResource-editPosterTabPanel"
      >
        <tbody>
          <tr>
            <td align="left" style="vertical-align: top">
              <table
                cellspacing="0"
                cellpadding="0"
                role="tablist"
                class="gwt-TabBar"
                style="width: 100%"
              >
                <tbody>
                  <tr>
                    <td
                      class="gwt-TabBarFirst-wrapper"
                      align="left"
                      height="100%"
                      style="vertical-align: bottom"
                    >
                      <div class="gwt-TabBarFirst" style="white-space: normal; height: 100%"></div>
                    </td>
                    <td
                      v-for="(label, i) in TABS"
                      :key="label"
                      align="left"
                      style="vertical-align: bottom"
                      :class="[
                        'gwt-TabBarItem-wrapper',
                        i === tab ? 'gwt-TabBarItem-wrapper-selected' : '',
                      ]"
                      @click="selectTab(i)"
                    >
                      <div
                        role="tab"
                        :class="['gwt-TabBarItem', i === tab ? 'gwt-TabBarItem-selected' : '']"
                      >
                        <input
                          type="text"
                          tabindex="-1"
                          aria-hidden="true"
                          style="
                            opacity: 0;
                            height: 1px;
                            width: 1px;
                            z-index: -1;
                            overflow: hidden;
                            position: absolute;
                          "
                        />
                        <div class="gwt-Label" style="white-space: nowrap">{{ label }}</div>
                      </div>
                    </td>
                    <td
                      class="gwt-TabBarRest-wrapper"
                      align="left"
                      width="100%"
                      style="vertical-align: bottom"
                    >
                      <div class="gwt-TabBarRest" style="white-space: normal; height: 100%"></div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td align="left" height="100%" style="vertical-align: top">
              <div class="gwt-TabPanelBottom" role="tabpanel">
                <div :style="outerStyle(0)">
                  <div :style="innerStyle(0, { 'line-height': '0px' })">
                    <textarea
                      class="gwt-TextArea SquareCssResource-editPosterContentBox"
                      :placeholder="i18n.t('editPosterContentPlaceholder')"
                      :maxlength="POSTER_MAX_CONTENT_LENGTH"
                      :value="content"
                      @input="onInput"
                    ></textarea>
                  </div>
                </div>
                <div :style="outerStyle(1)">
                  <div :style="innerStyle(1)">
                    <div
                      class="gwt-HTML KmarkCssResource-kmark SquareCssResource-editPosterPreview"
                      v-html="preview"
                    ></div>
                  </div>
                </div>
                <div :style="outerStyle(2)">
                  <div :style="innerStyle(2)">
                    <div
                      class="gwt-HTML KmarkCssResource-kmarkHelp SquareCssResource-editPosterHelp"
                      v-html="i18n.t('kmarkHelp')"
                    ></div>
                  </div>
                </div>
                <div :style="outerStyle(3)">
                  <div :style="innerStyle(3)">
                    <div
                      class="gwt-HTML KmarkCssResource-kmarkHelp SquareCssResource-editPosterHelp"
                      v-html="i18n.t('editPosterRuleHelp')"
                    ></div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="SquareCssResource-posterModeSmall">
        <template v-if="mediaShown">
          <img
            v-if="props.posterType === 'IMAGE'"
            class="gwt-Image SquareCssResource-posterImage"
            :src="props.mediaUrl"
          />
          <iframe
            v-else
            class="SquareCssResource-posterYoutube"
            :src="props.mediaUrl"
            frameborder="0"
            allowfullscreen
          ></iframe>
        </template>
      </div>
      <div
        class="SquareCssResource-editPosterProgress"
        :style="props.busy ? undefined : { display: 'none' }"
      >
        <GwtImage :img="IMG.largeLoading" cls="GlobalCssResource-img32" />
      </div>
      <div class="gwt-Label SquareCssResource-editPosterErrors">{{ props.error }}</div>
      <div v-if="!props.busy" class="SquareCssResource-editPosterControls">
        <button type="button" class="gwt-Button" @click="onSubmit">
          {{ props.submitLabel === '' ? i18n.t('createPoster') : props.submitLabel }}
        </button>
        <button type="button" class="gwt-Button" @click="emit('close')">
          {{ i18n.t('close') }}
        </button>
      </div>
    </VerticalPanel>
  </Popup>
</template>
