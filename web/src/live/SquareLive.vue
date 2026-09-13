<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watchEffect } from 'vue';
import {
  CROWD_QUOTA_THRESHOLD,
  CrowdOrientedInputQuota,
  DEGRADE_MAX_LENGTH,
  DEGRADE_WAIT_SECONDS,
  FreezeInputQuota,
  InfiniteInputQuota,
  LIMITS,
  SpeedInputQuota,
  WASH_GUARD_LOCK_MS,
  WASH_GUARD_PUNISH_MS,
  WashGuard,
  abbreviate,
  bestNickname,
  calcFreezeValue,
  calculateColor,
  canonicalTopic,
  isQuorumReached,
  isSquareUnlimited,
  isUnforbidQuorumReached,
  maxChoiceCount,
  rgbCss,
  VOTE_MAX_TITLE,
  VOTE_MIN_OPTIONS,
  type ChatroomType,
  type InputQuota,
  type BurnMessagePayload,
  type ForbidMessagePayload,
  type MessageEvent as ChatEvent,
  type MinKermaMessagePayload,
  type PosterMessagePayload,
  type ServerFrame,
  type SuckEuroAirPayload,
  type SystemMessagePayload,
  type UploadMediaFields,
  type VoteMessagePayload,
  isPosterableKind,
} from '@hiroba/shared';
import SquarePage from '../pages/SquarePage.vue';
import BlankPage from '../pages/BlankPage.vue';
import AlertDialog from '../components/dialogs/AlertDialog.vue';
import BroadcastDialog from '../components/dialogs/BroadcastDialog.vue';
import ReconnectDialog from '../components/dialogs/ReconnectDialog.vue';
import CoAnchorDialog from '../components/dialogs/CoAnchorDialog.vue';
import CoAnchorListDialog from '../components/dialogs/CoAnchorListDialog.vue';
import DismissAnchorDialog from '../components/dialogs/DismissAnchorDialog.vue';
import WashGuardDialog from '../components/dialogs/WashGuardDialog.vue';
import SquareKermaDialog from '../components/dialogs/SquareKermaDialog.vue';
import VoteCreatorDialog from '../components/dialogs/VoteCreatorDialog.vue';
import CrowdSelectorDialog from '../components/dialogs/CrowdSelectorDialog.vue';
import MinKermaDialog from '../components/dialogs/MinKermaDialog.vue';
import VoteForbidDialog from '../components/dialogs/VoteForbidDialog.vue';
import VotePosterDialog from '../components/dialogs/VotePosterDialog.vue';
import WatchPanel from '../components/square/WatchPanel.vue';
import MenuPopup from '../components/dialogs/MenuPopup.vue';
import RecentVotesDialog from '../components/dialogs/RecentVotesDialog.vue';
import AboutDialog from '../components/dialogs/AboutDialog.vue';
import FaqDialog from '../components/dialogs/FaqDialog.vue';
import VoteBallotDialog from '../components/dialogs/VoteBallotDialog.vue';
import UploadDialog from '../components/dialogs/UploadDialog.vue';
import SmileyDialog from '../components/dialogs/SmileyDialog.vue';
import SmileyPanel from '../components/dialogs/SmileyPanel.vue';
import EditPosterDialog from '../components/dialogs/EditPosterDialog.vue';
import PreviewUploadDialog from '../components/dialogs/PreviewUploadDialog.vue';
import HandleDialog from '../components/dialogs/HandleDialog.vue';
import DevLoginDialog from '../components/dialogs/DevLoginDialog.vue';
import LoginLiveDialog from '../components/dialogs/LoginLiveDialog.vue';
import type { ChatRow } from '../fixtures/types';
import type { MenuEntry } from '../gwt/types';
import {
  isModerationState,
  moderationStateOf,
  type CoAnchorView,
  type ModerationMessagePayload,
  type ModerationStates,
} from '@hiroba/shared';
import type { MediaItem } from '../components/square/MediaWidget.vue';
import MediaPopup from '../components/square/MediaPopup.vue';
import { smileyStockTarget, type ToolName } from '../components/square/InputArea.vue';
import {
  clearLoading,
  isEventSectionAsTop,
  isHighDensity,
  readShape,
  saveShape,
  t,
} from '../runtime';
import { DEVICE_SHAPES, deviceShapeEntries, squareMenuEntries } from './menu';
import { VOTE_TICK_MS, voteCountdown as computeCountdown } from './countdown';
import { shortDateTime, voteErrorKey, type VotePanelView } from './voteState';
import {
  MediaFlow,
  deleteMediaContent,
  deletedSourceUrl,
  parseMediaMode,
  type MediaMode,
} from './medias';
import { clipboardImage } from '../upload/upload';
import { euroSpray } from '../spray/euroSpray';
import { isMirrorWorldRunning, runMirrorWorld } from './mirrorWorld';
import spraySmoke from '../assets/img/spraySmoke.png';
import NotificationToast from '../components/dialogs/NotificationToast.vue';
import {
  addRecent,
  inputScopeOf,
  parsePickerMode,
  readRecent,
  type PickerMode,
} from '../emoji/picker';
import type { EmojiCategoryName, EmojiEntry } from '../emoji';
import { asPosterView, isNewerPoster, type PosterType, type PosterView } from '../poster/poster';
import { POSTER_FADE_MS, initialDisplayMode, type PosterDisplayMode } from '../poster/render';
import { ChatPane, RecentChatters, mentionedPublicIds, type RowOptions } from './rows';
import { provideRowActions } from './rowActions';
import { GrowLoop } from './grow';
import { ConnectionWatch, PageLifecycle, SquareSocket, CONNECT_DETECT_MS } from './socket';
import { TitleBlinker } from './title';
import { squareLocation } from './location';
import { voteCountHeader, voteStatistics, voteTotal } from '../components/square/voteChart';
import { useLoginFlow } from './useLoginFlow';
import {
  SHOP_ITEMS,
  ShopFlow,
  shopConfirmKey,
  shopCost,
  shopLabelKey,
  type ShopMenuItem,
} from './shop';
import * as api from './api';
import {
  cleanupStartIps,
  loadAnonymousId,
  loadMediaFlowMode,
  loadNickname,
  loadPosterDraft,
  loadReadPoster,
  loadRecentSmiley,
  loadSmileyCategory,
  loadScopedSmileyMode,
  loadSmileyMode,
  loadStartIpsHash,
  loadWashGuardLock,
  saveAnonymousId,
  saveMediaFlowMode,
  saveNickname,
  savePosterDraft,
  saveReadPoster,
  saveRecentSmiley,
  saveSmileyCategory,
  saveSmileyMode,
  saveStartIpsHash,
  saveWashGuardLock,
  saveScopedSmileyMode,
} from './storage';
import type { AnchorRect } from '../gwt/relativePosition';
import { ownImageUrlOfMessage } from '../media/message';
import KermaLimitDialog from '../components/dialogs/KermaLimitDialog.vue';
import { isTransportFailure, startFailureText } from './startError';
import { isUploadEnabled } from './uploadScope';
import {
  isInvalidGrowSession,
  isInvalidSession,
  parseStoredIpsHash,
  type SessionIdentity,
} from './invalidSession';
import { WatchBook, type WatchView } from './watches';
import { smileyPosition } from './smileyScope';
import ConnectionIndicator from '../components/dialogs/ConnectionIndicator.vue';
import ProcessingIndicator from '../components/dialogs/ProcessingIndicator.vue';
import { CONNECTED_HIDE_MS, Indicator, PROCESSING_DONE_MS, type IndicatorPhase } from './indicator';
import { voteChartDecor, voteChartTitle } from './voteState';

const votePanel = shallowRef<VotePanelView | null>(null);

const props = defineProps<{ topic: string }>();

const WATCH_MAX_MESSAGES = 100;
const STORAGE_CLEANUP_DELAY_MS = 3000;

const VOTE_POSTER_TITLE_LENGTH = 30;

const i18n = t();
const canonical = canonicalTopic(props.topic);
const place = squareLocation(canonical, window.location);
const host = place.host;
const hostHref = place.hostHref;

const start = shallowRef<api.SquareStart | null>(null);
const sealed = ref(false);
const crowd = ref(0);
const displayCrowd = ref(0);
const rows = ref<ChatRow[]>([]);
const kekeRows = ref<ChatRow[]>([]);
const nickname = ref('');
const message = ref('');
const kekeMessage = ref('');
const kerma = ref(0);
const minKerma = ref<number | null>(null);
const roomType = ref<ChatroomType>('FREE');
const forbidden = ref(false);
const quotaOk = ref(true);
const quotaText = ref('');
const showColorUntil = ref(0);
const forbidFromChatUntil = ref(0);
const alert = ref('');
const kermaLimit = ref<{ title: string; desc: string } | null>(null);
const broadcast = ref('');
const reconnect = ref(false);
const reconnectDetail = ref('');
const washSeconds = ref('');
const washPunished = ref(false);
const kermaPanel = ref(false);
const coAnchorOpen = ref(false);
const coAnchorListOpen = ref(false);
const dismissOpen = ref(false);
const coAnchorList = ref<CoAnchorView[]>([]);
const notLoginConfirm = ref('');
const startFailed = ref(false);
const startFailedText = ref('');
const connectPhase = ref<IndicatorPhase>('hidden');
const processPhase = ref<IndicatorPhase>('hidden');
const connectIndicator = new Indicator(CONNECTED_HIDE_MS, (phase) => {
  connectPhase.value = phase;
});
const processIndicator = new Indicator(PROCESSING_DONE_MS, (phase) => {
  processPhase.value = phase;
});
const crowdList = ref<{ publicId: string; nickname: string; color: string }[] | null>(null);
const menuOpen = ref(-1);
const shopConfirm = ref('');
const menuEntries = ref<MenuEntry[]>([]);
const menuKind = ref<'shop' | 'deviceShape'>('shop');
const uploadFields = ref<UploadMediaFields | null>(null);

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
  closeHandleDialog,
  startLogin,
  openLoginDialog,
  closeLoginDialog,
  acceptLogout,
  startGoogleLogin,
  submitPasskeyLogin,
  submitDevLogin,
  submitHandle,
} = useLoginFlow({
  onOpenLogin: () => {
    menuOpen.value = -1;
  },
});

