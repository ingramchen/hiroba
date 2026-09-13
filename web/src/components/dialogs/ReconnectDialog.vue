<script setup lang="ts">
import { ref } from 'vue';
import Popup from '../../gwt/Popup.vue';
import { fixedOrCenter } from '../../gwt/relativePosition';
import { VerticalPanel, GwtTable } from '../../gwt/panels';
import { IMG } from '../../assets/images';
import { t } from '../../runtime';

const props = withDefaults(defineProps<{ left?: number; top?: number; detail?: string }>(), {
  detail: '',
});

const emit = defineEmits<{ reconnect: [] }>();

const i18n = t();
const open = ref(false);

function toggle(): void {
  open.value = !open.value;
}
</script>

<template>
  <Popup
    animated
    :caption="i18n.transport('failStopTitle')"
    :position="fixedOrCenter(props.left, props.top)"
    clipped
  >
    <VerticalPanel
      :spacing="15"
      :table-style="{ height: '100px', width: '300px' }"
      class="GlobalCssResource-failStopContent"
    >
      <div class="gwt-HTML">{{ i18n.transport('failStopContent') }}</div>
      <VerticalPanel
        class="gwt-DisclosurePanel"
        :class="open ? 'gwt-DisclosurePanel-open' : 'gwt-DisclosurePanel-closed'"
      >
        <a class="header" href="javascript:void(0);" style="display: block" @click="toggle">
          <GwtTable :columns="2" :rows="[[{ align: 'center', width: '16px' }, {}]]">
            <img class="gwt-Image" :src="open ? IMG.down.src : IMG.up.src" width="16" height="16" />
            <span>Detail error:</span>
          </GwtTable>
        </a>
        <div :style="{ padding: '0px', overflow: 'hidden', ...(open ? {} : { display: 'none' }) }">
          <div class="content" style="overflow: auto; position: relative; zoom: 1; height: 200px">
            <div style="position: relative; zoom: 1">
              <div class="gwt-HTML" style="white-space: pre-line">
                {{ props.detail.length === 0 ? 'none' : props.detail }}
              </div>
            </div>
          </div>
        </div>
      </VerticalPanel>
      <button type="button" class="gwt-Button" @click="emit('reconnect')">
        {{ i18n.transport('tryToReconnect') }}
      </button>
    </VerticalPanel>
  </Popup>
</template>
