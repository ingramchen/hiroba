<script setup lang="ts">
import { ref } from 'vue';
import type { SysImage } from '@hiroba/shared';
import { formatTime } from './format';

defineProps<{ images: SysImage[]; startedAt: number }>();

const emit = defineEmits<{ reload: []; forbid: [image: SysImage]; delete: [image: SysImage] }>();

const preview = ref<SysImage | null>(null);
</script>

<template>
  <h2 class="sys-view-title">Images</h2>
  <div class="sys-panel">
    <div class="sys-row">
      <button type="button" class="sys-button sys-reload-images" @click="emit('reload')">
        reload
      </button>
      <span class="sys-note">{{ images.length }} shown</span>
    </div>
    <p class="sys-note">
      The feed lists images as they are posted into a square, newest first. It started collecting at
      <span class="sys-feed-started">{{ formatTime(startedAt) }}</span
      >, so anything posted before that is not here.
    </p>
  </div>

  <div v-if="images.length === 0" class="sys-empty sys-feed-empty">
    nothing has been posted since {{ formatTime(startedAt) }}
  </div>
  <div v-else class="sys-feed">
    <div v-for="image in images" :key="image.url + String(image.time)" class="sys-feed-card">
      <img :src="image.url" alt="" @click="preview = image" />
      <div class="sys-feed-meta">
        <div class="sys-feed-topic">{{ image.topic }}</div>
        <div>{{ image.senderNickname }}</div>
        <div>{{ formatTime(image.time) }}</div>
      </div>
      <button type="button" class="sys-button is-danger" @click="emit('forbid', image)">
        Forbid here
      </button>
      <button type="button" class="sys-button is-danger" @click="emit('delete', image)">
        Delete object
      </button>
    </div>
  </div>

  <div v-if="preview !== null" class="sys-overlay" @click="preview = null">
    <div class="sys-dialog sys-preview">
      <div class="sys-dialog-caption">{{ preview.topic }}</div>
      <div class="sys-dialog-body"><img :src="preview.url" alt="" /></div>
    </div>
  </div>
</template>