const voteTitle = ref('');
const voteVisible = ref(false);
const vote = shallowRef<api.VoteView | null>(null);
const voteCountdown = ref('');
const voteTitleRed = ref(false);
const voteEnded = ref(false);
const voteChartVisible = ref(true);
const voteCreator = ref(false);
const voteCreatorLocked = ref(false);
let voteCreatorLockTimer = 0;
const voteForm = ref({
  title: '',
  options: ['', '', '', '', '', ''],
  durationSec: 60,
  multipleChoiceConfig: 1,
});
const voteError = ref('');
const ballotOpen = ref(false);
const ballotRef = ref<InstanceType<typeof VoteBallotDialog> | null>(null);
const votedVotingId = ref('');
const createdVotingId = ref('');
const medias = ref<MediaItem[]>([]);
const mediaMode = ref<MediaMode>(parseMediaMode(loadMediaFlowMode()));
const mediaPopup = ref<string | null>(null);
const uploadOpen = ref(false);
const uploadMounted = ref(false);
const uploadAt = ref<{ left: number; top: number } | null>(null);
const pasted = shallowRef<File | null>(null);
const pasteSeq = ref(0);
interface SmileyPickerState {
  open: boolean;
  mode: PickerMode;
  at: { left: number; top: number } | null;
}

const smileyPickers = ref<Record<string, SmileyPickerState>>({});

function smileyPicker(scope: string): SmileyPickerState {
  const existing = smileyPickers.value[scope];
  if (existing !== undefined) {
    return existing;
  }
  const created: SmileyPickerState = {
    open: false,
    mode: parsePickerMode(loadScopedSmileyMode(scope) ?? loadSmileyMode()),
    at: null,
  };
  smileyPickers.value[scope] = created;
  return created;
}
const smileyCategory = ref<EmojiCategoryName>(
  (loadSmileyCategory() ?? 'SMILE') as EmojiCategoryName,
);
const smileyRecent = ref<string[]>(readRecent(loadRecentSmiley()));
const poster = shallowRef<PosterView | null>(null);
const posterMode = ref<PosterDisplayMode>('SMALL');
const posterFade = ref(false);
const posterEditor = ref<{ mediaUrl: string; posterType: PosterType } | null>(null);
const posterPlaceKey = ref(0);
const posterDraft = ref('');
const posterError = ref('');
const posterBusy = ref(false);
const toasts = ref<{ id: number; message: string; index: number; failure: boolean }[]>([]);
const recentVotes = shallowRef<api.VoteView[] | null>(null);
const recentVotesLoading = ref(false);
let recentVotesGeneration = 0;
const aboutOpen = ref(false);
const faqOpen = ref(false);
const crowdPurpose = ref<'watch' | 'voteForbid' | 'forbid'>('watch');
const minKermaOpen = ref(false);
const minKermaLevel = ref(0);
const voteReason = ref('');
const forbidTarget = ref<{ publicId: string; nickname: string; anchor: AnchorRect | null } | null>(
  null,
);
const minKermaAnchor = ref<AnchorRect | null>(null);
const forbidDuration = ref(77);
const forbidCondition = ref('');
const forbidWaiting = ref(false);
const forbidCreating = ref(false);
const decisionVotingId = ref('');
const forbidDecision = ref<'FORBID' | 'UNFORBID' | 'BURN' | 'INVALID' | null>(null);
const minKermaWaiting = ref(false);
const minKermaDecision = ref<'APPLY' | 'INVALID' | null>(null);
const posterVoteOpen = ref(false);
const posterVoteDecision = ref<'APPLY' | 'INVALID' | null>(null);
const watchBook = new WatchBook(WATCH_MAX_MESSAGES);
const watches = ref<WatchView[]>([]);
let toastSeq = 0;
let toastShown = 0;

const chatters = new RecentChatters();
const mediaFlow = new MediaFlow();
let moderationStates: ModerationStates = {};

function syncMedias(): void {
  medias.value = [...mediaFlow.items];
  for (const item of medias.value) {
    item.moderation = moderationStateOf(moderationStates, item.sourceUrl ?? item.src);
  }
}
const shape = readShape();
const eventSectionTop = isEventSectionAsTop(shape);
const TOAST_MS = 5000;
const VOTE_CREATE_LOCK_MS = 3000;
const pane = new ChatPane();
const kekePane = new ChatPane(LIMITS.historyRing);
const blinker = new TitleBlinker();
let socket: SquareSocket | null = null;
let grower: GrowLoop | null = null;
let quota: InputQuota = new InfiniteInputQuota(LIMITS.contentClient);
const inputMaxLength = ref(quota.maxLength);
let washGuard: WashGuard | null = null;
let quotaTimer = 0;
let washCountdownTimer = 0;
let washPunishTimer = 0;
let serverSkew = 0;
let sentNickname = '';
let voteTimer = 0;
let connectTimer = 0;
let crowdTimer = 0;
let ready = false;
const connectionWatch = new ConnectionWatch(
  () => socket !== null && socket.active,
  () => {
    if (!sealed.value) {
      reconnect.value = true;
    }
  },
);
const lifecycle = new PageLifecycle({
  onHide: () => {
    grower?.stop();
    connectionWatch.stop();
    socket?.close();
  },
  onRestore: () => {
    if (!sealed.value) {
      reconnect.value = true;
    }
  },
});

const anchor = computed(() => {
  const value = start.value?.anchorSquare ?? null;
  return value === null ? null : { name: value.anchorUsername, href: '/' + value.topic };
});
const anchorUsername = computed(() => {
  const init = start.value;
  const username = account.value?.username ?? null;
  if (init === null || init.anchorSquare === null || username === null) {
    return '';
  }
  return init.anchorSquare.anchorUsername === username ||
    init.coAnchors.some((co) => co.username === username)
    ? username
    : '';
});
const anchorable = computed(() => anchorUsername.value.length > 0);
const smileyScopes = computed<string[]>(() => {
  if (forbidden.value) {
    return [];
  }
  if (anchor.value !== null) {
    return anchorable.value ? ['anchor', 'keke'] : ['keke'];
  }
  return [inputScopeOf(roomType.value)];
});

const anchorOwner = computed(() => {
  const init = start.value;
  const username = account.value?.username ?? null;
  if (init === null || init.anchorSquare === null || username === null) {
    return false;
  }
  return init.anchorSquare.anchorUsername === username;
});
const kermaLabel = computed(() =>
  isSquareUnlimited(minKerma.value)
    ? `Kerma ${String(kerma.value)}`
    : `Kerma ${String(kerma.value)}(${String(minKerma.value)})`,
);
const kermaClass = computed(() => {
  const min = minKerma.value;
  if (min === null || isSquareUnlimited(min)) {
    return undefined;
  }
  if (kerma.value >= min) {
    return 'SquareCssResource-kermaEnoughMenu';
  }
  return kerma.value < calcFreezeValue(min)
    ? 'SquareCssResource-kermaChatFreezeMenu'
    : 'SquareCssResource-kermaNotEnoughMenu';
});
const menuItems = computed<MenuEntry[]>(() =>
  squareMenuEntries({
    i18n,
    kerma: kermaLabel.value,
    kermaCls: kermaClass.value,
    username: account.value?.username ?? null,
    owner: anchorOwner.value,
  }),
);

const uploadEnabled = computed(() => isUploadEnabled(roomType.value, anchorable.value));

function supportForbidFromChat(): boolean {
  if (forbidFromChatUntil.value <= Date.now()) {
    return false;
  }
  return roomType.value === 'ANCHOR_SQUARE' ? anchorable.value : roomType.value === 'FREE';
}

function rowOptions(): RowOptions {
  return {
    myPublicId: start.value?.publicId ?? '',
    showColor: showColorUntil.value > Date.now(),
    locale: i18n.locale === 'zh_TW' ? 'zh-TW' : 'en',
    replyToLabel: i18n.t('replyTo'),
    forbidIcon: supportForbidFromChat(),
    emoji: { highDensity: isHighDensity() },
  };
}

function onRowForbid(publicId: string, targetNickname: string): void {
  if (publicId.length === 0 || !supportForbidFromChat()) {
    return;
  }
  if (roomType.value === 'ANCHOR_SQUARE') {
    openWatch(
      publicId,
      targetNickname,
      rgbCss(calculateColor(publicId, chatters.get(publicId)?.colorToken ?? null)),
      true,
    );
    return;
  }
  openForbidVote(publicId, targetNickname);
}

provideRowActions({ forbid: onRowForbid });

function isKekeEvent(event: ChatEvent): boolean {
  return event.eventType === 'KEKE_MESSAGE';
}

