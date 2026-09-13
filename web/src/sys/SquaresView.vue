<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ topics: string[] }>();

const emit = defineEmits<{
  reload: [];
  view: [topic: string];
  remove: [topic: string, permanent: boolean];
  seal: [topic: string];
}>();

const topic = ref('');

function squareHref(name: string): string {
  return '/' + encodeURIComponent(name);
}
</script>

<template>
  <h2 class="sys-view-title">Squares</h2>
  <div class="sys-panel">
    <div class="sys-row">
      <label for="sys-view-topic">Topic:</label>
      <input id="sys-view-topic" v-model="topic" type="text" class="sys-input sys-topic-box" />
      <button type="button" class="sys-button sys-view-button" @click="emit('view', topic)">
        view
      </button>
      <button type="button" class="sys-button" @click="emit('reload')">reload</button>
    </div>
    <p class="sys-note">
      The list is the squares held in server memory, not every square ever created.
    </p>
  </div>

  <div v-if="topics.length === 0" class="sys-empty">no square is live</div>
  <table v-else class="sys-table sys-squares-table">
    <thead>
      <tr>
        <th>square</th>
        <th>actions</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="name in topics" :key="name">
        <td class="sys-square-name">
          <a :href="squareHref(name)" target="_blank" rel="noopener">{{ name }}</a>
        </td>
        <td>
          <div class="sys-row" style="margin: 0">
            <button type="button" class="sys-button is-danger" @click="emit('remove', name, false)">
              remove
            </button>
            <button type="button" class="sys-button is-danger" @click="emit('remove', name, true)">
              delete db
            </button>
            <button type="button" class="sys-button" @click="emit('seal', name)">seal</button>
            <button type="button" class="sys-button" @click="emit('view', name)">
              view chatters
            </button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</template>
