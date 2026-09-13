<script setup lang="ts">
import { onMounted, ref } from 'vue';

const emit = defineEmits<{ submit: [password: string] }>();
const password = ref('');
const box = ref<HTMLInputElement | null>(null);

onMounted(() => box.value?.focus());
</script>

<template>
  <div class="sys-gate">
    <div class="sys-dialog">
      <div class="sys-dialog-caption">Authentication</div>
      <div class="sys-dialog-body sys-row">
        <label for="sys-password">password</label>
        <input
          id="sys-password"
          ref="box"
          v-model="password"
          type="password"
          class="sys-input"
          @keyup.enter="emit('submit', password)"
        />
      </div>
    </div>
  </div>
</template>
