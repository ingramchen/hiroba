<script setup lang="ts">
import Popup from '../../gwt/Popup.vue';
import GwtImage from '../../gwt/GwtImage.vue';
import { HorizontalPanel } from '../../gwt/panels';
import { IMG } from '../../assets/images';
import { t } from '../../runtime';

const props = defineProps<{ connected: boolean }>();

const i18n = t();
</script>

<template>
  <Popup animated cls="gwt-PopupPanel" :inner="false" prefix="popup">
    <HorizontalPanel :spacing="10" align="center" valign="middle">
      <GwtImage v-if="!props.connected" :img="IMG.smallLoading" cls="GlobalCssResource-img16" />
      <div class="gwt-Label">
        {{ props.connected ? i18n.t('connected') : i18n.t('connectingMessage') }}
      </div>
    </HorizontalPanel>
  </Popup>
</template>
