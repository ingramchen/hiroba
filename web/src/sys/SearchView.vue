<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SysJoinRecord } from '@hiroba/shared';
import SysBanner from './SysBanner.vue';
import { sharedAddressOf } from './banner';
import { formatDays, formatTime } from './format';

const props = defineProps<{
  records: SysJoinRecord[];
  retentionMs: number;
  searched: boolean;
}>();

const emit = defineEmits<{
  search: [query: { address: string; publicId: string; topic: string }];
}>();

const address = ref('');
const publicId = ref('');
const topic = ref('');

const shared = computed(() => sharedAddressOf(props.records));

function search(): void {
  emit('search', { address: address.value, publicId: publicId.value, topic: topic.value });
}

function fill(value: string): void {
  address.value = value;
  search();
}
</script>

<template>
  <h2 class="sys-view-title">Address search</h2>
  <SysBanner v-if="shared !== null" :address="shared" />
  <div class="sys-panel">
    <div class="sys-row">
      <label for="sys-search-address">address</label>
      <input id="sys-search-address" v-model="address" type="text" class="sys-input" />
      <label for="sys-search-public">publicId</label>
      <input id="sys-search-public" v-model="publicId" type="text" class="sys-input" />
      <label for="sys-search-topic">square</label>
      <input id="sys-search-topic" v-model="topic" type="text" class="sys-input" />
      <button type="button" class="sys-button sys-search-button" @click="search()">search</button>
    </div>
    <p class="sys-note sys-retention-note">
      Join records are kept for {{ formatDays(retentionMs) }} days and then deleted, so this search
      only sees the last {{ formatDays(retentionMs) }} days. An empty search answers nothing.
    </p>
  </div>

  <div v-if="!searched" class="sys-empty">type an address, a publicId or a square and search</div>
  <div v-else-if="records.length === 0" class="sys-empty sys-search-empty">
    no join record matches
  </div>
  <table v-else class="sys-table sys-search-table">
    <thead>
      <tr>
        <th>joined</th>
        <th>square</th>
        <th>nickname</th>
        <th>address</th>
        <th>ips</th>
        <th>forbid</th>
        <th>publicId</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in records" :key="row.topic + row.publicId" class="sys-search-row">
        <td>{{ formatTime(row.joinTime) }}</td>
        <td>{{ row.topic }}</td>
        <td>{{ row.nickname }}</td>
        <td class="sys-mono">
          <button type="button" class="sys-button" @click="fill(row.address)">
            {{ row.address }}
          </button>
        </td>
        <td class="sys-mono">{{ row.ips }}</td>
        <td>
          <span class="sys-badge" :class="{ 'is-on': row.forbid }">{{
            row.forbid ? 'forbidden' : 'free'
          }}</span>
        </td>
        <td class="sys-mono">{{ row.publicId }}</td>
      </tr>
    </tbody>
  </table>
</template>
