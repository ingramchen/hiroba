<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Popup from '../../gwt/Popup.vue';
import { anchoredOrFixedOrCenter, type AnchorRect } from '../../gwt/relativePosition';
import GwtImage from '../../gwt/GwtImage.vue';
import { VerticalPanel } from '../../gwt/panels';
import { IMG } from '../../assets/images';
import { t } from '../../runtime';
import { SHORT_DURATIONS_SEC, VOTE_MAX_REASON } from '@hiroba/shared';

const props = withDefaults(
  defineProps<{
    target: string;
    durationSec?: number;
    waiting?: boolean;
    creating?: boolean;
    reason?: string;
    error?: string;
    condition?: string;
    decision?: 'FORBID' | 'UNFORBID' | 'BURN' | 'INVALID' | null;
    left?: number;
    top?: number;
    anchor?: AnchorRect | null;
  }>(),
  {
    durationSec: 77,
    reason: '',
    error: '',
    condition: '',
    waiting: false,
    creating: false,
    decision: null,
    anchor: null,
  },
);

const emit = defineEmits<{
  'update:durationSec': [value: number];
  'update:reason': [value: string];
  createForbid: [];
  createBurn: [];
  apply: [unforbid: boolean];
  close: [];
}>();

const i18n = t();

const REFUSAL_MS = 3000;
const refused = ref(false);
let refusalTimer = 0;

watch(
  () => props.creating,
  (value, previous) => {
    if (value || !previous || props.error.length === 0) {
      return;
    }
    refused.value = true;
    window.clearTimeout(refusalTimer);
    refusalTimer = window.setTimeout(() => {
      refused.value = false;
    }, REFUSAL_MS);
  },
);

const reasonBox = ref<HTMLInputElement | null>(null);

const centred = computed(
  () => props.anchor === null && (props.left === undefined || props.top === undefined),
);

onMounted(() => {
  if (!centred.value) {
    return;
  }
  void nextTick(() => {
    reasonBox.value?.focus();
  });
});

onBeforeUnmount(() => {
  window.clearTimeout(refusalTimer);
});

const decisionUnforbid = computed(() => props.decision === 'UNFORBID');
const decisionLabel = computed(() => {
  if (props.decision === 'FORBID') {
    return i18n.t('forbid') + ' ' + props.target;
  }
  if (props.decision === 'UNFORBID') {
    return i18n.t('unForbid') + ' ' + props.target;
  }
  return i18n.t('executeBurn');
});
</script>

<template>
  <Popup
    animated
    cls="gwt-DialogBox SquareCssResource-voteForbidDialog"
    :caption="i18n.t('voteForbidOrBurnTitle', props.target)"
    :position="anchoredOrFixedOrCenter(props.anchor, props.left, props.top)"
    clipped
  >
    <VerticalPanel
      :spacing="10"
      align="center"
      valign="middle"
      class="SquareCssResource-voteForbidContent"
    >
      <div v-if="props.decision !== null" class="SquareCssResource-voteResultDecision">
        <template v-if="props.decision === 'INVALID'">
          <button type="button" class="gwt-Button" @click="emit('close')">
            {{ i18n.t('voteFailed') }}
          </button>
        </template>
        <template v-else>
          <button type="button" class="gwt-Button" @click="emit('apply', decisionUnforbid)">
            {{ decisionLabel }}
          </button>
          <button type="button" class="gwt-Button" @click="emit('close')">
            {{ i18n.t('giveup') }}
          </button>
        </template>
      </div>
      <div
        v-else-if="props.creating || props.waiting || refused"
        class="SquareCssResource-voteProgress"
      >
        <GwtImage :img="IMG.largeLoading" cls="GlobalCssResource-img32" />
        <span v-if="props.waiting" class="gwt-Label">{{ i18n.t('voteWaiting') }}</span>
      </div>
      <div v-else-if="props.decision === null" class="SquareCssResource-voteControls">
        <input
          type="text"
          class="gwt-TextBox SquareCssResource-voteReasonBox"
          :maxlength="VOTE_MAX_REASON"
          :placeholder="i18n.t('voteReasonPrompt')"
          :value="props.reason"
          ref="reasonBox"
          @input="emit('update:reason', ($event.target as HTMLInputElement).value)"
        />
        <div class="SquareCssResource-voteReasonBox">
          <div class="gwt-Label">{{ i18n.t('votingDurationPrompt') }}</div>
          <select
            class="gwt-ListBox"
            :value="String(props.durationSec)"
            @change="emit('update:durationSec', Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="d in SHORT_DURATIONS_SEC" :key="d" :value="d">
              {{ i18n.t('durationSecond', String(d)) }}
            </option>
          </select>
        </div>
        <button type="button" class="gwt-Button" @click="emit('createForbid')">
          {{ i18n.t('createVotingForForbid') }}
        </button>
        <button type="button" class="gwt-Button" @click="emit('createBurn')">
          {{ i18n.t('createVotingForBurn') }}
        </button>
        <button type="button" class="gwt-Button" @click="emit('close')">
          {{ i18n.t('close') }}
        </button>
      </div>
      <div class="gwt-Label SquareCssResource-voteErrors">{{ refused ? props.error : '' }}</div>
      <div class="gwt-HTML" v-html="props.condition"></div>
    </VerticalPanel>
  </Popup>
</template>
