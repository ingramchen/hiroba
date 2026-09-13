<script setup lang="ts">
import Popup from '../../gwt/Popup.vue';
import GwtImage from '../../gwt/GwtImage.vue';
import { VerticalPanel } from '../../gwt/panels';
import { IMG } from '../../assets/images';
import { t } from '../../runtime';

const props = withDefaults(
  defineProps<{
    decision?: 'APPLY' | 'INVALID' | null;
    error?: string;
  }>(),
  { decision: null, error: '' },
);

const emit = defineEmits<{
  apply: [];
  close: [];
}>();

const i18n = t();
</script>

<template>
  <Popup
    animated
    cls="gwt-DialogBox SquareCssResource-votePosterDialog"
    :caption="i18n.t('votePosterTitle')"
    :position="{ mode: 'center' }"
    clipped
  >
    <VerticalPanel
      :spacing="10"
      align="center"
      valign="middle"
      class="SquareCssResource-votePosterContent"
    >
      <div v-if="props.decision === null" class="SquareCssResource-voteProgress">
        <GwtImage :img="IMG.largeLoading" cls="GlobalCssResource-img32" />
        <div class="gwt-Label">{{ i18n.t('voteWaiting') }}</div>
      </div>
      <div class="gwt-Label SquareCssResource-voteErrors">{{ props.error }}</div>
      <div v-if="props.decision !== null" class="SquareCssResource-voteResultDecision">
        <template v-if="props.decision === 'INVALID'">
          <button type="button" class="gwt-Button" @click="emit('close')">
            {{ i18n.t('voteFailed') }}
          </button>
        </template>
        <template v-else>
          <button type="button" class="gwt-Button" @click="emit('apply')">
            {{ i18n.t('createPoster') }}
          </button>
          <button type="button" class="gwt-Button" @click="emit('close')">
            {{ i18n.t('giveup') }}
          </button>
        </template>
      </div>
      <div class="gwt-HTML" v-html="i18n.t('votePosterCondition')"></div>
    </VerticalPanel>
  </Popup>
</template>
