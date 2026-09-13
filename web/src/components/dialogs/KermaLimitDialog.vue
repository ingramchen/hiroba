<script setup lang="ts">
import Popup from '../../gwt/Popup.vue';
import { VerticalPanel } from '../../gwt/panels';
import { t } from '../../runtime';

const props = defineProps<{ title: string; desc: string }>();

const emit = defineEmits<{ autoHide: [] }>();

const i18n = t();

function refresh(): void {
  window.location.assign(window.location.href);
}
</script>

<template>
  <Popup animated auto-hide :caption="props.title" clipped @auto-hide="emit('autoHide')">
    <VerticalPanel :spacing="15" :table-style="{ height: '100px', width: '300px' }">
      <div class="gwt-HTML">{{ props.desc }}</div>
      <button type="button" class="gwt-Button" @click="refresh">
        {{ i18n.t('refreshPage') }}
      </button>
    </VerticalPanel>
  </Popup>
</template>
