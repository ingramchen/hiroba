<script setup lang="ts">
import Popup from '../../gwt/Popup.vue';
import { fixedOrCenter } from '../../gwt/relativePosition';
import { VerticalPanel } from '../../gwt/panels';

const props = defineProps<{ seconds: string; left?: number; top?: number }>();
</script>

<template>
  <Popup caption="G.O.D." :position="fixedOrCenter(props.left, props.top)" :z-index="1000" modal>
    <VerticalPanel>
      <div class="gwt-HTML">
        <p class="SquareCssResource-washGuardContent">{{ props.seconds }}</p>
      </div>
    </VerticalPanel>
  </Popup>
</template>
