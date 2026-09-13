<script setup lang="ts">
import { ref } from 'vue';
import Popup from '../../gwt/Popup.vue';
import { GwtTable } from '../../gwt/panels';
import { t } from '../../runtime';

const props = withDefaults(defineProps<{ topic: string; left?: number; top?: number }>(), {
  left: 503,
  top: 29,
});

const emit = defineEmits<{ dismiss: []; close: [] }>();

const i18n = t();
const confirmed = ref(false);
</script>

<template>
  <Popup
    animated
    :caption="i18n.t('dismissAnchor')"
    :position="{ mode: 'fixed', left: props.left, top: props.top }"
    clipped
  >
    <GwtTable
      :columns="2"
      :spacing="5"
      :table-style="{ width: '200px' }"
      :rows="[[{ colspan: 2, height: '100px' }], [{ colspan: 2, valign: 'bottom' }], [{}, {}]]"
    >
      <div class="gwt-HTML">{{ i18n.t('dismissAnchorDesc', props.topic) }}</div>
      <span class="gwt-CheckBox">
        <input
          type="checkbox"
          value="on"
          :checked="confirmed"
          @change="confirmed = ($event.target as HTMLInputElement).checked"
        />
        <label @click="confirmed = !confirmed">{{ i18n.t('dismissAnchorConfirmLabel') }}</label>
      </span>
      <button
        type="button"
        class="gwt-Button"
        style="width: 90px"
        :disabled="!confirmed"
        @click="emit('dismiss')"
      >
        {{ i18n.t('dismissAnchorButton') }}
      </button>
      <button type="button" class="gwt-Button" style="width: 90px" @click="emit('close')">
        {{ i18n.t('close') }}
      </button>
    </GwtTable>
  </Popup>
</template>
