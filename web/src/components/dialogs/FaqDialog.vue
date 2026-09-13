<script setup lang="ts">
import { computed } from 'vue';
import Popup from '../../gwt/Popup.vue';
import { VerticalPanel } from '../../gwt/panels';
import { IMG } from '../../assets/images';
import { renderFaq } from '../../faq/markdown';
import faqSource from '../../faq/faq.md?raw';
import { t } from '../../runtime';
import { useEscapeKey } from './useEscapeKey';

const emit = defineEmits<{ close: [] }>();
const i18n = t();

const IMAGES = {
  'kerma_enough.png': IMG.kermaEnough,
  'kerma_not_enough.png': IMG.kermaNotEnough,
};

const html = computed(() => renderFaq(faqSource, IMAGES));

useEscapeKey(() => emit('close'));
</script>

<template>
  <Popup animated :caption="'Q & A'" cls="gwt-DialogBox faq-dialog" clipped modal>
    <VerticalPanel :spacing="5" :cells="[{}, { align: 'center' }]">
      <div class="gwt-HTML faq-content" v-html="html"></div>
      <button type="button" class="gwt-Button" style="width: 100px" @click="emit('close')">
        {{ i18n.t('close') }}
      </button>
    </VerticalPanel>
  </Popup>
</template>
