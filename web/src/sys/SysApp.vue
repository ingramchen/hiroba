<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type {
  SysAuditEntry,
  SysChatter,
  SysImage,
  SysJoinRecord,
  SysStatsResponse,
} from '@hiroba/shared';
import SysGate from './SysGate.vue';
import SysConfirm from './SysConfirm.vue';
import SysToasts, { type SysToast } from './SysToasts.vue';
import DashboardView from './DashboardView.vue';
import SquaresView from './SquaresView.vue';
import BroadcastView from './BroadcastView.vue';
import ChattersView from './ChattersView.vue';
import ImagesView from './ImagesView.vue';
import SearchView from './SearchView.vue';
import AuditView from './AuditView.vue';
import {
  authenticate,
  ban,
  broadcast,
  deleteImage,
  forbid,
  loadAudit,
  loadChatters,
  loadImages,
  loadStats,
  loadTopics,
  probeSession,
  removeSquare,
  searchJoinRecords,
  sealSquare,
  topTopics,
  type SysResult,
} from './api';
import { sysErrorMessage, sysSessionLost } from './feedback';

const TOAST_MS = 5000;
const RELOAD_TOAST_MS = 3000;

const authed = ref(false);
const view = ref('dashboard');
const toasts = ref<SysToast[]>([]);
const topics = ref<string[]>([]);
const stats = ref<SysStatsResponse | null>(null);
const statDays = ref(30);
const top = ref<Record<string, number>>({});
const images = ref<SysImage[]>([]);
const imagesStartedAt = ref(0);
const auditEntries = ref<SysAuditEntry[]>([]);
const records = ref<SysJoinRecord[]>([]);
const retentionMs = ref(0);
const searched = ref(false);
const openTopics = ref<string[]>([]);
const chatters = ref<Record<string, SysChatter[]>>({});
const forbidden = ref<Record<string, Record<string, boolean>>>({});
const confirming = ref<{ message: string; run: () => Promise<void> } | null>(null);

let nextToast = 0;

const currentTopic = computed(() =>
  view.value.startsWith('chatters:') ? view.value.slice('chatters:'.length) : '',
);

function toast(message: string, failure = false, duration = TOAST_MS): void {
  const id = (nextToast += 1);
  toasts.value = [...toasts.value, { id, message, failure }];
  window.setTimeout(() => {
    toasts.value = toasts.value.filter((entry) => entry.id !== id);
  }, duration);
}

function guard<T>(result: SysResult<T>): T | null {
  if (result.ok) return result.data;
  if (sysSessionLost(result.status)) authed.value = false;
  toast(sysErrorMessage(result.status), true);
  return null;
}

async function refreshTopics(quiet = false): Promise<void> {
  const data = guard(await loadTopics());
  if (data === null) return;
  topics.value = data.topics;
  if (!quiet) toast('reloaded topics: ' + String(data.topics.length), false, RELOAD_TOAST_MS);
}

async function refreshStats(days: number): Promise<void> {
  statDays.value = days;
  const data = guard(await loadStats(days));
  if (data !== null) stats.value = data;
  const busiest = await topTopics(1);
  if (busiest.ok) top.value = busiest.data;
}

async function refreshImages(): Promise<void> {
  const data = guard(await loadImages(60));
  if (data === null) return;
  images.value = data.images;
  imagesStartedAt.value = data.startedAt;
}

async function refreshAudit(): Promise<void> {
  const data = guard(await loadAudit(100));
  if (data === null) return;
  auditEntries.value = data.entries;
}

async function openChatters(topic: string, announce = true): Promise<void> {
  const name = topic.trim();
  if (name.length === 0) return;
  const data = guard(await loadChatters(name));
  if (data === null) return;
  chatters.value = { ...chatters.value, [data.topic]: data.chatters };
  const marks = guard(await searchJoinRecords({ topic: data.topic }));
  const flags: Record<string, boolean> = {};
  for (const row of marks?.records ?? []) flags[row.publicId] = row.forbid;
  forbidden.value = { ...forbidden.value, [data.topic]: flags };
  if (!openTopics.value.includes(data.topic)) {
    openTopics.value = [...openTopics.value, data.topic];
  }
  view.value = 'chatters:' + data.topic;
  if (announce) {
    toast(
      'reloaded chatters: ' + String(data.chatters.length) + ' at /topic/' + data.topic,
      false,
      RELOAD_TOAST_MS,
    );
  }
}

async function onSend(topic: string, content: string): Promise<void> {
  guard(await broadcast(topic, content));
}

function ask(message: string, run: () => Promise<void>): void {
  confirming.value = { message, run };
}

async function confirmed(): Promise<void> {
  const pending = confirming.value;
  confirming.value = null;
  if (pending !== null) await pending.run();
}

function onRemove(topic: string, permanent: boolean): void {
  const message = permanent ? 'delete ' + topic + ' in db ?' : 'remove ' + topic + ' in memory ?';
  ask(message, async () => {
    if (guard(await removeSquare(topic, permanent)) === null) return;
    toast(topic + ' removed');
    await refreshTopics();
  });
}

function onSeal(topic: string): void {
  ask('seal ' + topic + ' ?', async () => {
    guard(await sealSquare(topic));
  });
}

function onDeleteImage(image: SysImage): void {
  ask('delete the stored object of this image ?', async () => {
    if (guard(await deleteImage(image.url, image.topic, image.senderPublicId)) === null) return;
    images.value = images.value.filter((row) => row.url !== image.url);
    toast('image deleted: ' + image.url);
  });
}