function record(event: ChatEvent): void {
  chatters.remember(event.senderPublicId, event.senderNickName, event.senderColorToken);
}

function acceptMedia(event: ChatEvent): void {
  if (shape === 'COMPACT') {
    return;
  }
  const item = mediaFlow.accept(event, {
    myPublicId: start.value?.publicId ?? '',
    locale: rowOptions().locale,
  });
  if (item === null) {
    return;
  }
  syncMedias();
}

function requestThumbnail(content: string, eventType: 'CHAT_MESSAGE' | 'KEKE_MESSAGE'): void {
  const source = ownImageUrlOfMessage(content, eventType);
  if (source === null) {
    return;
  }
  void api.storeThumbnail(source, canonical);
}

function applyClientEvent(event: ChatEvent, initial: boolean): void {
  record(event);
  if (event.eventType === 'DELETE_MEDIA') {
    if (mediaFlow.removeSourceUrl(deletedSourceUrl(event.content), event.senderPublicId)) {
      syncMedias();
    }
  } else {
    acceptMedia(event);
  }
  const options = rowOptions();
  if (watchBook.push(event, options)) {
    watches.value = watchBook.views;
  }
  if (roomType.value === 'ANCHOR_SQUARE' && isKekeEvent(event)) {
    kekePane.push(event, options);
    kekeRows.value = [...kekePane.rows];
    return;
  }
  pane.push(event, options);
  rows.value = [...pane.rows];
  if (!initial) {
    blinker.notify(event.content);
  }
}

function applyServerEvent(event: ChatEvent): void {
  switch (event.eventType) {
    case 'CHAT_MESSAGE':
    case 'KEKE_MESSAGE':
    case 'DELETE_MEDIA':
      applyClientEvent(event, false);
      return;
    case 'MODERATION_MESSAGE': {
      const payload = event.payload as ModerationMessagePayload | undefined;
      const key = payload?.key;
      if (typeof key === 'string' && key.length > 0 && isModerationState(payload?.state)) {
        moderationStates = { ...moderationStates, [key]: payload.state };
        syncMedias();
      }
      return;
    }
    case 'SYSTEM_MESSAGE': {
      const payload = (event.payload ?? {}) as SystemMessagePayload;
      if (payload.reconnect === true) {
        reconnect.value = true;
        return;
      }
      if (payload.redirect === true) {
        window.location.replace(window.location.origin);
        return;
      }
      broadcast.value = event.content;
      return;
    }
    case 'SUCK_EURO_AIR_MESSAGE': {
      const payload = event.payload as SuckEuroAirPayload | undefined;
      const sucker = payload?.sucker;
      showToast(i18n.t('suckEuroAir', sucker?.nickname ?? ''));
      return;
    }
    case 'POSTER_MESSAGE': {
      const payload = event.payload as PosterMessagePayload | undefined;
      const view = asPosterView(payload?.poster);
      if (view !== null) {
        onStickyPoster(view);
      }
      return;
    }
    case 'MIN_SQUARE_KERMA_MESSAGE': {
      const payload = event.payload as MinKermaMessagePayload | undefined;
      onMinKermaChanged(Number(payload?.minKermaValue ?? 0));
      return;
    }
    case 'BURN_MESSAGE': {
      const payload = event.payload as BurnMessagePayload | undefined;
      if (payload === undefined) {
        return;
      }
      showToast(
        i18n.t(
          'whoBurnWhom',
          payload.senderName,
          payload.targetNickname,
          String(payload.kerma ?? 0),
        ),
      );
      if (payload.targetPublicId === start.value?.publicId) {
        socket?.close();
        reconnect.value = true;
      }
      return;
    }
    case 'FORBID_MESSAGE': {
      const payload = event.payload as ForbidMessagePayload | undefined;
      const mine = start.value?.publicId ?? '';
      if (Array.isArray(payload?.publicIds) && payload.publicIds.includes(mine)) {
        forbidden.value = payload.unforbid !== true;
        return;
      }
      for (const chatter of payload?.chatters ?? []) {
        showToast(
          i18n.t(
            payload?.unforbid === true ? 'whoUnforbidWhom' : 'whoForbidWhom',
            payload?.senderName ?? '',
            chatter.nickname,
          ),
        );
      }
      return;
    }
    case 'VOTE_MESSAGE': {
      const payload = event.payload as VoteMessagePayload | undefined;
      const voting = payload?.voting;
      if (voting === undefined || voting === null) {
        return;
      }
      if (voting.state === 'CREATE') {
        voteTitleRed.value = false;
        voteEnded.value = false;
        createdVotingId.value = voting.id;
        ballotOpen.value = false;
      }
      if (voting.state === 'COMPLETE') {
        ballotOpen.value = false;
      }
      vote.value = voting;
      voteTitle.value = fullVoteTitle(voting);
      voteVisible.value = true;
      refreshVoteCountdown();
      updateVoteDecision(voting);
      return;
    }
    default:
      return;
  }
}

function updateVoteDecision(voting: api.VoteView): void {
  if (voting.id !== decisionVotingId.value || voting.state !== 'COMPLETE') {
    return;
  }
  if (voting.goal === 'FORBID') {
    forbidWaiting.value = false;
    forbidDecision.value = isQuorumReached(voting.options)
      ? 'FORBID'
      : isUnforbidQuorumReached(voting.options)
        ? 'UNFORBID'
        : 'INVALID';
    return;
  }
  if (voting.goal === 'BURN') {
    forbidWaiting.value = false;
    forbidDecision.value = isQuorumReached(voting.options) ? 'BURN' : 'INVALID';
    return;
  }
  if (voting.goal === 'MIN_KERMA') {
    minKermaWaiting.value = false;
    minKermaDecision.value = isQuorumReached(voting.options) ? 'APPLY' : 'INVALID';
    return;
  }
  if (voting.goal === 'POSTER') {
    posterVoteDecision.value = isQuorumReached(voting.options) ? 'APPLY' : 'INVALID';
  }
}

function fullVoteTitle(voting: api.VoteView): string {
  const base = translateVoteTitle(voting.title);
  if (voting.goal === 'FORBID' || voting.goal === 'BURN') {
    const target = voting.goalDetail.targetNickname;
    return target === '' ? base : base + ' ' + target;
  }
  if (voting.goal === 'MIN_KERMA') {
    return base + ' ' + String(voting.goalDetail.kerma);
  }
  if (voting.goal === 'POSTER') {
    const poster = voting.goalDetail.poster;
    const content =
      poster !== null && typeof poster === 'object' && 'content' in poster
        ? String((poster as { content: unknown }).content)
        : '';
    return abbreviate(base + ' ' + content, VOTE_POSTER_TITLE_LENGTH);
  }
  return base;
}

function translateVoteTitle(title: string): string {
  if (!title.startsWith('__i18n_')) {
    return title;
  }
  const key = title.slice('__i18n_'.length);
  return i18n.t(key as Parameters<typeof i18n.t>[0]);
}

let posterFadeTimer = 0;

function onStickyPoster(view: PosterView): void {
  if (!isNewerPoster(view, poster.value)) {
    return;
  }
  const landing = poster.value === null;
  const mode = landing ? initialDisplayMode(view.id, loadReadPoster(canonical)) : 'SMALL';
  poster.value = view;
  applyPosterMode(mode);
  if (mode !== 'ONE_LINE') {
    posterFade.value = true;
    window.clearTimeout(posterFadeTimer);
    posterFadeTimer = window.setTimeout(() => {
      posterFade.value = false;
    }, POSTER_FADE_MS);
  }
}

function applyPosterMode(mode: PosterDisplayMode): void {
  posterMode.value = mode;
  const current = poster.value;
  if (current === null) {
    return;
  }
  if (mode === 'ONE_LINE' || mode === 'HIDE') {
    saveReadPoster(canonical, current.id);
    return;
  }
  if (mode !== 'RAW') {
    saveReadPoster(canonical, null);
  }
}

async function openRecentVotes(): Promise<void> {
  recentVotesGeneration += 1;
  const generation = recentVotesGeneration;
  recentVotes.value = [];
  recentVotesLoading.value = true;
  const result = await api.loadRecentVotes(canonical);
  if (generation !== recentVotesGeneration || recentVotes.value === null) {
    return;
  }
  recentVotes.value = result.ok ? result.value.votings : [];
  recentVotesLoading.value = false;
}

function anchorErrorText(error: string): string {
  if (error === 'DUPLICATE_CO_ANCHOR') {
    return i18n.t('duplicateCoAnchorException');
  }
  if (error === 'NO_SUCH_ACCOUNT' || error === 'NO_HANDLE') {
    return i18n.t('noSuchAccountException');
  }
  return error;
}

async function addCoAnchor(username: string): Promise<void> {
  const result = await api.addCoAnchor(canonical, username);
  if (!result.ok) {
    if (result.error === 'NOT_LOGIN') {
      alert.value = i18n.t('notLoginException');
      return;
    }
    alert.value = anchorErrorText(result.error);
    return;
  }
  coAnchorList.value = result.value.coAnchors;
  coAnchorOpen.value = false;
  showToast(username + ' added');
}

async function refreshCoAnchors(): Promise<void> {
  const result = await api.loadCoAnchors(canonical);
  if (result.ok) {
    coAnchorList.value = result.value.coAnchors;
  }
}

