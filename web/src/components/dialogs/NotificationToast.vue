<script setup lang="ts">
import { computed } from 'vue';
import Popup from '../../gwt/Popup.vue';
import type { PopupPosition } from '../../gwt/Popup.vue';
import { fixedOrElse } from '../../gwt/relativePosition';

const props = withDefaults(
  defineProps<{
    message: string;
    failure?: boolean;
    index?: number;
    left?: number | undefined;
    top?: number | undefined;
  }>(),
  { failure: false, index: 0, left: undefined, top: undefined },
);

const position = computed<PopupPosition>(() =>
  fixedOrElse({ mode: 'notification', index: props.index }, props.left, props.top),
);
</script>

<template>
  <Popup
    animated
    cls="gwt-DecoratedPopupPanel"
    prefix="popup"
    :caption="null"
    :position="position"
    clipped
  >
    <div
      :class="[
        'gwt-HTML',
        props.failure ? 'GlobalCssResource-failureMessage' : 'GlobalCssResource-successMessage',
      ]"
    >
      {{ props.message }}
    </div>
  </Popup>
</template>
