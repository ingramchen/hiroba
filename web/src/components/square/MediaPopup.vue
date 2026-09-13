<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Popup from '../../gwt/Popup.vue';
import { GwtTable } from '../../gwt/panels';
import { fitSize } from '../../media/fit';

const props = defineProps<{ src: string }>();
const emit = defineEmits<{ close: [] }>();

const width = ref(0);
const height = ref(0);
const image = ref<HTMLImageElement | null>(null);

function measure(): void {
  const el = image.value;
  if (el === null) {
    return;
  }
  const fitted = fitSize(
    el.naturalWidth,
    el.naturalHeight,
    document.documentElement.clientWidth - 50,
    document.documentElement.clientHeight - 50,
  );
  width.value = fitted.width;
  height.value = fitted.height;
}

onMounted(measure);
</script>

<template>
  <Popup
    animated
    cls="gwt-DecoratedPopupPanel"
    prefix="popup"
    :caption="null"
    clipped
    modal
    auto-hide
    @auto-hide="emit('close')"
  >
    <GwtTable
      :columns="1"
      :spacing="2"
      :rows="[[{ textAlign: 'right' }], [{}]]"
      @click="emit('close')"
    >
      <button type="button" class="gwt-Button" @click="emit('close')">X</button>
      <img
        ref="image"
        class="gwt-Image SquareCssResource-mediaPopup"
        :src="props.src"
        :width="width > 0 ? width : undefined"
        :height="height > 0 ? height : undefined"
        @load="measure"
        @click="emit('close')"
      />
    </GwtTable>
  </Popup>
</template>
