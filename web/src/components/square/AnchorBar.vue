<script setup lang="ts">
import { t } from '../../runtime';

const props = defineProps<{ anchor: string; anchorHref?: string }>();
const emit = defineEmits<{ coAnchors: [] }>();
const i18n = t();
</script>

<template>
  <div class="SquareCssResource-anchorBar">
    <span class="gwt-InlineLabel SquareCssResource-anchorBarLabel"
      >{{ i18n.t('anchorPrompt') }}:</span
    >
    <div class="gwt-HTML SquareCssResource-anchorBarAnchor">
      {{ props.anchor }}
    </div>
    <a
      class="gwt-Anchor SquareCssResource-anchorBarCoAnchor"
      href="javascript:;"
      @click.stop="emit('coAnchors')"
      >{{ i18n.t('coAnchors') + '...' }}</a
    >
  </div>
</template>
