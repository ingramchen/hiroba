<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { canonicalTopic } from '@hiroba/shared';
import HomePage from '../pages/HomePage.vue';
import AlertDialog from '../components/dialogs/AlertDialog.vue';
import HandleDialog from '../components/dialogs/HandleDialog.vue';
import DevLoginDialog from '../components/dialogs/DevLoginDialog.vue';
import LoginLiveDialog from '../components/dialogs/LoginLiveDialog.vue';
import AboutDialog from '../components/dialogs/AboutDialog.vue';
import FaqDialog from '../components/dialogs/FaqDialog.vue';
import type { TopicRow } from '../fixtures/types';
import { toRow } from './homeRow.js';
import { clearLoading, t } from '../runtime';
import * as api from './api';
import { handleErrorText } from './messages';
import { startFailureText } from './startError';
import { homeMenuEntries } from './menu';
import { useLoginFlow } from './useLoginFlow';

const i18n = t();
const crowd = ref(0);
const hot = ref<TopicRow[]>([]);
const latest = ref<TopicRow[]>([]);
const freeTopic = ref('');
const anchorTopic = ref('');
const alert = ref('');
const ownedTopic = ref('');
const started = ref(false);
const aboutOpen = ref(false);
const faqOpen = ref(false);

const {
  account,
  googleAvailable,
  devLoginAvailable,
  loginOpen,
  loginRemember,
  loginError,
  passkeyAvailable,
  devLoginOpen,
  devLoginSubject,
  devLoginError,
  logoutConfirm,
  handleOpen,
  handleValue,
  handleError,
  loginAnchor,
  startLogin: login,
  openLoginDialog,
  closeLoginDialog,
  closeHandleDialog,
  acceptLogout,
  startGoogleLogin,
  submitPasskeyLogin,
  submitDevLogin,
  submitHandle,
} = useLoginFlow();

const username = computed(() => account.value?.username ?? null);

async function refresh(): Promise<void> {
  const result = await api.loadHome();
  if (!result.ok) {
    return;
  }
  const host = window.location.host;
  crowd.value = result.value.totalCrowd;
  hot.value = result.value.hot.map((view) => toRow(view, host));
  latest.value = result.value.latest.map((view) => toRow(view, host));
}

function topicUrl(topic: string): string {
  return '/' + encodeURIComponent(topic) + window.location.search;
}

async function go(): Promise<void> {
  const topic = canonicalTopic(freeTopic.value);
  if (topic.length === 0) {
    return;
  }
  const result = await api.anchorExists(topic);
  if (!result.ok) {
    alert.value = i18n.transport('failStopContent');
    return;
  }
  if (result.value.exists) {
    ownedTopic.value = topic;
    return;
  }
  window.location.assign(topicUrl(topic));
}

function enterOwnedTopic(): void {
  const topic = ownedTopic.value;
  ownedTopic.value = '';
  window.location.assign(topicUrl(topic));
}

async function create(): Promise<void> {
  const topic = canonicalTopic(anchorTopic.value);
  if (topic.length === 0) {
    return;
  }
  const result = await api.createAnchor(topic);
  if (result.ok) {
    window.location.assign(topicUrl(topic));
    return;
  }
  if (result.error === 'NO_HANDLE') {
    handleOpen.value = true;
    return;
  }
  alert.value = handleErrorText(i18n.locale, result.error);
}

function onMenu(index: number): void {
  const id = homeMenuEntries(i18n, username.value)[index]?.id;
  if (id === 'home') {
    window.location.assign('/');
    return;
  }
  if (id === 'qanda') {
    faqOpen.value = true;
    return;
  }
  if (id === 'login') {
    login();
    return;
  }
  if (id === 'logout') {
    logoutConfirm.value = i18n.t('logoutPrompt');
    return;
  }
}

onMounted(() => {
  document.title = 'kekeke 科科科';
  void refresh();
  void api.loadAccount().then((result) => {
    clearLoading();
    if (!result.ok) {
      alert.value = startFailureText(i18n.locale, result.error, i18n.transport('failStopContent'));
      return;
    }
    started.value = true;
    googleAvailable.value = result.value.google;
    devLoginAvailable.value = result.value.devLogin;
    account.value = result.value.account;
    if (result.value.account !== null && result.value.account.username === null) {
      handleOpen.value = true;
    }
  });
});
</script>

<template>
  <HomePage
    v-if="started"
    :crowd="crowd"
    :username="username"
    :hot="hot"
    :latest="latest"
    :free-topic="freeTopic"
    :anchor-topic="anchorTopic"
    @update:free-topic="freeTopic = $event"
    @update:anchor-topic="anchorTopic = $event"
    @go="() => void go()"
    @create="create"
    @login="login"
    @menu="onMenu"
    @about="aboutOpen = true"
  />
  <AboutDialog v-if="aboutOpen" @close="aboutOpen = false" />
  <FaqDialog v-if="faqOpen" @close="faqOpen = false" />
  <AlertDialog
    v-if="ownedTopic"
    :content="i18n.t('confirmTopicOwned')"
    allow-cancel
    @ok="enterOwnedTopic"
    @cancel="ownedTopic = ''"
  />
  <AlertDialog
    v-else-if="logoutConfirm"
    :content="logoutConfirm"
    allow-cancel
    @ok="acceptLogout"
    @cancel="logoutConfirm = ''"
  />
  <AlertDialog v-else-if="alert" :content="alert" @ok="alert = ''" @cancel="alert = ''" />
  <DevLoginDialog
    v-if="devLoginOpen"
    :subject="devLoginSubject"
    :error="devLoginError"
    @update:subject="devLoginSubject = $event"
    @submit="submitDevLogin"
    @cancel="devLoginOpen = false"
    @passkey="openLoginDialog"
  />
  <LoginLiveDialog
    v-if="loginOpen"
    :position="loginAnchor"
    :google="googleAvailable"
    :availability="passkeyAvailable"
    :remember-me="loginRemember"
    :error="loginError"
    @update:remember-me="loginRemember = $event"
    @google="startGoogleLogin"
    @passkey="() => void submitPasskeyLogin()"
    @cancel="closeLoginDialog"
  />
  <HandleDialog
    v-if="handleOpen"
    :handle="handleValue"
    :error="handleError"
    @update:handle="handleValue = $event"
    @submit="submitHandle"
    @cancel="closeHandleDialog"
  />
</template>
