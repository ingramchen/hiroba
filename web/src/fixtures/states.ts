import type { DeviceShape } from '../runtime';
import type { OverlaySpec } from '../dev/overlays';
import type { MenuEntry } from '../gwt/types';
import { DEGRADE_MAX_LENGTH } from '@hiroba/shared';
import { t } from '../runtime';
import { EMPTY_HOT, POPULATED_HOT } from './home';
import { REFERENCE_MEDIAS, posterMedias, posterRows, referenceRows, squareMenu } from './square';
import {
  ANCHOR,
  ANCHOR_KEKE_ROWS,
  LATER_KEKE_ROWS,
  REPLY_TO_ME_KEKE_ROWS,
  WASH_KEKE_ROWS,
} from './anchor';

export interface StateDef {
  page: 'home' | 'square' | 'sys' | 'loading' | 'blank';
  shape: DeviceShape;
  viewportMeta?: boolean;
  props?: Record<string, unknown>;
  overlays?: OverlaySpec[];
  overlaysFirst?: boolean;
  pageClass?: 'home' | 'square' | 'sys';
}

type RoomType = 'FREE' | 'DEGRADE_FREE' | 'CHAT_FREEZE';

const KERMA: Record<RoomType, { label: string; cls?: string }> = {
  FREE: { label: 'Kerma 200' },
  DEGRADE_FREE: { label: 'Kerma 1(40)', cls: 'SquareCssResource-kermaNotEnoughMenu' },
  CHAT_FREEZE: { label: 'Kerma 0(40)', cls: 'SquareCssResource-kermaChatFreezeMenu' },
};

const QUOTA: Record<RoomType, { ok: boolean; text: string }> = {
  FREE: { ok: true, text: '' },
  DEGRADE_FREE: { ok: false, text: '發言權: 4' },
  CHAT_FREEZE: { ok: false, text: '' },
};

function square(room: RoomType, shape: DeviceShape, top: boolean): StateDef {
  const kerma = KERMA[room];
  return {
    page: 'square',
    shape,
    props: {
      rows: referenceRows(),
      medias: shape === 'COMPACT' ? [] : REFERENCE_MEDIAS,
      roomType: room,
      ...(room === 'DEGRADE_FREE' ? { maxLength: DEGRADE_MAX_LENGTH } : {}),
      quotaOk: QUOTA[room].ok,
      quotaText: QUOTA[room].text,
      menuItems: squareMenu({ kerma: kerma.label, kermaCls: kerma.cls }),
      eventSectionTop: top,
    },
  };
}

const home = (props: Record<string, unknown>, shape: DeviceShape = 'RESPONSIVE'): StateDef => ({
  page: 'home',
  shape,
  viewportMeta: false,
  props: { ...props },
});

export const STATES: Record<string, StateDef> = {
  '01-loading-home-desktop': { page: 'loading', shape: 'RESPONSIVE', viewportMeta: false },
  '01-loading-home-mobile': { page: 'loading', shape: 'RESPONSIVE', viewportMeta: false },
  '01-loading-square-desktop': { page: 'loading', shape: 'RESPONSIVE', viewportMeta: false },
  '01-loading-square-mobile': { page: 'loading', shape: 'RESPONSIVE', viewportMeta: false },

  '02-home-loggedout-desktop': home({ hot: EMPTY_HOT }),
  '02-home-loggedout-mobile': home({ hot: EMPTY_HOT }),
  '02-home-createsquare-filled': home({ hot: EMPTY_HOT, freeTopic: 'a filled topic' }),
  '09-home-populated-desktop': home({ hot: POPULATED_HOT }),
  '09-home-populated-mobile': home({ hot: POPULATED_HOT }),
  '08-locale-zh-TW-home': home({ hot: POPULATED_HOT }),
  '08-locale-en-US-home': home({ hot: POPULATED_HOT }),

  '08-dpr1-square': square('FREE', 'DESKTOP', false),
  '08-dpr2-square': square('FREE', 'DESKTOP', false),
  '08-locale-zh-TW-square': square('FREE', 'DESKTOP', false),
  '08-locale-en-US-square': square('FREE', 'DESKTOP', false),
  '05-inputarea-idle': square('FREE', 'DESKTOP', false),
  '05-inputarea-typed': square('FREE', 'DESKTOP', false),
};

for (const room of ['FREE', 'DEGRADE_FREE', 'CHAT_FREEZE'] as RoomType[]) {
  for (const shape of ['RESPONSIVE', 'DESKTOP', 'COMPACT'] as DeviceShape[]) {
    for (const viewport of ['desktop', 'mobile']) {
      const top = shape === 'COMPACT' || (shape === 'RESPONSIVE' && viewport === 'mobile');
      STATES[`03-square-${room}-${shape}-${viewport}`] = square(room, shape, top);
    }
  }
}