async function openCoAnchorList(): Promise<void> {
  const result = await api.loadCoAnchors(canonical);
  if (!result.ok) {
    alert.value = isTransportFailure(result.error)
      ? i18n.transport('failStopContent')
      : anchorErrorText(result.error);
    return;
  }
  coAnchorList.value = result.value.coAnchors;
  coAnchorListOpen.value = true;
}

async function dismissAnchor(): Promise<void> {
  const result = await api.dismissAnchor(canonical);
  if (result.ok) {
    dismissOpen.value = false;
    return;
  }
  if (result.error === 'NOT_LOGIN') {
    notLoginConfirm.value = i18n.t('notLoginException');
    return;
  }
  alert.value = anchorErrorText(result.error);
}

function showToast(text: string, failure = false): void {
  toastSeq += 1;
  const id = toastSeq;
  const index = toastShown;
  toastShown += 1;
  toasts.value = [...toasts.value, { id, message: text, index, failure }];
  window.setTimeout(() => {
    toasts.value = toasts.value.filter((entry) => entry.id !== id);
    if (toasts.value.length === 0) {
      toastShown = 0;
    }
  }, TOAST_MS);
}

function runSpray(colorHex: string): void {
  void euroSpray({ colorHex, noOfCrowd: crowd.value, smokeUrl: spraySmoke });
}

function onMinKermaChanged(value: number): void {
  showToast(i18n.t('minSquareKermaChanged', String(value)));
  const previous = minKerma.value ?? 0;
  minKerma.value = value;
  notifyTier(kerma.value, previous, kerma.value, value);
}

function onKermaGrown(value: number): void {
  const previous = kerma.value;
  kerma.value = value;
  const minimum = minKerma.value ?? 0;
  notifyTier(previous, minimum, value, minimum);
}

function notifyTier(
  previousKerma: number,
  previousMin: number,
  nextKerma: number,
  nextMin: number,
): void {
  const wasEnough = previousKerma >= previousMin;
  const isEnough = nextKerma >= nextMin;
  const wasFrozen = previousKerma < calcFreezeValue(previousMin);
  const isFrozen = nextKerma < calcFreezeValue(nextMin);
  if ((wasEnough && !isEnough) || (!wasFrozen && isFrozen)) {
    reconnect.value = true;
    return;
  }
  if (!wasEnough && isEnough) {
    kermaLimit.value = { title: i18n.t('kermaUpgradeTitle'), desc: i18n.t('kermaUpgradeDesc') };
    return;
  }
  if (wasFrozen && !isFrozen) {
    kermaLimit.value = { title: i18n.t('chatUnFreezeTitle'), desc: i18n.t('chatUnFreezeDesc') };
  }
}

function makeQuota(type: ChatroomType): InputQuota {
  if (type === 'CHAT_FREEZE') {
    return new FreezeInputQuota(LIMITS.contentClient);
  }
  if (type === 'DEGRADE_FREE') {
    return new SpeedInputQuota(DEGRADE_WAIT_SECONDS);
  }
  return new CrowdOrientedInputQuota(LIMITS.contentClient);
}

function refreshVoteCountdown(): void {
  const current = vote.value;
  if (current === null) {
    voteCountdown.value = '';
    voteTitleRed.value = false;
    voteEnded.value = false;
    return;
  }
  const view = computeCountdown(current.endTime - Date.now(), voteTitleRed.value);
  voteCountdown.value = view.text;
  voteTitleRed.value = view.red;
  voteEnded.value = view.ended;
}

function serverNow(): number {
  return Date.now() + serverSkew;
}

function openWashGuard(remainMs: number): void {
  if (washSeconds.value !== '') {
    return;
  }
  let remain = Math.floor(remainMs / 1000);
  washSeconds.value = i18n.t('washGuardContent');
  window.clearInterval(washCountdownTimer);
  washCountdownTimer = window.setInterval(() => {
    remain -= 1;
    if (remain > 0) {
      washSeconds.value = String(remain);
      return;
    }
    window.clearInterval(washCountdownTimer);
    washSeconds.value = '';
  }, 1000);
}

function punishWash(): void {
  const punish = i18n.t('punishNickname');
  washPunished.value = true;
  nickname.value = punish;
  sentNickname = punish;
  saveNickname(punish);
  socket?.sendNickname(punish);
  window.clearTimeout(washPunishTimer);
  washPunishTimer = window.setTimeout(() => {
    washPunished.value = false;
  }, WASH_GUARD_PUNISH_MS);
}

function refreshQuota(): void {
  quota.giveQuota();
  const ok = quota.isEnough(message.value);
  quotaOk.value = ok;
  if (roomType.value === 'CHAT_FREEZE') {
    quotaText.value = '';
    return;
  }
  const unlimited =
    quota instanceof InfiniteInputQuota ||
    (quota instanceof CrowdOrientedInputQuota && crowd.value < CROWD_QUOTA_THRESHOLD);
  quotaText.value = unlimited ? '' : i18n.t('inputQuotaStatus', String(quota.status));
}

function setCrowd(value: number): void {
  crowd.value = value;
  if (quota instanceof CrowdOrientedInputQuota) {
    quota.onCrowdChange(value);
  }
  animateCrowd(value);
}

const CROWD_ANIMATED_STEP = 10;

function animateCrowd(target: number): void {
  window.clearInterval(crowdTimer);
  const from = displayCrowd.value;
  const increment = Math.trunc((target - from) / CROWD_ANIMATED_STEP);
  if (Math.abs(increment) < 1) {
    displayCrowd.value = target;
    return;
  }
  let countdown = CROWD_ANIMATED_STEP;
  let current = from;
  crowdTimer = window.setInterval(() => {
    countdown -= 1;
    if (countdown === 0) {
      displayCrowd.value = target;
      window.clearInterval(crowdTimer);
      return;
    }
    current += increment;
    displayCrowd.value = current;
  }, 1000 / CROWD_ANIMATED_STEP);
}

function applyErrorCode(code: string): boolean {
  if (code === 'CHAT_FREEZE') {
    alert.value = i18n.t('chatFreezed');
    return true;
  }
  if (
    code === 'SEND_TOO_FAST' ||
    code === 'WASH_GUARD' ||
    code === 'INVALID_MESSAGE' ||
    code === 'NOT_ANCHOR'
  ) {
    alert.value = i18n.t('quotaNotEnough');
    return true;
  }
  if (code === 'FORBIDDEN') {
    alert.value = i18n.t('forbidden');
    return true;
  }
  return false;
}

function onFrame(frame: ServerFrame): void {
  switch (frame.t) {
    case 'ready': {
      ready = true;
      connectIndicator.settle();
      window.clearTimeout(connectTimer);
      pane.reset();
      kekePane.reset();
      mediaFlow.reset();
      rows.value = [];
      kekeRows.value = [];
      medias.value = [];
      for (const event of frame.history) {
        applyClientEvent(event, true);
      }
      setCrowd(frame.crowd);
      return;
    }
    case 'event':
      applyServerEvent(frame.event);
      return;
    case 'crowd':
      setCrowd(frame.crowd);
      return;
    case 'error':
      if (applyErrorCode(frame.code) && !frame.fatal) {
        return;
      }
      if (frame.fatal) {
        reconnectDetail.value = 'Cause:\n' + frame.code;
        reconnect.value = true;
      }
      return;
    default:
      return;
  }
}

async function connect(): Promise<void> {
  const result = await api.startSquare({
    topic: canonical,
    anonymousId: loadAnonymousId(),
    nickname: loadNickname(),
    locale: i18n.locale,
  });
  clearLoading();
  if (!result.ok) {
    startFailedText.value = startFailureText(
      i18n.locale,
      result.error,
      i18n.transport('failStopContent'),
    );
    startFailed.value = true;
    return;
  }
  const init = result.value;
  start.value = init;
  moderationStates = init.moderation;
  uploadFields.value = { topic: canonical, permit: init.permit };
  saveAnonymousId(init.anonymousId);
  saveStartIpsHash(canonical, init.ipsHash, init.serverTime);
  if (init.sealed) {
    sealed.value = true;
    return;
  }
  nickname.value = init.nickname;
  sentNickname = init.nickname;
  kerma.value = init.kerma;
  minKerma.value = init.minKermaValue;
  roomType.value = init.chatroomType;
  forbidden.value = init.forbidden;
  showColorUntil.value = Date.now() + init.showColorDuration;
  forbidFromChatUntil.value = Date.now() + init.forbidFromChatDuration;
  const initialPoster = asPosterView(init.poster);
  if (initialPoster !== null) {
    onStickyPoster(initialPoster);
  }
  account.value = init.account;
  coAnchorList.value = init.coAnchors;
  quota = makeQuota(init.chatroomType);
  inputMaxLength.value = quota.maxLength;
  serverSkew = init.serverTime - Date.now();
  washGuard = new WashGuard(init.washGuardAllowance, Date.now());
  const remainingLock = loadWashGuardLock() - serverNow();
  if (remainingLock > 0) {
    openWashGuard(remainingLock);
  }
  blinker.setBase(place.title);
  for (const scope of smileyScopes.value) {
    const picker = smileyPicker(scope);
    if (picker.mode === 'STOCK') {
      picker.open = true;
    }
  }

  ready = false;
  connectIndicator.start();
  window.clearTimeout(connectTimer);
  connectTimer = window.setTimeout(() => {
    if (!ready) {
      connectIndicator.hide();
      reconnect.value = true;
    }
  }, CONNECT_DETECT_MS);

  socket = new SquareSocket({
    onFrame,
    onOpenFailed: () => {
      connectIndicator.hide();
      reconnect.value = true;
    },
  });
  socket.open(canonical, init.token, init.nickname);
  connectionWatch.start();

  window.setTimeout(() => {
    cleanupStartIps(Date.now());
  }, STORAGE_CLEANUP_DELAY_MS);

  grower = new GrowLoop({
    grow: async () => {
      if (growSessionTampered()) {
        return { kind: 'invalidSession' };
      }
      const grown = await api.growKerma(canonical, init.permit);
      if (grown.ok) {
        return { kind: 'grown', kerma: grown.value.kerma, serverTime: grown.value.serverTime };
      }
      return grown.status === 403 ? { kind: 'invalidSession' } : { kind: 'failed' };
    },
    isActive: () => socket !== null && socket.active,
    onKerma: onKermaGrown,
    onInvalidSession: () => {
      socket?.close();
      reconnect.value = true;
    },
  });
  grower.start();
}

