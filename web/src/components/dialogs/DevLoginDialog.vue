<script setup lang="ts">
import Popup from '../../gwt/Popup.vue';
import { VerticalPanel } from '../../gwt/panels';
import { t } from '../../runtime';
import { liveText } from '../../live/messages';

const props = withDefaults(defineProps<{ subject?: string; error?: string }>(), {
  subject: '',
  error: '',
});

const emit = defineEmits<{
  'update:subject': [value: string];
  submit: [];
  cancel: [];
  passkey: [];
}>();

const i18n = t();
const title = liveText(i18n.locale, 'devLoginTitle');
const desc = liveText(i18n.locale, 'devLoginDesc');
</script>

<template>
  <Popup :caption="title" :position="{ mode: 'topCenter' }" clipped>
    <VerticalPanel :spacing="10" :table-style="{ width: '320px' }">
      <div class="gwt-HTML">{{ desc }}</div>
      <input
        type="text"
        class="gwt-TextBox SquareCssResource-devLoginSubject"
        maxlength="64"
        :value="props.subject"
        @input="emit('update:subject', ($event.target as HTMLInputElement).value)"
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
        <button
          type="button"
          class="gwt-Button SquareCssResource-devLoginPasskey"
          @click="emit('passkey')"
        >
          {{ liveText(i18n.locale, 'passkeyLogin') }}
        </button>
      </div>
    </VerticalPanel>
  </Popup>
</template>