for (const width of [1280, 1160, 900, 820, 767, 650, 435, 390]) {
  STATES[`04-breakpoint-responsive-${width}`] = square('FREE', 'RESPONSIVE', width <= 767);
}

const anchorSquare = (
  username: string | null,
  anchorable: boolean,
  owner: boolean,
  keke: () => ReturnType<typeof referenceRows>,
  crowd = 1,
): StateDef => ({
  page: 'square',
  shape: 'DESKTOP',
  props: {
    topic: 'anchortopic',
    crowd,
    roomType: 'ANCHOR_SQUARE',
    anchor: ANCHOR,
    anchorable,
    kekeRows: keke(),
    rows: [],
    medias: [],
    menuItems: squareMenu({ kerma: 'Kerma 200', username, owner }),
  },
});

STATES['01-square-slowmode'] = {
  page: 'square',
  shape: 'DESKTOP',
  props: {
    topic: 'slowmodetopic',
    rows: [],
    medias: [],
    menuItems: squareMenu({ kerma: 'Kerma 0', slowMode: true }),
  },
};
STATES['10-anchor-square'] = anchorSquare('probeuser', true, true, ANCHOR_KEKE_ROWS);
STATES['10-coanchor-square'] = anchorSquare('coanchoruser', true, false, ANCHOR_KEKE_ROWS);
STATES['10-login-member-square'] = anchorSquare('memberuser', false, false, ANCHOR_KEKE_ROWS);
STATES['10-replytome'] = anchorSquare(null, false, false, REPLY_TO_ME_KEKE_ROWS, 2);

const SHOP_ITEMS = (): MenuEntry[] => {
  const i18n = t();
  return [
    { label: i18n.t('consumeToChangeColor') },
    { label: i18n.t('consumeToForbidFromChat') },
    { label: '鏡中世界' },
    { label: '鑑定 Lv1' },
    { label: '變歐噴霧' },
  ];
};

const SHAPE_ITEMS = (): MenuEntry[] => [
  { label: '自動縮放 (適用桌機/手機)' },
  { label: '桌機模式', cls: 'SquareCssResource-deviceShapeSelected' },
  { label: '精簡模式 (省電省流量)' },
];

function squareWith(overlays: OverlaySpec[]): StateDef {
  const s = square('FREE', 'DESKTOP', false);
  return { ...s, overlays };
}

STATES['01-square-rpc-failure'] = {
  page: 'blank',
  shape: 'DESKTOP',
  overlays: [{ kind: 'alert', props: { content: '0' } }],
};
STATES['02-home-logindialog'] = {
  ...home({ hot: EMPTY_HOT }),
  overlays: [
    { kind: 'login' },
    {
      kind: 'alert',
      props: { content: '500  The call failed on the server; see server log for details' },
    },
  ],
};
STATES['02-home-logindialog-live'] = {
  ...home({ hot: EMPTY_HOT }),
  overlays: [{ kind: 'loginLive', props: { google: false, availability: 'ok' } }],
};
STATES['05-statusmenu-1-登入'] = squareWith([
  { kind: 'login' },
  {
    kind: 'alert',
    props: { content: '500  The call failed on the server; see server log for details' },
  },
]);
STATES['05-statusmenu-2-Kerma-200'] = squareWith([
  { kind: 'login' },
  { kind: 'kerma', props: { kerma: 200 } },
]);
STATES['05-statusmenu-3-商店'] = squareWith([
  { kind: 'menu', props: { items: SHOP_ITEMS(), index: 3 } },
]);
STATES['05-kermashop-open'] = STATES['05-statusmenu-3-商店'];
STATES['05-statusmenu-4-歷届投票'] = squareWith([{ kind: 'recentVotes' }]);
STATES['05-statusmenu-5-網站樣式'] = squareWith([
  { kind: 'menu', props: { items: SHAPE_ITEMS(), index: 5 } },
]);
for (const [id, content] of [
  ['05-kermashop-0-變更暱稱顏色', '消費 1 Kerma 隨機改變暱稱顏色 ？'],
  ['05-kermashop-1-暱稱旁顯示鎖人', '消費 1 Kerma 在暱稱旁顯示鎖人？(有效時間 30 分)'],
  ['05-kermashop-2-鏡中世界', '消費 0 Kerma 進入鏡中世界 ?'],
  ['05-kermashop-3-鑑定-Lv1', '消費 1 Kerma 發動 - 鑑定 Lv1 ？(有效時間 30 分)'],
  ['05-kermashop-4-變歐噴霧', '消費 5 Kerma 使用變歐噴霧？'],
] as const) {
  STATES[id] = squareWith([{ kind: 'alert', props: { content, allowCancel: true } }]);
}

