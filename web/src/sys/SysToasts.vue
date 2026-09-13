<script setup lang="ts">
export interface SysToast {
  id: number;
  message: string;
  failure: boolean;
}

defineProps<{ toasts: SysToast[] }>();
</script>

<template>
  <div class="sys-toasts">
    <div
      v-for="entry in toasts"
      :key="entry.id"
      class="sys-toast"
      :class="{ 'is-failure': entry.failure }"
    >
      {{ entry.message }}
    </div>
  </div>
</template>
