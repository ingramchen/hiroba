<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{ send: [topic: string, content: string] }>();

const BROADCAST_NOTES = [
  'topic 空白表示送給所有的 topic',
  "content 為 'reconnect' 則送出斷線 popup",
  "content 為 'redirect' 則送出踢回首頁",
  'content will be html encoded',
];

const topic = ref('');
const content = ref('');

function send(): void {
  if (content.value.trim().length === 0) return;
  emit('send', topic.value, content.value);
  content.value = '';
}

defineExpose({ topic, content });
</script>

<template>
  <h2 class="sys-view-title">Broadcast</h2>
  <div class="sys-panel">
    <div class="sys-row">
      <label for="sys-bc-topic">topic</label>
      <input id="sys-bc-topic" v-model="topic" type="text" class="sys-input sys-topic-box" />
    </div>
    <div class="sys-row">
      <label for="sys-bc-content">content</label>
      <textarea id="sys-bc-content" v-model="content" class="sys-input sys-content-box"></textarea>
    </div>
    <div class="sys-row">
      <button type="button" class="sys-button" @click="send()">send</button>
    </div>
    <ul class="sys-note">
      <li v-for="note in BROADCAST_NOTES" :key="note">{{ note }}</li>
    </ul>
  </div>
</template>
