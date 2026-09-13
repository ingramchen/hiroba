<script setup lang="ts">
import Popup from '../../gwt/Popup.vue';
import { fixedOrCenter } from '../../gwt/relativePosition';
import { VerticalPanel } from '../../gwt/panels';
import { t } from '../../runtime';

const props = defineProps<{ message: string; left?: number; top?: number }>();

const emit = defineEmits<{ close: [] }>();

const i18n = t();
</script>

<template>
  <Popup :caption="i18n.t('broadcast')" :position="fixedOrCenter(props.left, props.top)" modal>
    <VerticalPanel :table-style="{ width: '500px' }">
      <div class="gwt-HTML" style="height: 300px; font-size: 20px; padding: 10px">
        <pre v-html="props.message"></pre>
        <pre></pre>
      </div>
      <button type="button" class="gwt-Button" @click="emit('close')">{{ i18n.t('close') }}</button>
    </VerticalPanel>
  </Popup>
</template>