function sessionIdentity(): SessionIdentity | null {
  const init = start.value;
  if (init === null) {
    return null;
  }
  return {
    logined: account.value !== null,
    myAnonymousId: init.anonymousId,
    storedAnonymousId: loadAnonymousId(),
    sessionIpsHash: init.ipsHash,
    storedIpsHash: parseStoredIpsHash(loadStartIpsHash(canonical)),
  };
}

function sessionTampered(): boolean {
  const state = sessionIdentity();
  return state !== null && isInvalidSession(state);
}

function growSessionTampered(): boolean {
  const state = sessionIdentity();
  return state !== null && isInvalidGrowSession(state);
}

function failInvalidSession(): void {
  socket?.close();
  reconnect.value = true;
}

function reload(): void {
  window.location.assign(window.location.href);
}

function onVisibility(): void {
  if (!document.hidden) {
    grower?.wake();
  }
}

function onWindowBlur(): void {
  blinker.onWindowBlurred();
}

function onWindowFocus(): void {
  blinker.onWindowFocused();
  grower?.wake();
}

function commitNickname(value: string): void {
  const best = bestNickname(value, {
    unknownLabel: i18n.t('unknownNickName'),
    ipsHash: start.value?.ipsHash ?? '',
  });
  const changed = best.nickname !== sentNickname;
  nickname.value = best.nickname;
  if (!best.generated) {
    saveNickname(best.nickname);
  }
  if (changed) {
    sentNickname = best.nickname;
    socket?.sendNickname(best.nickname);
  }
}

function send(eventType: 'CHAT_MESSAGE' | 'KEKE_MESSAGE', text: string): boolean {
  const init = start.value;
  if (init === null || text.trim().length === 0) {
    return false;
  }
  if (sessionTampered()) {
    failInvalidSession();
    return false;
  }
  if (forbidden.value) {
    return false;
  }
  const remainingLock = loadWashGuardLock() - serverNow();
  if (remainingLock > 0) {
    openWashGuard(remainingLock);
    return false;
  }
  if (roomType.value === 'CHAT_FREEZE') {
    alert.value = i18n.t('chatFreezed');
    return false;
  }
  if (!quota.isEnough(text)) {
    alert.value = i18n.t('quotaNotEnough');
    return false;
  }
  const now = Date.now();
  const content = abbreviate(text, LIMITS.contentClient);
  const replyPublicIds = mentionedPublicIds(content, chatters);
  requestThumbnail(content, eventType);
  const sent = socket?.sendMessage({
    eventType,
    senderPublicId: init.publicId,
    senderNickName: nickname.value,
    anchorUsername: anchorUsername.value,
    content,
    ...(replyPublicIds.length > 0 ? { payload: { replyPublicIds } } : {}),
  });
  if (sent !== true) {
    alert.value = i18n.t('notConnectWarn');
    return false;
  }
  quota.consume(content.length);
  if (washGuard !== null && !washGuard.check(now)) {
    saveWashGuardLock(WashGuard.lockUntil(serverNow()));
    openWashGuard(WASH_GUARD_LOCK_MS);
    punishWash();
  }
  return true;
}

function onSend(): void {
  const type =
    roomType.value === 'FREE' || roomType.value === 'ANCHOR_SQUARE'
      ? 'CHAT_MESSAGE'
      : 'KEKE_MESSAGE';
  const text =
    roomType.value === 'DEGRADE_FREE' ? message.value.slice(0, DEGRADE_MAX_LENGTH) : message.value;
  if (send(type, text)) {
    message.value = '';
  }
}

function onSendKeke(): void {
  if (send('KEKE_MESSAGE', kekeMessage.value)) {
    kekeMessage.value = '';
  }
}

const crowdPrompt = computed(() =>
  crowdPurpose.value === 'watch'
    ? i18n.t('watchPrompt')
    : crowdPurpose.value === 'forbid'
      ? i18n.t('forbidPrompt')
      : i18n.t('voteForbidPrompt'),
);

function forbidRecentVoteCreator(votingId: string, anchor?: AnchorRect): void {
  const voting = (recentVotes.value ?? []).find((row) => row.id === votingId);
  if (voting === undefined || !supportVoteForbid.value) {
    return;
  }
  openForbidVote(voting.creator.publicId, voting.creator.nickname, anchor);
}

function closeVoteCreator(): void {
  voteCreator.value = false;
  voteError.value = '';
}

function colorTokenOf(publicId: string): string | null {
  return chatters.get(publicId)?.colorToken ?? null;
}

const recentVoteRows = computed(() =>
  (recentVotes.value ?? []).map((voting) => ({
    id: voting.id,
    title: fullVoteTitle(voting),
    options: voting.options.map((option) => ({
      option: translateVoteTitle(option.option),
      count: option.count,
    })),
    voterCount: voting.voterCount,
    multipleChoice: maxChoiceCount(voting.multipleChoiceConfig, voting.options.length),
    creatorNickname: voting.creator.nickname,
    creatorColor: rgbCss(calculateColor(voting.creator.publicId, voting.creator.colorToken)),
    createTime: voting.createTime,
    chartTitle: voteChartTitle(
      voting.goal,
      translateVoteTitle(voting.title),
      fullVoteTitle(voting),
    ),
    decor: voteChartDecor(voting, colorTokenOf),
  })),
);

const voteOptions = computed(() =>
  (vote.value?.options ?? []).map((option) => ({
    option: translateVoteTitle(option.option),
    count: option.count,
  })),
);

const supportVoteForbid = computed(() => roomType.value === 'FREE');

watchEffect(() => {
  const current = vote.value;
  if (current === null) {
    votePanel.value = null;
    return;
  }
  const rows = current.options.map((option) => ({
    option: translateVoteTitle(option.option),
    count: option.count,
  }));
  const total = voteTotal(rows);
  votePanel.value = {
    statistics: voteStatistics(i18n, total, current.voterCount, ballotMaxChoice.value),
    creatorNickname: current.creator.nickname,
    creatorColor: rgbCss(calculateColor(current.creator.publicId, current.creator.colorToken)),
    createdAt: shortDateTime(current.createTime),
    optionHeader: i18n.t('votingOptionPrompt'),
    countHeader: voteCountHeader(i18n, ballotMaxChoice.value),
    rows,
    total,
    canVote:
      current.state !== 'COMPLETE' &&
      !voteEnded.value &&
      createdVotingId.value === current.id &&
      votedVotingId.value !== current.id,
    supportVoteForbid: supportVoteForbid.value,
    chartTitle: voteChartTitle(
      current.goal,
      translateVoteTitle(current.title),
      fullVoteTitle(current),
    ),
    decor: voteChartDecor(current, colorTokenOf),
    locale: i18n.locale === 'zh_TW' ? 'zh-TW' : 'en',
  };
});

function openBallot(): void {
  ballotOpen.value = true;
}

function forbidCreator(anchor?: AnchorRect): void {
  const current = vote.value;
  if (current === null || !supportVoteForbid.value) {
    return;
  }
  openForbidVote(current.creator.publicId, current.creator.nickname, anchor);
}
const ballotMaxChoice = computed(() => {
  const current = vote.value;
  return current === null
    ? 1
    : maxChoiceCount(current.multipleChoiceConfig, current.options.length);
});

async function castBallot(indexes: number[]): Promise<void> {
  const init = start.value;
  const current = vote.value;
  const dialog = ballotRef.value;
  if (init === null || current === null || dialog === null) {
    return;
  }
  if (sessionTampered()) {
    failInvalidSession();
    return;
  }
  const sentAt = Date.now();
  const options = indexes
    .map((index) => current.options[index]?.option)
    .filter((option): option is string => option !== undefined);
  const result = await api.castVote({
    topic: canonical,
    permit: init.permit,
    votingId: current.id,
    options,
  });
  if (result.ok) {
    votedVotingId.value = current.id;
    dialog.succeed(Date.now() - sentAt);
    return;
  }
  dialog.fail(voteErrorText(result.error));
}

function voteFormError(title: string, options: string[]): string | null {
  if (title.trim().length === 0) {
    return i18n.t('votingTitleIsRequired');
  }
  if (title.trim().length > VOTE_MAX_TITLE) {
    return i18n.t('votingTitleTooLong', String(VOTE_MAX_TITLE));
  }
  if (new Set(options).size !== options.length) {
    return i18n.t('votingDuplicateOptions');
  }
  if (options.length < VOTE_MIN_OPTIONS) {
    return i18n.t('votingAtLeastTwoOptions');
  }
  return null;
}

