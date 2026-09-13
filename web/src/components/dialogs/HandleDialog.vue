<script setup lang="ts">
import Popup from '../../gwt/Popup.vue';
import { VerticalPanel } from '../../gwt/panels';
import { t } from '../../runtime';
import { liveText } from '../../live/messages';
import { HANDLE_MAX_LENGTH } from '@hiroba/shared';

const props = withDefaults(defineProps<{ handle?: string; error?: string }>(), {
  handle: '',
  error: '',
});

const emit = defineEmits<{
  'update:handle': [value: string];
  submit: [];
  cancel: [];
}>();

const i18n = t();
const title = liveText(i18n.locale, 'handleTitle');
const desc = liveText(i18n.locale, 'handleDesc');
</script>

<template>
  <Popup :caption="title" :position="{ mode: 'topCenter' }" clipped>
    <VerticalPanel :spacing="10" :table-style="{ width: '320px' }">
      <div class="gwt-HTML">{{ desc }}</div>
      <input
        type="text"
        class="gwt-TextBox"
        :maxlength="HANDLE_MAX_LENGTH"
        :value="props.handle"
        @input="emit('update:handle', ($event.target as HTMLInputElement).value)"
        @keydown.enter="emit('submit')"
      />
      <div v-if="props.error" class="gwt-Label" style="color: rgb(255, 0, 0)">
        {{ props.error }}
      </div>
      <div style="text-align: center">
        <button type="button" class="gwt-Button" @click="emit('submit')">
          {{ i18n.t('ok') }}
        </button>
        <button type="button" class="gwt-Button" @click="emit('cancel')">
          {{ i18n.t('cancel') }}
        </button>
      </div>
    </VerticalPanel>
  </Popup>
</template>
