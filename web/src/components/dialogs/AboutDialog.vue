<script setup lang="ts">
import Popup from '../../gwt/Popup.vue';
import { VerticalPanel } from '../../gwt/panels';
import { LICENSE_NAME } from '../../live/menu';
import { t } from '../../runtime';
import { useEscapeKey } from './useEscapeKey';

const emit = defineEmits<{ close: [] }>();
const i18n = t();

const CREDITS = [
  'aboutCreditEmoji',
  'aboutCreditSmileys',
  'aboutCreditWidgets',
  'aboutCreditKmark',
] as const;

useEscapeKey(() => emit('close'));
</script>

<template>
  <Popup animated :caption="i18n.t('aboutTitle')" cls="gwt-DialogBox about-dialog" clipped modal>
    <VerticalPanel :spacing="5" :cells="[{}, {}, {}, {}, { align: 'center' }]">
      <div class="gwt-HTML about-block">{{ i18n.t('aboutDescription') }}</div>
      <div class="gwt-HTML about-block">
        <p>{{ i18n.t('aboutLicenseLabel') }} {{ LICENSE_NAME }}</p>
      </div>
      <div class="gwt-HTML about-block about-credits">
        <p class="about-credits-title">{{ i18n.t('aboutCreditsTitle') }}</p>
        <ul>
          <li v-for="key in CREDITS" :key="key" v-html="i18n.t(key)"></li>
        </ul>
      </div>
      <button type="button" class="gwt-Button" style="width: 100px" @click="emit('close')">
        {{ i18n.t('close') }}
      </button>
    </VerticalPanel>
  </Popup>
</template>