async function createVote(): Promise<void> {
  const init = start.value;
  if (init === null) {
    return;
  }
  const form = voteForm.value;
  const options = form.options.map((option) => option.trim()).filter((option) => option.length > 0);
  const invalid = voteFormError(form.title, options);
  if (invalid !== null) {
    voteError.value = invalid;
    return;
  }
  const result = await api.createVote({
    topic: canonical,
    permit: init.permit,
    goal: 'NORMAL',
    nickname: nickname.value,
    colorToken: init.colorToken,
    title: form.title,
    options,
    durationSec: form.durationSec,
    multipleChoiceConfig: form.multipleChoiceConfig,
  });
  if (result.ok) {
    voteCreator.value = false;
    voteError.value = '';
    return;
  }
  voteError.value = voteErrorText(result.error);
  voteCreatorLocked.value = true;
  window.clearTimeout(voteCreatorLockTimer);
  voteCreatorLockTimer = window.setTimeout(() => {
    voteCreatorLocked.value = false;
  }, VOTE_CREATE_LOCK_MS);
}

function onMediaMode(value: MediaMode): void {
  mediaMode.value = value;
  saveMediaFlowMode(value);
}

function onMediaRemove(index: number): void {
  const item = mediaFlow.removeAt(index);
  syncMedias();
  const init = start.value;
  if (item === null || init === null || item.mine !== true) {
    return;
  }
  socket?.sendMessage({
    eventType: 'DELETE_MEDIA',
    senderPublicId: init.publicId,
    senderNickName: nickname.value,
    anchorUsername: anchorUsername.value,
    content: deleteMediaContent(item.sourceUrl ?? item.src),
  });
}

function onMediaPoster(index: number): void {
  const item = medias.value[index];
  if (item === undefined || !isPosterableKind(item.kind) || item.gif === true) {
    return;
  }
  const next: { mediaUrl: string; posterType: PosterType } =
    item.kind === 'youtube'
      ? { mediaUrl: item.src, posterType: 'YOUTUBE' }
      : { mediaUrl: item.sourceUrl ?? item.src, posterType: 'IMAGE' };
  posterPlaceKey.value += 1;
  if (posterEditor.value?.mediaUrl === next.mediaUrl) {
    return;
  }
  posterEditor.value = next;
  posterDraft.value = loadPosterDraft(canonical);
  posterError.value = '';
  posterBusy.value = false;
}

async function submitPoster(content: string): Promise<void> {
  const init = start.value;
  const editor = posterEditor.value;
  if (init === null || editor === null) {
    return;
  }
  posterBusy.value = true;
  posterError.value = '';
  const body = {
    topic: canonical,
    permit: init.permit,
    nickname: nickname.value,
    colorToken: init.colorToken,
    posterType: editor.posterType,
    mediaUrl: editor.mediaUrl,
    content,
  };
  if (anchorable.value) {
    const result = await api.createPoster(body);
    posterBusy.value = false;
    if (!result.ok) {
      posterError.value = posterErrorText(result.error);
      return;
    }
    closePosterEditor();
    return;
  }
  const result = await api.createVote({ ...body, goal: 'POSTER' });
  posterBusy.value = false;
  if (!result.ok) {
    posterError.value = posterErrorText(result.error);
    return;
  }
  closePosterEditor();
  decisionVotingId.value = result.value.votingId;
  posterVoteDecision.value = null;
  posterVoteOpen.value = true;
}

function closePosterEditor(): void {
  savePosterDraft(canonical, null);
  posterEditor.value = null;
}

function posterErrorText(code: string): string {
  if (code === 'StoreTooLargeException') {
    return i18n.t('posterStoreTooLarge');
  }
  if (code === 'INVALID_POSTER' || code === 'StoreException') {
    return i18n.t('posterStoreFail');
  }
  if (code === 'VOTING_IN_PROGRESS') {
    return i18n.t('votingCreateFail');
  }
  return code;
}

function onPosterEnlarge(src: string): void {
  mediaPopup.value = src;
}

function onMediaEnlarge(index: number, src: string): void {
  const item = medias.value[index];
  if (item === undefined || item.kind !== 'image') {
    return;
  }
  mediaPopup.value = src.length > 0 ? src : item.src;
}

function onSmileySelect(scope: string, entry: EmojiEntry): void {
  if (scope === 'keke') {
    kekeMessage.value = `${kekeMessage.value} ${entry.symbol} `;
  } else {
    message.value = `${message.value} ${entry.symbol} `;
  }
  focusScopedMessageField(scope);
  smileyRecent.value = addRecent(smileyRecent.value, entry.name);
  saveRecentSmiley(smileyRecent.value);
  const picker = smileyPicker(scope);
  if (picker.mode === 'FLOAT_AUTO_HIDE') {
    picker.open = false;
  }
}

function onSmileyCategory(name: EmojiCategoryName): void {
  smileyCategory.value = name;
  saveSmileyCategory(name);
}

function onSmileyMode(scope: string, value: PickerMode): void {
  smileyPicker(scope).mode = value;
  saveScopedSmileyMode(scope, value);
  saveSmileyMode(value);
}

function onUploaded(url: string): void {
  uploadOpen.value = false;
  pasted.value = null;
  send('CHAT_MESSAGE', url);
}

function onPaste(event: ClipboardEvent): void {
  if (!uploadEnabled.value) {
    return;
  }
  if (washPunished.value || loadWashGuardLock() > serverNow()) {
    return;
  }
  const file = clipboardImage(event.clipboardData?.items ?? null);
  if (file === null) {
    return;
  }
  event.preventDefault();
  pasteSeq.value += 1;
  pasted.value = file;
}

async function openCrowd(purpose: 'watch' | 'voteForbid' | 'forbid'): Promise<void> {
  crowdPurpose.value = purpose;
  const view = await api.loadCrowd(canonical);
  crowdList.value = view.ok
    ? view.value.chatters.map((chatter) => ({
        publicId: chatter.publicId,
        nickname: chatter.nickname,
        color: rgbCss(calculateColor(chatter.publicId, chatter.colorToken)),
      }))
    : [];
}

function onCrowdSelect(index: number): void {
  const chosen = (crowdList.value ?? [])[index];
  if (chosen === undefined) {
    return;
  }
  crowdList.value = null;
  if (crowdPurpose.value === 'voteForbid') {
    openForbidVote(chosen.publicId, chosen.nickname);
    return;
  }
  openWatch(chosen.publicId, chosen.nickname, chosen.color, crowdPurpose.value === 'forbid');
}

function openWatch(publicId: string, watchNickname: string, color: string, forbid: boolean): void {
  watchBook.open(publicId, watchNickname, color, forbid);
  watches.value = watchBook.views;
}

function closeWatch(publicId: string): void {
  watchBook.close(publicId);
  watches.value = watchBook.views;
}

function openForbidVote(publicId: string, targetNickname: string, anchor?: AnchorRect): void {
  voteReason.value = '';
  voteError.value = '';
  forbidCondition.value = i18n.t('voteForbidOrBurnHelp');
  forbidWaiting.value = false;
  forbidCreating.value = false;
  forbidDecision.value = null;
  forbidDuration.value = 77;
  forbidTarget.value = { publicId, nickname: targetNickname, anchor: anchor ?? null };
}

async function forbidWatched(publicId: string, unforbid: boolean): Promise<void> {
  const result = await api.forbidByAnchor(canonical, publicId, nickname.value, unforbid);
  if (!result.ok) {
    alert.value = result.error;
  }
}

function voteErrorText(code: string): string {
  const key = voteErrorKey(code);
  return key === null ? code : i18n.t(key);
}

async function createSpecialVote(
  goal: 'FORBID' | 'BURN' | 'MIN_KERMA',
  detail: Record<string, unknown>,
): Promise<string | null> {
  const init = start.value;
  if (init === null) {
    return null;
  }
  const result = await api.createVote({
    topic: canonical,
    permit: init.permit,
    goal,
    nickname: nickname.value,
    colorToken: init.colorToken,
    reason: voteReason.value,
    ...detail,
  });
  if (result.ok) {
    voteError.value = '';
    return result.value.votingId;
  }
  voteError.value = voteErrorText(result.error);
  return null;
}

async function createForbidVote(goal: 'FORBID' | 'BURN'): Promise<void> {
  const target = forbidTarget.value;
  if (target === null) {
    return;
  }
  forbidCondition.value =
    goal === 'FORBID' ? i18n.t('voteForbidCondition') : i18n.t('voteBurnCondition');
  forbidCreating.value = true;
  forbidWaiting.value = false;
  forbidDecision.value = null;
  const created = await createSpecialVote(goal, {
    targetPublicId: target.publicId,
    targetNickname: target.nickname,
    durationSec: forbidDuration.value,
  });
  forbidCreating.value = false;
  if (created === null) {
    return;
  }
  forbidWaiting.value = true;
  decisionVotingId.value = created;
}

async function createMinKermaVote(): Promise<void> {
  if (voteReason.value.trim().length === 0) {
    return;
  }
  minKermaWaiting.value = true;
  minKermaDecision.value = null;
  if (minKermaLevel.value > kerma.value) {
    socket?.close();
    reconnect.value = true;
    return;
  }
  const created = await createSpecialVote('MIN_KERMA', { kerma: minKermaLevel.value });
  if (created === null) {
    minKermaWaiting.value = false;
    return;
  }
  decisionVotingId.value = created;
}

