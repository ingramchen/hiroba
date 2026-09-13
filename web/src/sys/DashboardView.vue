<script setup lang="ts">
import { computed } from 'vue';
import type { SysStatPoint, SysStatsResponse } from '@hiroba/shared';

const props = defineProps<{
  stats: SysStatsResponse | null;
  top: Record<string, number>;
  days: number;
}>();

const emit = defineEmits<{ reload: [days: number]; view: [topic: string] }>();

const RANGES = [7, 30, 90] as const;

const series = computed(() =>
  props.stats === null
    ? []
    : [
        { key: 'messages', label: 'messages', points: props.stats.messages },
        { key: 'accounts', label: 'accounts', points: props.stats.accounts },
        { key: 'anonymous', label: 'anonymous', points: props.stats.anonymous },
        { key: 'squares', label: 'squares', points: props.stats.squares },
        { key: 'posters', label: 'posters', points: props.stats.posters },
        { key: 'votings', label: 'votings', points: props.stats.votings },
      ],
);

const topRows = computed(() =>
  Object.entries(props.top).map(([topic, crowd]) => ({ topic, crowd })),
);

function height(points: SysStatPoint[], point: SysStatPoint): string {
  const top = Math.max(...points.map((entry) => entry.count), 1);
  return String(Math.max(1, Math.round((point.count / top) * 100))) + '%';
}

const bucketNote = computed(() => {
  if (props.stats === null) return 'Daily buckets follow the server time zone.';
  if (props.stats.timeZoneConfigured) {
    return (
      'Daily buckets are cut in ' + props.stats.timeZone + ', the configured server time zone.'
    );
  }
  return (
    'Daily buckets are cut in ' +
    props.stats.timeZone +
    ' — the server has no time zone configured, so this is the fallback.'
  );
});

function sum(points: SysStatPoint[]): number {
  return points.reduce((total, point) => total + point.count, 0);
}
</script>

<template>
  <h2 class="sys-view-title">Dashboard</h2>
  <div class="sys-panel">
    <div class="sys-row">
      <span>range</span>
      <button
        v-for="range in RANGES"
        :key="range"
        type="button"
        class="sys-button"
        :class="{ 'is-active': range === days }"
        @click="emit('reload', range)"
      >
        {{ range }} days
      </button>
      <button type="button" class="sys-button" @click="emit('reload', days)">reload</button>
    </div>
    <p class="sys-note sys-bucket-note">{{ bucketNote }}</p>
  </div>

  <div v-if="stats === null" class="sys-empty">no statistics loaded</div>
  <template v-else>
    <div class="sys-stats">
      <div class="sys-stat">
        <div class="sys-stat-label">crowd now</div>
        <div class="sys-stat-value sys-stat-crowd">{{ stats.crowd }}</div>
      </div>
      <div class="sys-stat">
        <div class="sys-stat-label">live squares</div>
        <div class="sys-stat-value sys-stat-live">{{ stats.liveSquares }}</div>
      </div>
      <div class="sys-stat">
        <div class="sys-stat-label">accounts</div>
        <div class="sys-stat-value">{{ stats.totals.accounts }}</div>
      </div>
      <div class="sys-stat">
        <div class="sys-stat-label">anonymous</div>
        <div class="sys-stat-value">{{ stats.totals.anonymous }}</div>
      </div>
      <div class="sys-stat">
        <div class="sys-stat-label">messages</div>
        <div class="sys-stat-value">{{ stats.totals.messages }}</div>
      </div>
      <div class="sys-stat">
        <div class="sys-stat-label">squares</div>
        <div class="sys-stat-value">{{ stats.totals.squares }}</div>
      </div>
    </div>
    <p class="sys-note">
      Crowd is the current number only; the site keeps no history of how many people were here, so
      it cannot be drawn over time.
    </p>

    <div v-for="entry in series" :key="entry.key" class="sys-panel sys-series">
      <div class="sys-row">
        <strong>{{ entry.label }}</strong>
        <span class="sys-note">{{ sum(entry.points) }} in {{ stats.days }} days</span>
      </div>
      <div v-if="entry.points.length === 0" class="sys-empty">nothing in this range</div>
      <div v-else class="sys-bars">
        <div
          v-for="point in entry.points"
          :key="point.day"
          class="sys-bar"
          :title="point.day + ': ' + point.count"
          :style="{ height: height(entry.points, point) }"
        ></div>
      </div>
    </div>

    <div class="sys-panel">
      <div class="sys-row"><strong>busiest squares</strong></div>
      <div v-if="topRows.length === 0" class="sys-empty">no square has a crowd right now</div>
      <table v-else class="sys-table sys-top-topics">
        <thead>
          <tr>
            <th>square</th>
            <th>crowd</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in topRows" :key="row.topic">
            <td>{{ row.topic }}</td>
            <td>{{ row.crowd }}</td>
            <td>
              <button type="button" class="sys-button" @click="emit('view', row.topic)">
                view chatters
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
