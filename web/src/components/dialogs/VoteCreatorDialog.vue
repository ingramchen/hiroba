<script setup lang="ts">
import Popup from '../../gwt/Popup.vue';
import { fixedOrCenter } from '../../gwt/relativePosition';
import { VerticalPanel, GwtTable } from '../../gwt/panels';
import { t } from '../../runtime';
import { NORMAL_DURATIONS_SEC, VOTE_MAX_OPTION_LENGTH, VOTE_MAX_TITLE } from '@hiroba/shared';

const props = withDefaults(
  defineProps<{
    left?: number;
    top?: number;
    error?: string;
    locked?: boolean;
    title?: string;
    optionValues?: string[];
    durationSec?: number;
    multipleChoiceConfig?: number;
  }>(),
  {
    error: '',
    locked: false,
    title: '',
    optionValues: () => [],
    durationSec: 30,
    multipleChoiceConfig: 1,
  },
);
const emit = defineEmits<{
  'update:title': [value: string];
  'update:options': [value: string[]];
  'update:durationSec': [value: number];
  'update:multipleChoiceConfig': [value: number];
  create: [];
  close: [];
}>();

const i18n = t();
const options = [1, 2, 3, 4, 5, 6];
const CHOICE_COUNTS = [1, 2, 3, 4, 5];

function setOption(index: number, value: string): void {
  const next = [...props.optionValues];
  while (next.length < options.length) {
    next.push('');
  }
  next[index] = value;
  emit('update:options', next);
}
const rows = [[{}, {}], ...options.map(() => [{}, {}]), [{}, {}], [{}, {}]];
</script>

<template>
  <Popup
    animated
    :caption="i18n.t('votingCreatorTitle')"
    :position="fixedOrCenter(props.left, props.top)"
    clipped
  >
    <VerticalPanel :spacing="10">
      <GwtTable :columns="2" :padding="3" :rows="rows">
        <div class="gwt-Label">{{ i18n.t('votingTitlePrompt') }}:</div>
        <textarea
          class="gwt-TextArea"
          :maxlength="VOTE_MAX_TITLE"
          style="width: 20em; height: 5em"
          :value="props.title"
          @input="emit('update:title', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
        <template v-for="n in options" :key="n">
          <div class="gwt-Label" style="text-align: right">
            {{ i18n.t('votingOptionPrompt') }} {{ n }}:
          </div>
          <input
            type="text"
            class="gwt-TextBox"
            :maxlength="VOTE_MAX_OPTION_LENGTH"
            style="width: 20em"
            :value="props.optionValues[n - 1] ?? ''"
            @input="setOption(n - 1, ($event.target as HTMLInputElement).value)"
          />
        </template>
        <div class="gwt-Label">{{ i18n.t('votingDurationPrompt') }}</div>
        <select
          class="gwt-ListBox"
          :value="String(props.durationSec)"
          @change="emit('update:durationSec', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="d in NORMAL_DURATIONS_SEC" :key="d" :value="d">
            {{
              d < 60
                ? i18n.t('durationSecond', String(d))
                : i18n.t('durationMinute', String(d / 60))
            }}
          </option>
        </select>
        <div class="gwt-Label">{{ i18n.t('votingMultipleChoicePrompt') }}</div>
        <select
          class="gwt-ListBox"
          :value="String(props.multipleChoiceConfig)"
          @change="
            emit(
              'update:multipleChoiceConfig',
              ($event.target as HTMLSelectElement).selectedIndex + 1,
            )
          "
        >
          <option v-for="n in CHOICE_COUNTS" :key="n" :value="n">
            {{ n === 1 ? i18n.t('multipleChoiceSingleOnly') : i18n.t('multipleChoice', String(n)) }}
          </option>
        </select>
      </GwtTable>
      <div style="text-align: center">
        <button
          type="button"
          class="gwt-Button"
          :disabled="props.locked ? true : undefined"
          @click="emit('create')"
        >
          {{ i18n.t('create') }}
        </button>
        <button
          type="button"
          class="gwt-Button"
          :disabled="props.locked ? true : undefined"
          @click="emit('close')"
        >
          {{ i18n.t('close') }}
        </button>
      </div>
      <div v-if="props.error">
        <div class="gwt-Label" style="color: rgb(255, 0, 0)">{{ props.error }}</div>
      </div>
    </VerticalPanel>
  </Popup>
</template>