async function applyDecision(unforbid: boolean): Promise<void> {
  const init = start.value;
  const votingId = decisionVotingId.value;
  if (init === null || votingId === '') {
    return;
  }
  forbidTarget.value = null;
  minKermaOpen.value = false;
  posterVoteOpen.value = false;
  forbidDecision.value = null;
  minKermaDecision.value = null;
  posterVoteDecision.value = null;
  decisionVotingId.value = '';
  processIndicator.start();
  const result = await api.applyVote({
    topic: canonical,
    permit: init.permit,
    votingId,
    unforbid,
    nickname: nickname.value,
  });
  processIndicator.settle();
  if (!result.ok || !result.value.applied) {
    showToast(i18n.t('votingResultLost'), true);
  }
}

function onMediaVoteForbid(index: number, anchor: AnchorRect): void {
  const item = medias.value[index];
  if (item === undefined || item.senderPublicId === undefined) {
    return;
  }
  openForbidVote(item.senderPublicId, item.header.split(' @')[0] ?? '', anchor);
}

function documentRect(rect: DOMRect): AnchorRect {
  return {
    left: rect.left + window.scrollX,
    top: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
  };
}

function focusScopedMessageField(scope: string): void {
  const field = document.querySelector<HTMLTextAreaElement>(
    `[data-input-scope="${scope}"] .SquareCssResource-messageInputField`,
  );
  field?.focus();
}

async function onTool(name: ToolName, scope = 'free', rect?: DOMRect): Promise<void> {
  if (name === 'emoji') {
    const picker = smileyPicker(scope);
    picker.mode = parsePickerMode(loadScopedSmileyMode(scope) ?? loadSmileyMode());
    picker.at = rect === undefined ? null : smileyPosition({ left: rect.left, top: rect.top });
    picker.open = true;
    return;
  }
  if (name === 'upload') {
    if (rect !== undefined) {
      uploadAt.value = {
        left: Math.trunc(rect.left) - 50,
        top: Math.trunc(rect.top),
      };
    }
    uploadMounted.value = true;
    uploadOpen.value = true;
    return;
  }
  if (name === 'voteNormal') {
    voteCreator.value = true;
    return;
  }
  if (name === 'voteMinKerma') {
    if (minKermaOpen.value) {
      minKermaAnchor.value = rect === undefined ? null : documentRect(rect);
      return;
    }
    voteReason.value = '';
    voteError.value = '';
    minKermaWaiting.value = false;
    minKermaDecision.value = null;
    minKermaAnchor.value = null;
    minKermaOpen.value = true;
    return;
  }
  if (name === 'voteForbid') {
    await openCrowd('voteForbid');
    return;
  }
  if (name === 'forbid') {
    await openCrowd('forbid');
    return;
  }
  if (name === 'crowd') {
    await openCrowd('watch');
  }
}

const shop = new ShopFlow({
  confirmText: (item) => i18n.t(shopConfirmKey(item), String(shopCost(item))),
  buy,
});

async function buy(item: ShopMenuItem): Promise<void> {
  if (item === 'mirrorWorld') {
    if (!isMirrorWorldRunning()) runMirrorWorld();
    return;
  }
  const init = start.value;
  if (init === null) {
    return;
  }
  const result = await api.buyKermaItem({
    topic: canonical,
    permit: init.permit,
    item,
    nickname: nickname.value,
  });
  if (!result.ok) {
    alert.value =
      result.error === 'KERMA_NOT_ENOUGH_FOR_MIN_SQUARE'
        ? i18n.t('kermaNotEnoughForMinSquare')
        : i18n.t('kermaNotEnough');
    return;
  }
  kerma.value = result.value.kerma;
  showColorUntil.value = Date.now() + result.value.showColorDuration;
  forbidFromChatUntil.value = Date.now() + result.value.forbidFromChatDuration;
  if (item === 'euroSpray') {
    runSpray(result.value.colorHex);
    return;
  }
  if (item === 'changeColor' || item === 'forbidFromChat' || item === 'showColor') {
    window.location.assign(window.location.href);
  }
}

async function onMenu(index: number): Promise<void> {
  const id = menuItems.value[index]?.id;
  if (id === 'home') {
    window.location.assign('/');
    return;
  }
  if (id === 'login') {
    startLogin();
    return;
  }
  if (id === 'logout') {
    menuOpen.value = -1;
    logoutConfirm.value = i18n.t('logoutPrompt');
    return;
  }
  if (id === 'qanda') {
    menuOpen.value = -1;
    faqOpen.value = true;
    return;
  }
  if (id === 'manageCoAnchors') {
    menuOpen.value = -1;
    dismissOpen.value = false;
    await refreshCoAnchors();
    coAnchorOpen.value = true;
    return;
  }
  if (id === 'dismissAnchor') {
    menuOpen.value = -1;
    coAnchorOpen.value = false;
    dismissOpen.value = !dismissOpen.value;
    return;
  }
  if (id === 'votingRecents') {
    menuOpen.value = -1;
    void openRecentVotes();
    return;
  }
  if (id === 'kerma') {
    kermaPanel.value = true;
    return;
  }
  if (id === 'kermaShop') {
    menuKind.value = 'shop';
    menuEntries.value = SHOP_ITEMS.map((item) => ({ label: i18n.t(shopLabelKey(item)) }));
    menuOpen.value = index;
    return;
  }
  if (id === 'deviceShape') {
    menuKind.value = 'deviceShape';
    menuEntries.value = deviceShapeEntries(i18n, shape);
    menuOpen.value = index;
    return;
  }
  menuOpen.value = -1;
}

function onSubMenu(index: number): void {
  if (menuKind.value === 'deviceShape') {
    menuOpen.value = -1;
    const chosen = DEVICE_SHAPES[index];
    if (chosen !== undefined) {
      saveShape(chosen);
      window.location.assign(window.location.href);
    }
    return;
  }
  onShopMenu(index);
}

function onShopMenu(index: number): void {
  menuOpen.value = -1;
  const item = SHOP_ITEMS[index];
  if (item === undefined) {
    return;
  }
  const cost = shopCost(item);
  if (item === 'euroSpray') {
    if (!affordableWithMinKerma(cost)) {
      alert.value = i18n.t('kermaNotEnoughForMinSquare');
      return;
    }
  } else if (cost > kerma.value) {
    alert.value = i18n.t('kermaNotEnough');
    return;
  }
  shop.request(item);
  shopConfirm.value = shop.confirmation;
}

function affordableWithMinKerma(cost: number): boolean {
  const floor = minKerma.value;
  if (floor === null) {
    return cost <= kerma.value;
  }
  return cost <= kerma.value - floor;
}

function cancelShop(): void {
  shop.cancel();
  shopConfirm.value = '';
}

async function acceptShop(): Promise<void> {
  shopConfirm.value = '';
  await shop.accept();
}

onMounted(() => {
  void api.loadAccount().then((result) => {
    if (!result.ok) {
      return;
    }
    googleAvailable.value = result.value.google;
    devLoginAvailable.value = result.value.devLogin;
    account.value = result.value.account;
    if (result.value.account !== null && result.value.account.username === null) {
      handleOpen.value = true;
    }
  });
  void connect();
  quotaTimer = window.setInterval(refreshQuota, 1000);
  voteTimer = window.setInterval(refreshVoteCountdown, VOTE_TICK_MS);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('paste', onPaste);
  lifecycle.start();
  window.addEventListener('focus', onWindowFocus);
  window.addEventListener('blur', onWindowBlur);
});

onBeforeUnmount(() => {
  window.clearInterval(quotaTimer);
  window.clearInterval(voteTimer);
  window.clearInterval(crowdTimer);
  window.clearInterval(washCountdownTimer);
  window.clearTimeout(washPunishTimer);
  window.clearTimeout(posterFadeTimer);
  window.clearTimeout(connectTimer);
  document.removeEventListener('visibilitychange', onVisibility);
  document.removeEventListener('paste', onPaste);
  lifecycle.stop();
  window.removeEventListener('focus', onWindowFocus);
  window.removeEventListener('blur', onWindowBlur);
  grower?.stop();
  connectionWatch.stop();
  socket?.close();
  blinker.restore();
});

defineExpose({ onShopMenu });
</script>

