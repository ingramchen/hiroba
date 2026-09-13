<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Popup from '../gwt/Popup.vue';
import { GwtTable } from '../gwt/panels';

const emit = defineEmits<{ submit: [password: string] }>();
const password = ref('');
const box = ref<HTMLInputElement | null>(null);

onMounted(() => box.value?.focus());
</script>

<template>
  <Popup caption="Authentication">
    <GwtTable :columns="2" :rows="[[{}, {}]]">
      <div class="gwt-HTML">password</div>
      <input
        ref="box"
        v-model="password"
        type="password"
        class="gwt-PasswordTextBox"
        @keyup.enter="emit('submit', password)"
      />
    </GwtTable>
  </Popup>
</template>
