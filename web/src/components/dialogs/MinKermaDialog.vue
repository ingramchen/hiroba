<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import Popup from '../../gwt/Popup.vue';
import { anchoredOrFixedOrCenter, type AnchorRect } from '../../gwt/relativePosition';
import GwtImage from '../../gwt/GwtImage.vue';
import { VerticalPanel } from '../../gwt/panels';
import { IMG } from '../../assets/images';
import { t } from '../../runtime';
import { MIN_KERMA_LEVELS, VOTE_MAX_REASON, calcFreezeValue } from '@hiroba/shared';

const props = withDefaults(
  defineProps<{
    left?: number;
    top?: number;
    kerma?: number;
    level?: number;
    reason?: string;
    error?: string;
    busy?: boolean;
    waiting?: boolean;
    decision?: 'APPLY' | 'INVALID' | null;
    anchor?: AnchorRect | null;
  }>(),
  {
    kerma: 0,
    level: 0,
    reason: '',
    error: '',
    busy: false,
    waiting: false,
    decision: null,
    anchor: null,
  },
);

const emit = defineEmits<{
  'update:level': [value: number];
  'update:reason': [value: string];
  create: [];
  apply: [];
  close: [];
}>();

const i18n = t();

const REFUSAL_MS = 3000;
const refused = ref(false);
let refusalTimer = 0;

watch(
  () => props.waiting,
  (value, previous) => {
    if (value || !previous || props.error.length === 0) {
      return;
    }
    refused.value = true;
    window.clearTimeout(refusalTimer);
    refusalTimer = window.setTimeout(() => {
      refused.value = false;
      emit('close');
    }, REFUSAL_MS);
  },
);

onBeforeUnmount(() => {
  window.clearTimeout(refusalTimer);
});

function label(level: number): string {
  if (level === 0) {
    return i18n.t('minKermaOptionZero');
  }
  const freeze = calcFreezeValue(level);
  return freeze === 0
    ? i18n.t('minKermaOption', String(level))
    : i18n.t('minKermaOptionFreeze', String(level), String(freeze));
}
</script>

<template>
  <Popup
    animated
    :caption="i18n.t('chooseMinKermaTitle')"
    :position="anchoredOrFixedOrCenter(props.anchor, props.left, props.top)"
    clipped
  >
    <VerticalPanel
      :spacing="10"
      align="center"
      valign="middle"
      :table-style="{ width: '300px', 'background-color': '#FFFFAA' }"
    >
      <VerticalPanel :spacing="8" align="center" valign="middle">
        <div class="gwt-HTML">{{ i18n.t('chooseMinKermaDesc') }}</div>
        <span
          v-for="level in MIN_KERMA_LEVELS"
          v-show="!props.waiting && !refused && props.decision === null"
          :key="level"
          class="gwt-RadioButton"
        >
          <input
            type="radio"
            value="on"
            :checked="props.level === level ? true : undefined"
            :disabled="level > props.kerma ? true : undefined"
            @change="emit('update:level', level)"
          />
          <label @click="level > props.kerma ? undefined : emit('update:level', level)">{{
            label(level)
          }}</label>
        </span>
        <div
          style="text-align: center; width: 100%"
          :style="props.busy || props.waiting || refused ? undefined : { display: 'none' }"
        >
          <GwtImage :img="IMG.largeLoading" cls="GlobalCssResource-img32" />
          <span v-if="props.waiting" class="gwt-Label">{{ i18n.t('voteMinKermaWait') }}</span>
        </div>
        <div v-if="props.decision !== null" style="text-align: center; width: 100%">
          <template v-if="props.decision === 'INVALID'">
            <button type="button" class="gwt-Button" @click="emit('close')">
              {{ i18n.t('voteMinKermaFailed') }}
            </button>
          </template>
          <template v-else>
            <button type="button" class="gwt-Button" @click="emit('apply')">
              {{ i18n.t('applyMinKerma') }}
            </button>
            <button type="button" class="gwt-Button" @click="emit('close')">
              {{ i18n.t('giveup') }}
            </button>
          </template>
        </div>
        <div
          v-show="!props.waiting && !refused && props.decision === null"
          style="text-align: center"
        >
          <input
            type="text"
            class="gwt-TextBox SquareCssResource-voteReasonBox"
            :maxlength="VOTE_MAX_REASON"
            :placeholder="i18n.t('voteReasonPrompt')"
            :value="props.reason"
            @input="emit('update:reason', ($event.target as HTMLInputElement).value)"
          />
          <button type="button" class="gwt-Button" @click="emit('create')">
            {{ i18n.t('create') }}
          </button>
          <button type="button" class="gwt-Button" @click="emit('close')">
            {{ i18n.t('close') }}
          </button>
        </div>
        <div class="gwt-Label" style="color: rgb(255, 0, 0)">{{ refused ? props.error : '' }}</div>
        <div class="gwt-HTML">{{ i18n.t('voteMinKermaCondition') }}</div>
        <div class="gwt-HTML">{{ i18n.t('minKermaFeatureDesc') }}</div>
        <div class="gwt-HTML">{{ i18n.t('minKermaFreezeDesc') }}</div>
      </VerticalPanel>
    </VerticalPanel>
  </Popup>
</template>