<template>
  <div v-if="sealed" class="GlobalCssResource-zhFont">今回はここまで</div>
  <template v-else-if="start === null">
    <BlankPage />
    <AlertDialog
      v-if="startFailed"
      :content="startFailedText"
      @ok="startFailed = false"
      @cancel="startFailed = false"
    />
  </template>
  <template v-else>
    <SquarePage
      :topic="canonical"
      :host="host"
      :host-href="hostHref"
      :crowd="displayCrowd"
      :event-section-top="eventSectionTop"
      :rows="rows"
      :keke-rows="kekeRows"
      :keke-message="kekeMessage"
      :room-type="roomType"
      :quota-ok="quotaOk"
      :quota-text="quotaText"
      :max-length="inputMaxLength"
      :menu-items="menuItems"
      :menu-selected="menuOpen"
      :anchor="anchor"
      :anchorable="anchorable"
      :nickname="nickname"
      :message="message"
      :forbidden="forbidden"
      :vote-visible="voteVisible"
      :vote-title="voteTitle"
      :vote-countdown="voteCountdown"
      :vote-title-red="voteTitleRed"
      :vote-ended="voteEnded"
      :vote-chart-visible="voteChartVisible"
      :vote-panel="votePanel"
      @vote-chart-visible="voteChartVisible = $event"
      @open-ballot="openBallot"
      @forbid-creator="forbidCreator"
      :medias="medias"
      :media-mode="mediaMode"
      :nickname-disabled="washPunished"
      @media-mode="onMediaMode"
      @media-remove="onMediaRemove"
      @media-enlarge="onMediaEnlarge"
      @poster-enlarge="onPosterEnlarge"
      @media-poster="onMediaPoster"
      @media-vote-forbid="onMediaVoteForbid"
      :poster="poster"
      :poster-visible="poster !== null"
      :poster-mode="posterMode"
      :poster-fade="posterFade"
      :locale="rowOptions().locale"
      @poster-mode="applyPosterMode"
      @update:nickname="nickname = $event"
      @update:message="message = $event"
      @update:keke-message="kekeMessage = $event"
      @commit-nickname="commitNickname"
      @send="onSend"
      @send-keke="onSendKeke"
      @tool="onTool"
      @menu="onMenu"
      @co-anchors="openCoAnchorList"
      @about="aboutOpen = true"
    />
    <AboutDialog v-if="aboutOpen" @close="aboutOpen = false" />
    <FaqDialog v-if="faqOpen" @close="faqOpen = false" />
    <VoteBallotDialog
      v-if="ballotOpen && vote !== null"
      ref="ballotRef"
      :options="voteOptions.map((entry) => entry.option)"
      :max-choice="ballotMaxChoice"
      @cast="castBallot"
      @close="ballotOpen = false"
    />
    <EditPosterDialog
      v-if="posterEditor !== null"
      :media-url="posterEditor.mediaUrl"
      :poster-type="posterEditor.posterType"
      :place-key="posterPlaceKey"
      :draft="posterDraft"
      :error="posterError"
      :busy="posterBusy"
      :submit-label="anchorable ? i18n.t('createPoster') : i18n.t('createVotingForPoster')"
      @submit="submitPoster"
      @draft="savePosterDraft(canonical, $event)"
      @close="posterEditor = null"
    />
    <template v-for="scope in smileyScopes" :key="scope">
      <SmileyDialog
        v-if="smileyPickers[scope]?.open === true && smileyPickers[scope]?.mode !== 'STOCK'"
        :category="smileyCategory"
        :recent="smileyRecent"
        :mode="smileyPickers[scope]!.mode"
        v-bind="smileyPickers[scope]?.at ?? {}"
        @select="onSmileySelect(scope, $event)"
        @category="onSmileyCategory"
        @mode="onSmileyMode(scope, $event)"
        @close="smileyPicker(scope).open = false"
      />
      <Teleport
        v-if="smileyPickers[scope]?.open === true && smileyPickers[scope]?.mode === 'STOCK'"
        :to="smileyStockTarget(scope)"
      >
        <SmileyPanel
          :category="smileyCategory"
          :recent="smileyRecent"
          :mode="smileyPickers[scope]!.mode"
          @select="onSmileySelect(scope, $event)"
          @category="onSmileyCategory"
          @mode="onSmileyMode(scope, $event)"
          @close="smileyPicker(scope).open = false"
        />
      </Teleport>
    </template>
    <UploadDialog
      v-if="uploadMounted"
      v-bind="uploadAt ?? {}"
      :visible="uploadOpen"
      :fields="uploadFields"
      @success="onUploaded"
      @hide="uploadOpen = false"
    />
    <PreviewUploadDialog
      v-if="pasted !== null"
      :key="pasteSeq"
      :file="pasted"
      :fields="uploadFields"
      @success="onUploaded"
      @close="pasted = null"
    />
    <NotificationToast
      v-for="entry in toasts"
      :key="entry.id"
      :message="entry.message"
      :index="entry.index"
      :failure="entry.failure"
    />
    <RecentVotesDialog
      v-if="recentVotes !== null"
      :votings="recentVoteRows"
      :loading="recentVotesLoading"
      :support-vote-forbid="supportVoteForbid"
      :locale="i18n.locale === 'zh_TW' ? 'zh-TW' : 'en'"
      @forbid-creator="forbidRecentVoteCreator"
      @poster-enlarge="onPosterEnlarge"
      @auto-hide="recentVotes = null"
    />
    <MediaPopup v-if="mediaPopup !== null" :src="mediaPopup" @close="mediaPopup = null" />
    <MenuPopup
      v-if="menuOpen >= 0"
      :items="menuEntries"
      :index="menuOpen"
      @select="onSubMenu"
      @auto-hide="menuOpen = -1"
    />
    <SquareKermaDialog
      v-if="kermaPanel"
      :kerma="kerma"
      :min-kerma="minKerma"
      @auto-hide="kermaPanel = false"
    />
    <VoteCreatorDialog
      v-if="voteCreator"
      :locked="voteCreatorLocked"
      :error="voteError"
      :title="voteForm.title"
      :option-values="voteForm.options"
      :duration-sec="voteForm.durationSec"
      :multiple-choice-config="voteForm.multipleChoiceConfig"
      @update:title="voteForm.title = $event"
      @update:options="voteForm.options = $event"
      @update:duration-sec="voteForm.durationSec = $event"
      @update:multiple-choice-config="voteForm.multipleChoiceConfig = $event"
      @create="createVote"
      @close="closeVoteCreator()"
    />
    <CrowdSelectorDialog
      v-if="crowdList !== null"
      :caption="crowdPurpose === 'watch' ? i18n.t('crowdListTitle') : i18n.t('forbidCrowdTitle')"
      :prompt="crowdPrompt"
      :chatters="crowdList"
      :big="crowdPurpose === 'forbid'"
      @select="onCrowdSelect"
      @auto-hide="crowdList = null"
    />
    <MinKermaDialog
      v-if="minKermaOpen"
      :kerma="kerma"
      :level="minKermaLevel"
      :reason="voteReason"
      :error="voteError"
      @update:level="minKermaLevel = $event"
      @update:reason="voteReason = $event"
      :waiting="minKermaWaiting"
      :decision="minKermaDecision"
      :anchor="minKermaAnchor"
      @create="createMinKermaVote"
      @apply="applyDecision(false)"
      @close="minKermaOpen = false"
    />
    <VoteForbidDialog
      v-if="forbidTarget !== null"
      :target="forbidTarget.nickname"
      :duration-sec="forbidDuration"
      :reason="voteReason"
      :error="voteError"
      @update:duration-sec="forbidDuration = $event"
      @update:reason="voteReason = $event"
      :condition="forbidCondition"
      :waiting="forbidWaiting"
      :creating="forbidCreating"
      :decision="forbidDecision"
      :anchor="forbidTarget.anchor"
      @create-forbid="createForbidVote('FORBID')"
      @create-burn="createForbidVote('BURN')"
      @apply="applyDecision"
      @close="forbidTarget = null"
    />
    <VotePosterDialog
      v-if="posterVoteOpen"
      :decision="posterVoteDecision"
      @apply="applyDecision(false)"
      @close="posterVoteOpen = false"
    />
    <WatchPanel
      v-for="watch in watches"
      :key="watch.publicId"
      :nickname="watch.nickname"
      :color="watch.color"
      :rows="watch.rows"
      :forbid="watch.forbid"
      :caption-prefix="watch.forbid ? 'Monitor:' : i18n.t('watchCaptionDesc')"
      :help="watch.forbid ? i18n.t('forbidMonitorHelp') : i18n.t('watchContentHelp')"
      @forbid="forbidWatched(watch.publicId, false)"
      @unforbid="forbidWatched(watch.publicId, true)"
      @close="closeWatch(watch.publicId)"
    />
    <AlertDialog
      v-if="shopConfirm"
      :content="shopConfirm"
      allow-cancel
      @ok="acceptShop"
      @cancel="cancelShop"
    />
    <AlertDialog
      v-else-if="logoutConfirm"
      :content="logoutConfirm"
      allow-cancel
      @ok="acceptLogout"
      @cancel="logoutConfirm = ''"
    />
    <AlertDialog
      v-else-if="notLoginConfirm"
      :content="notLoginConfirm"
      allow-cancel
      @ok="reload"
      @cancel="notLoginConfirm = ''"
    />
    <AlertDialog v-else-if="alert" :content="alert" @ok="alert = ''" @cancel="alert = ''" />
    <ConnectionIndicator v-if="connectPhase !== 'hidden'" :connected="connectPhase === 'settled'" />
    <ProcessingIndicator v-if="processPhase !== 'hidden'" :done="processPhase === 'settled'" />
    <KermaLimitDialog
      v-if="kermaLimit !== null"
      :title="kermaLimit.title"
      :desc="kermaLimit.desc"
      @auto-hide="kermaLimit = null"
    />
    <BroadcastDialog v-if="broadcast" :message="broadcast" @close="broadcast = ''" />
    <WashGuardDialog v-if="washSeconds" :seconds="washSeconds" />
    <CoAnchorListDialog
      v-if="coAnchorListOpen"
      :co-anchors="coAnchorList"
      @auto-hide="coAnchorListOpen = false"
    />
    <CoAnchorDialog
      v-if="coAnchorOpen"
      :topic="canonical"
      :co-anchors="coAnchorList"
      @add="addCoAnchor"
      @auto-hide="coAnchorOpen = false"
    />
    <DismissAnchorDialog
      v-if="dismissOpen"
      :topic="canonical"
      @dismiss="dismissAnchor"
      @close="dismissOpen = false"
    />
    <ReconnectDialog v-if="reconnect" :detail="reconnectDetail" @reconnect="reload" />
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
</template>
