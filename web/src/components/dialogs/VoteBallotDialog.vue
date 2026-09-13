<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import Popup from '../../gwt/Popup.vue';
import GwtImage from '../../gwt/GwtImage.vue';
import { VerticalPanel } from '../../gwt/panels';
import { IMG } from '../../assets/images';
import { t } from '../../runtime';
import { toggleBallotChoice } from '../../live/voteBallot';

const props = withDefaults(
  defineProps<{
    options?: string[];
    maxChoice?: number;
  }>(),
  { options: () => [], maxChoice: 1 },
);

const emit = defineEmits<{ cast: [indexes: number[]]; close: [] }>();

const i18n = t();
const selected = ref<number[]>([]);
const busy = ref(false);
const done = ref(false);
const failure = ref('');
const timers: number[] = [];

const caption =
  props.maxChoice > 1
    ? i18n.t('votingChoosePrompt') + ' ' + i18n.t('multipleChoice', String(props.maxChoice))
    : i18n.t('votingChoosePrompt');

function pick(index: number, checked: boolean): void {
  selected.value =
    props.maxChoice > 1
      ? toggleBallotChoice(selected.value, index, checked, props.maxChoice)
      : [index];
}

function submit(): void {
  if (selected.value.length === 0 || busy.value) {
    return;
  }
  busy.value = true;
  emit('cast', [...selected.value]);
}

function schedule(run: () => void, delay: number): void {
  timers.push(window.setTimeout(run, delay));
}

function succeed(elapsed: number): void {
  const step = Math.max(100, 1000 - elapsed);
  schedule(() => {
    busy.value = false;
    done.value = true;
  }, step);
  schedule(() => emit('close'), step + 1000);
}

function fail(message: string): void {
  busy.value = false;
  failure.value = message;
}

onBeforeUnmount(() => {
  for (const id of timers) {
    window.clearTimeout(id);
  }
});

defineExpose({ succeed, fail });
</script>

<template>
  <Popup animated :caption="caption" :position="{ mode: 'center' }" modal clipped>
    <VerticalPanel :spacing="10" :table-style="{ width: '250px' }">
      <span v-for="(option, index) in props.options" :key="index" class="gwt-RadioButton">
        <input
          v-if="props.maxChoice <= 1"
          type="radio"
          name="option"
          :checked="selected.includes(index)"
          @change="pick(index, true)"
        />
        <input
          v-else
          type="checkbox"
          :checked="selected.includes(index)"
          @change="pick(index, ($event.target as HTMLInputElement).checked)"
        />
        <label @click="pick(index, !selected.includes(index))">{{ option }}</label>
      </span>
      <div style="text-align: center; width: 100%">
        <GwtImage v-if="busy" :img="IMG.smallLoading" cls="GlobalCssResource-img24" />
        <button
          v-if="!busy && !done && failure === ''"
          type="button"
          class="gwt-Button"
          @click="submit()"
        >
          {{ i18n.t('votingVote') }}
        </button>
        <span v-if="done" class="gwt-Label">{{ i18n.t('completed') }}</span>
        <template v-if="failure !== ''">
          <button type="button" class="gwt-Button" @click="emit('close')">
            {{ i18n.t('close') }}
          </button>
          <span style="color: red">* {{ failure }}</span>
        </template>
      </div>
    </VerticalPanel>
  </Popup>
</template>
