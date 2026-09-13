<script setup lang="ts">
import { computed } from 'vue';
import { calculateColor, rgbCss, type SysChatter } from '@hiroba/shared';
import SysBanner from './SysBanner.vue';
import { sharedAddressOf } from './banner';

const props = defineProps<{
  topic: string;
  chatters: SysChatter[];
  forbidden: Record<string, boolean>;
}>();

const emit = defineEmits<{
  reload: [];
  forbid: [chatter: SysChatter, unforbid: boolean];
  ban: [chatter: SysChatter, unban: boolean];
}>();

const shared = computed(() => sharedAddressOf(props.chatters));

function nicknameStyle(chatter: SysChatter): string {
  return 'color:' + rgbCss(calculateColor(chatter.publicId, chatter.colorToken));
}

function banState(chatter: SysChatter): string {
  return chatter.kermaForbidForever ? 'banned' : 'not banned';
}
</script>

<template>
  <h2 class="sys-view-title">Chatters at {{ topic }}</h2>
  <SysBanner v-if="shared !== null" :address="shared" />
  <div class="sys-panel">
    <div class="sys-row">
      <button type="button" class="sys-button sys-reload-chatters" @click="emit('reload')">
        reload
      </button>
      <span class="sys-note">{{ chatters.length }} in the square</span>
    </div>
    <p class="sys-note">
      Forbid mutes a chatter in this square only. Ban is site-wide and permanent until it is lifted;
      the two are separate states and lifting one does not lift the other.
    </p>
  </div>

  <div v-if="chatters.length === 0" class="sys-empty">nobody is in this square</div>
  <table v-else class="sys-table sys-chatters-table">
    <thead>
      <tr>
        <th>nickname</th>
        <th>address</th>
        <th>ips</th>
        <th>forbid here</th>
        <th>site-wide</th>
        <th>publicId</th>
        <th>privateId</th>
        <th>actions</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="chatter in chatters" :key="chatter.publicId" class="sys-chatter-row">
        <td class="sys-chatter-nickname" :style="nicknameStyle(chatter)">{{ chatter.nickname }}</td>
        <td class="sys-mono sys-chatter-address">{{ chatter.address }}</td>
        <td class="sys-mono sys-chatter-ips">{{ chatter.ips }}</td>
        <td>
          <span
            class="sys-badge sys-forbid-state"
            :class="{ 'is-on': forbidden[chatter.publicId] === true }"
          >
            {{ forbidden[chatter.publicId] === true ? 'forbidden' : 'free' }}
          </span>
        </td>
        <td>
          <span class="sys-badge sys-ban-state" :class="{ 'is-on': chatter.kermaForbidForever }">
            {{ banState(chatter) }}
          </span>
        </td>
        <td class="sys-mono sys-chatter-public">{{ chatter.publicId }}</td>
        <td class="sys-mono sys-chatter-private">{{ chatter.privateId }}</td>
        <td>
          <div class="sys-row" style="margin: 0">
            <button
              type="button"
              class="sys-button is-danger"
              @click="emit('forbid', chatter, false)"
            >
              Forbid
            </button>
            <button type="button" class="sys-button" @click="emit('forbid', chatter, true)">
              UnForbid
            </button>
            <button
              type="button"
              class="sys-button is-danger"
              :disabled="chatter.privateId.length === 0"
              @click="emit('ban', chatter, false)"
            >
              Ban site-wide
            </button>
            <button
              type="button"
              class="sys-button"
              :disabled="chatter.privateId.length === 0"
              @click="emit('ban', chatter, true)"
            >
              Unban
            </button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</template>
