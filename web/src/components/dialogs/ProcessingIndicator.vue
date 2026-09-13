<script setup lang="ts">
import Popup from '../../gwt/Popup.vue';
import GwtImage from '../../gwt/GwtImage.vue';
import { HorizontalPanel } from '../../gwt/panels';
import { IMG } from '../../assets/images';
import { t } from '../../runtime';

const props = defineProps<{ done: boolean }>();

const i18n = t();
</script>

<template>
  <Popup animated modal cls="gwt-PopupPanel" :inner="false" prefix="popup">
    <HorizontalPanel
      v-if="props.done"
      :spacing="8"
      align="center"
      valign="middle"
      :table-style="{ width: '100px', height: '50px' }"
    >
      <div class="gwt-Label" style="font-size: 16px">{{ i18n.t('completed') }}</div>
    </HorizontalPanel>
    <HorizontalPanel v-else :spacing="8" align="center" valign="middle">
      <GwtImage :img="IMG.largeLoading" cls="GlobalCssResource-img32" />
      <div class="gwt-Label">{{ i18n.t('processingMessage') }}</div>
    </HorizontalPanel>
  </Popup>
</template>
