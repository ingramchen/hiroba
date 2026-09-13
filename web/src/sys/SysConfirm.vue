<script setup lang="ts">
defineProps<{ message: string }>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
  <div class="sys-overlay">
    <div class="sys-dialog">
      <div class="sys-dialog-caption">Confirm</div>
      <div class="sys-dialog-body sys-confirm-message">{{ message }}</div>
      <div class="sys-dialog-controls">
        <button type="button" class="sys-button is-danger" @click="emit('confirm')">確定</button>
        <button type="button" class="sys-button" @click="emit('cancel')">取消</button>
      </div>
    </div>
  </div>
</template>
