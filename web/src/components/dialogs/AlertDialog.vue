<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Popup from '../../gwt/Popup.vue';
import type { PopupPosition } from '../../gwt/Popup.vue';
import { t } from '../../runtime';

const props = withDefaults(
  defineProps<{ content: string; allowCancel?: boolean; position?: PopupPosition }>(),
  { allowCancel: false, position: () => ({ mode: 'topCenter' }) as PopupPosition },
);
const emit = defineEmits<{ ok: []; cancel: [] }>();

const i18n = t();
const okButton = ref<HTMLButtonElement | null>(null);

onMounted(() => {
  okButton.value?.focus();
});
</script>

<template>
  <Popup animated caption="&#160;" :position="props.position" clipped>
    <div class="GlobalCssResource-alertDialog">
      <div class="gwt-HTML GlobalCssResource-alertDialogContent">{{ props.content }}</div>
      <div class="GlobalCssResource-alertDialogControls">
        <button ref="okButton" type="button" class="gwt-Button" @click="emit('ok')">
          {{ i18n.t('ok') }}
        </button>
        <button v-if="props.allowCancel" type="button" class="gwt-Button" @click="emit('cancel')">
          {{ i18n.t('cancel') }}
        </button>
      </div>
    </div>
  </Popup>
</template>
