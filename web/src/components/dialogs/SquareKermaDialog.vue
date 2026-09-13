<script setup lang="ts">
import { computed } from 'vue';
import { calcFreezeValue, isSquareUnlimited } from '@hiroba/shared';
import Popup from '../../gwt/Popup.vue';
import { VerticalPanel } from '../../gwt/panels';
import { t } from '../../runtime';
import type { MenuId } from '../../gwt/types';

const props = withDefaults(
  defineProps<{ kerma: number; minKerma?: number | null; menuId?: MenuId }>(),
  { minKerma: null, menuId: 'kerma' },
);
const emit = defineEmits<{ autoHide: [] }>();
const i18n = t();

const minKermaDesc = computed(() => {
  const min = props.minKerma;
  if (isSquareUnlimited(min) || min === null) {
    return i18n.t('squareKermaUnlimited');
  }
  if (props.kerma >= min) {
    return i18n.t('squareKermaEnough', 'SquareCssResource-squareKermaEnough', String(min));
  }
  const freeze = calcFreezeValue(min);
  if (props.kerma < freeze) {
    return i18n.t(
      'squareKermaChatFreeze',
      'SquareCssResource-squareKermaChatFreeze',
      String(min),
      String(freeze),
    );
  }
  return i18n.t('squareKermaNotEnough', 'SquareCssResource-squareKermaNotEnough', String(min));
});
</script>

<template>
  <Popup
    animated
    cls="gwt-DialogBox SquareCssResource-squareKermaPanel"
    :caption="i18n.t('squareKermaTitle')"
    :position="{ mode: 'relativeToMenuItem', menuId: props.menuId }"
    clipped
    auto-hide
    @auto-hide="emit('autoHide')"
  >
    <VerticalPanel>
      <div class="gwt-HTML">
        <div class="SquareCssResource-myKerma">{{ props.kerma }}</div>
      </div>
      <div class="gwt-HTML">
        <p class="SquareCssResource-minKerma" v-html="minKermaDesc"></p>
      </div>
    </VerticalPanel>
  </Popup>
</template>
