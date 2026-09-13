<script setup lang="ts">
import { t } from '../runtime';

const emit = defineEmits<{ about: [] }>();
const i18n = t();
</script>

<template>
  <div class="gwt-HTML GlobalCssResource-footer">
    <a class="footer-about" href="javascript:;" @click="emit('about')">{{
      i18n.t('aboutTitle')
    }}</a>
  </div>
</template>