async function runForbid(topic: string, publicId: string, unforbid: boolean): Promise<void> {
  const result = guard(await forbid(topic, publicId, unforbid));
  if (result === null) return;
  for (const affected of result.affected) {
    toast((unforbid ? 'unforbid:' : 'forbid:') + affected.nickname + ' pub:' + affected.publicId);
  }
  if (chatters.value[topic] !== undefined) {
    const flags: Record<string, boolean> = { ...forbidden.value[topic] };
    for (const affected of result.affected) flags[affected.publicId] = !unforbid;
    forbidden.value = { ...forbidden.value, [topic]: flags };
  }
}

async function onBan(chatter: SysChatter, unban: boolean): Promise<void> {
  const result = guard(await ban(chatter.privateId, unban));
  if (result === null) return;
  for (const [topic, rows] of Object.entries(chatters.value)) {
    if (!rows.some((row) => row.privateId === result.privateId)) continue;
    chatters.value = {
      ...chatters.value,
      [topic]: rows.map((row) =>
        row.privateId === result.privateId
          ? { ...row, kermaForbidForever: result.forbidForever }
          : row,
      ),
    };
  }
  toast(
    (unban ? 'unbanned:' : 'banned:') + chatter.nickname + ' priv:' + result.privateId,
    false,
    TOAST_MS,
  );
}

async function refreshRetention(): Promise<void> {
  const data = guard(await searchJoinRecords({}));
  if (data !== null) retentionMs.value = data.retentionMs;
}

async function onSearch(query: {
  address: string;
  publicId: string;
  topic: string;
}): Promise<void> {
  const data = guard(await searchJoinRecords(query));
  if (data === null) return;
  records.value = data.records;
  retentionMs.value = data.retentionMs;
  searched.value = true;
}

async function select(next: string): Promise<void> {
  view.value = next;
  if (next === 'dashboard') await refreshStats(statDays.value);
  else if (next === 'squares') await refreshTopics();
  else if (next === 'images') await refreshImages();
  else if (next === 'audit') await refreshAudit();
  else if (next === 'search') await refreshRetention();
}

async function onAuthenticate(password: string): Promise<void> {
  const result = await authenticate(password);
  if (result.ok) {
    authed.value = true;
    await refreshStats(statDays.value);
    return;
  }
  toast(sysErrorMessage(result.status, true), true);
}

onMounted(async () => {
  authed.value = (await probeSession()).ok;
  if (authed.value) await refreshStats(statDays.value);
});
</script>

<template>
  <template v-if="authed">
    <div class="sys-shell">
      <div class="sys-sidebar">
        <div class="sys-brand">kekeke sys</div>
        <div class="sys-nav">
          <button
            type="button"
            class="sys-nav-item"
            :class="{ 'is-active': view === 'dashboard' }"
            @click="select('dashboard')"
          >
            Dashboard
          </button>
          <button
            type="button"
            class="sys-nav-item"
            :class="{ 'is-active': view === 'squares' }"
            @click="select('squares')"
          >
            Squares
          </button>
          <button
            type="button"
            class="sys-nav-item"
            :class="{ 'is-active': view === 'images' }"
            @click="select('images')"
          >
            Images
          </button>
          <button
            type="button"
            class="sys-nav-item"
            :class="{ 'is-active': view === 'search' }"
            @click="select('search')"
          >
            Address search
          </button>
          <button
            type="button"
            class="sys-nav-item"
            :class="{ 'is-active': view === 'broadcast' }"
            @click="select('broadcast')"
          >
            Broadcast
          </button>
          <button
            type="button"
            class="sys-nav-item"
            :class="{ 'is-active': view === 'audit' }"
            @click="select('audit')"
          >
            Audit
          </button>
          <template v-if="openTopics.length > 0">
            <div class="sys-nav-group">chatters</div>
            <button
              v-for="name in openTopics"
              :key="name"
              type="button"
              class="sys-nav-item sys-nav-topic"
              :class="{ 'is-active': view === 'chatters:' + name }"
              @click="select('chatters:' + name)"
            >
              {{ name }}
            </button>
          </template>
        </div>
      </div>
      <div class="sys-main">
        <DashboardView
          v-if="view === 'dashboard'"
          :stats="stats"
          :top="top"
          :days="statDays"
          @reload="refreshStats"
          @view="openChatters"
        />
        <SquaresView
          v-else-if="view === 'squares'"
          :topics="topics"
          @reload="refreshTopics()"
          @view="openChatters"
          @remove="onRemove"
          @seal="onSeal"
        />
        <BroadcastView v-else-if="view === 'broadcast'" @send="onSend" />
        <ImagesView
          v-else-if="view === 'images'"
          :images="images"
          :started-at="imagesStartedAt"
          @reload="refreshImages"
          @forbid="(image) => runForbid(image.topic, image.senderPublicId, false)"
          @delete="onDeleteImage"
        />
        <SearchView
          v-else-if="view === 'search'"
          :records="records"
          :retention-ms="retentionMs"
          :searched="searched"
          @search="onSearch"
        />
        <AuditView v-else-if="view === 'audit'" :entries="auditEntries" @reload="refreshAudit" />
        <ChattersView
          v-else-if="currentTopic !== ''"
          :topic="currentTopic"
          :chatters="chatters[currentTopic] ?? []"
          :forbidden="forbidden[currentTopic] ?? {}"
          @reload="openChatters(currentTopic)"
          @forbid="(chatter, unforbid) => runForbid(currentTopic, chatter.publicId, unforbid)"
          @ban="onBan"
        />
      </div>
    </div>
    <SysConfirm
      v-if="confirming !== null"
      :message="confirming.message"
      @confirm="confirmed"
      @cancel="confirming = null"
    />
  </template>
  <SysGate v-else @submit="onAuthenticate" />
  <SysToasts :toasts="toasts" />
</template>
