<script setup lang="ts">
import { computed } from 'vue';
import Popup from '../../gwt/Popup.vue';
import { GwtTable } from '../../gwt/panels';
import { t } from '../../runtime';
import { liveText } from '../../live/messages';
import type { PasskeyAvailability } from '../../live/passkey';
import type { PopupPosition } from '../../gwt/Popup.vue';
import type { MenuId } from '../../gwt/types';

const props = withDefaults(
  defineProps<{
    menuId?: MenuId;
    google?: boolean;
    availability?: PasskeyAvailability;
    rememberMe?: boolean;
    error?: string;
    position?: PopupPosition | null;
  }>(),
  {
    menuId: 'login',
    google: false,
    availability: 'ok',
    rememberMe: true,
    error: '',
    position: null,
  },
);

const emit = defineEmits<{
  'update:rememberMe': [value: boolean];
  google: [];
  passkey: [];
  cancel: [];
}>();

const i18n = t();
const passkeyReady = computed(() => props.availability === 'ok');
const passkeyNote = computed(() => {
  switch (props.availability) {
    case 'insecure':
      return liveText(i18n.locale, 'passkeyNeedsHttps');
    case 'ip-host':
      return liveText(i18n.locale, 'passkeyNeedsHostname');
    case 'unsupported':
      return liveText(i18n.locale, 'passkeyUnsupported');
    default:
      return '';
  }
});
</script>

<template>
  <Popup
    :caption="i18n.t('login')"
    :position="props.position ?? { mode: 'relativeToMenuItem', menuId: props.menuId }"
    animated
  >
    <GwtTable
      :columns="1"
      :spacing="10"
      :table-style="{ width: '300px' }"
      :rows="[
        [{ textAlign: 'center', valign: 'middle' }],
        [{ textAlign: 'center', valign: 'middle' }],
        [{ textAlign: 'center', valign: 'middle' }],
        [{ textAlign: 'right', valign: 'middle' }],
      ]"
    >
      <div>
        <button
          type="button"
          class="gwt-Button SquareCssResource-loginGoogle"
          :disabled="!props.google"
          @click="emit('google')"
        >
          {{ i18n.t('loginWith', 'Google') }}
        </button>
        <div v-if="!props.google" class="gwt-Label">
          {{ liveText(i18n.locale, 'googleNotConfigured') }}
        </div>
      </div>
      <div>
        <button
          type="button"
          class="gwt-Button SquareCssResource-passkeyLogin"
          :disabled="!passkeyReady"
          @click="emit('passkey')"
        >
          {{ liveText(i18n.locale, 'passkeyLogin') }}
        </button>
        <div v-if="passkeyNote" class="gwt-Label">{{ passkeyNote }}</div>
        <div v-if="props.error" class="gwt-Label" style="color: rgb(255, 0, 0)">
          {{ props.error }}
        </div>
      </div>
      <span class="gwt-CheckBox">
        <input
          type="checkbox"
          value="on"
          :checked="props.rememberMe"
          @change="emit('update:rememberMe', ($event.target as HTMLInputElement).checked)"
        />
        <label>{{ i18n.t('rememberMe') }}</label>
      </span>
      <button type="button" class="gwt-Button" @click="emit('cancel')">Cancel</button>
    </GwtTable>
  </Popup>
</template>
