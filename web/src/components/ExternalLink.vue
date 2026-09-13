<script setup lang="ts">
const props = defineProps<{ href: string }>();
</script>

<template>
  <a class="GlobalCssResource-external" target="_blank" rel="noopener" :href="props.href">
    <slot />
  </a>
</template>