const SYS_SQUARES = [{ topic: 'slowmodetopic' }, { topic: 'reference' }];

STATES['07-sys-gate'] = {
  page: 'blank',
  pageClass: 'sys',
  shape: 'RESPONSIVE',
  viewportMeta: false,
  overlays: [{ kind: 'sysGate' }],
};
STATES['07-sys-tab-default'] = {
  page: 'sys',
  shape: 'RESPONSIVE',
  viewportMeta: false,
  props: { tab: 0 },
};
STATES['07-sys-tab-0-Broadcast'] = STATES['07-sys-tab-default'];
STATES['07-sys-tab-1-Manage-Squares'] = {
  page: 'sys',
  shape: 'RESPONSIVE',
  viewportMeta: false,
  props: { tab: 1, squares: SYS_SQUARES },
  overlays: [{ kind: 'toast', props: { message: 'reloaded topics: 2', left: 1089, top: 30 } }],
};

const VIEWER_CHATTER = [{ nickname: 'viewer', color: 'rgb(148,41,102)' }];

STATES['05-inputtool-tool0'] = squareWith([{ kind: 'smiley' }]);
STATES['05-inputtool-tool1'] = squareWith([
  {
    kind: 'crowd',
    props: {
      caption: '線上使用者',
      prompt: '點擊使用者可以訂閱他的訊息喔',
      left: 330,
      top: 146,
      chatters: VIEWER_CHATTER,
    },
  },
]);
STATES['05-inputtool-tool2'] = squareWith([{ kind: 'upload', props: { left: 228, top: 97 } }]);
STATES['05-inputtool-tool3'] = squareWith([{ kind: 'voteCreator' }]);
STATES['05-inputtool-tool4'] = squareWith([
  {
    kind: 'crowd',
    props: {
      caption: '封鎖使用者',
      prompt: '點擊使用者進行投票封鎖,解鎖或火刑',
      left: 330,
      top: 146,
      chatters: VIEWER_CHATTER,
    },
  },
]);
STATES['05-inputtool-tool5'] = squareWith([{ kind: 'minKerma' }]);
STATES['06-vote-dialog-empty'] = squareWith([{ kind: 'voteCreator' }]);
STATES['06-vote-dialog-filled'] = squareWith([{ kind: 'voteCreator' }]);
STATES['11-washguard'] = {
  ...anchorSquare(null, false, false, WASH_KEKE_ROWS),
  overlays: [{ kind: 'washGuard', props: { seconds: '114' } }],
  overlaysFirst: true,
};
STATES['12-broadcast'] = {
  ...anchorSquare(null, false, false, WASH_KEKE_ROWS),
  overlays: [
    { kind: 'broadcast', props: { message: '這是一則系統廣播測試訊息 / broadcast test' } },
  ],
};
STATES['11-reconnect'] = {
  ...anchorSquare(null, false, false, WASH_KEKE_ROWS),
  overlays: [{ kind: 'reconnect' }],
};
STATES['14-upload-dialog'] = {
  ...anchorSquare('probeuser', true, true, LATER_KEKE_ROWS),
  overlays: [{ kind: 'upload' }],
};
STATES['14-upload-preview'] = STATES['14-upload-dialog'];
STATES['10-anchor-menu-coanchor'] = {
  ...anchorSquare('probeuser', true, true, ANCHOR_KEKE_ROWS),
  overlays: [
    {
      kind: 'coAnchor',
      props: {
        topic: 'anchortopic',
        coAnchors: [{ username: 'coanchoruser', accountDomain: 'GOOGLE' }],
      },
    },
  ],
};
STATES['10-anchor-menu-dismiss'] = {
  ...anchorSquare('probeuser', true, true, ANCHOR_KEKE_ROWS),
  overlays: [
    {
      kind: 'alert',
      props: {
        content: '系統無此帳號。請注意該帳號的用戶必須先登入過 kekeke.cc 一次，才能加入共同主播。',
      },
    },
    { kind: 'dismissAnchor', props: { topic: 'anchortopic' } },
  ],
};

STATES['13-vote-active'] = {
  ...anchorSquare('probeuser', true, true, LATER_KEKE_ROWS),
  overlays: [{ kind: 'voteCreator', props: { error: '* 投票主題不能空白' } }],
};

STATES['14-poster-edit'] = {
  page: 'square',
  shape: 'DESKTOP',
  props: {
    topic: 'postertopic',
    rows: posterRows(),
    medias: posterMedias(),
    menuItems: squareMenu({ kerma: 'Kerma 200' }),
  },
  overlays: [{ kind: 'editPoster' }],
};
