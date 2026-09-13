<script setup lang="ts">
import type { SysAuditEntry } from '@hiroba/shared';
import { auditDetail, isReadAction } from './audit';
import { formatTime } from './format';

defineProps<{ entries: SysAuditEntry[] }>();

const emit = defineEmits<{ reload: [] }>();
</script>

<template>
  <h2 class="sys-view-title">Audit</h2>
  <div class="sys-panel">
    <div class="sys-row">
      <button type="button" class="sys-button sys-reload-audit" @click="emit('reload')">
        reload
      </button>
      <span class="sys-note">{{ entries.length }} entries, newest first</span>
    </div>
  </div>

  <div v-if="entries.length === 0" class="sys-empty">nothing recorded yet</div>
  <table v-else class="sys-table sys-audit-table">
    <thead>
      <tr>
        <th>when</th>
        <th>kind</th>
        <th>action</th>
        <th>target</th>
        <th>square</th>
        <th>from</th>
        <th>detail</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="entry in entries" :key="entry.id" class="sys-audit-row">
        <td>{{ formatTime(entry.time) }}</td>
        <td>
          <span class="sys-badge sys-audit-kind" :class="{ 'is-read': isReadAction(entry.action) }">
            {{ isReadAction(entry.action) ? 'read' : 'action' }}
          </span>
        </td>
        <td class="sys-audit-action">{{ entry.action }}</td>
        <td class="sys-mono">{{ entry.target }}</td>
        <td>{{ entry.topic }}</td>
        <td class="sys-mono">{{ entry.actor }}</td>
        <td class="sys-audit-detail">{{ auditDetail(entry) }}</td>
      </tr>
    </tbody>
  </table>
</template>
