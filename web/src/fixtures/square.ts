import type { ChatRow } from './types';
import type { MediaItem } from '../components/square/MediaWidget.vue';
import type { MenuEntry } from '../gwt/types';
import { t } from '../runtime';

const SENDER = 'sender';
const SPAMMER = '對不起我剛低能洗版';
const COLOR = 'rgb(122,15,64)';
const EMOJI = '/-/emoji/pidgin/';

function replyTo(nickname: string): string {
  return `${t().t('replyTo')} @${nickname}`;
}

export function referenceRows(t1 = '下午1:50', t2 = '下午1:49', startEven = 0): ChatRow[] {
  const rows: [string, string, ChatRow['parts']][] = [
    [SPAMMER, t1, [{ kind: 'text', text: '@viewer 這是回覆你的訊息' }]],
    [
      SPAMMER,
      t1,
      [
        {
          kind: 'link',
          href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          label: [{ kind: 'text', text: 'https://www.youtube.com/w...Qw4w9WgXcQ' }],
        },
      ],
    ],
    [
      SPAMMER,
      t1,
      [
        {
          kind: 'link',
          href: 'https://www.gstatic.com/webp/gallery/1.jpg',
          label: [{ kind: 'text', text: 'https://www.gstatic.com/w...lery/1.jpg' }],
        },
      ],
    ],
    [
      SENDER,
      t2,
      [
        {
          kind: 'link',
          href: 'https://example.com/an/extremely/long/unbroken/path/that/should/not/wrap/anywhere/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          label: [{ kind: 'text', text: 'https://example.com/an/ex...aaaaaaaaaa' }],
        },
      ],
    ],
    [
      SENDER,
      t2,
      [
        { kind: 'smiley', src: EMOJI + 'SMILE.png', alt: ':)' },
        { kind: 'text', text: '  :D  ' },
        { kind: 'smiley', src: EMOJI + 'TONGUE.png', alt: ':p' },
        { kind: 'text', text: '  ' },
        { kind: 'smiley', src: EMOJI + 'SAD.png', alt: ':(' },
        { kind: 'text', text: '  ' },
        { kind: 'smiley', src: EMOJI + 'WINK.png', alt: ';)' },
      ],
    ],
    [
      SENDER,
      t2,
      [
        {
          kind: 'link',
          href: 'https://example.com/a/normal/link',
          label: [{ kind: 'text', text: 'https://example.com/a/normal/link' }],
        },
      ],
    ],
    [SENDER, t2, [{ kind: 'text', text: '第二行訊息 with mixed 中英文 content' }]],
    [SENDER, t2, [{ kind: 'text', text: 'hello square' }]],
  ];
  return rows.map(([nickname, time, parts], i) => ({
    nickname,
    color: COLOR,
    replyTo: replyTo(nickname),
    even: i % 2 === startEven,
    time,
    parts,
  }));
}

export const REFERENCE_MEDIAS: MediaItem[] = [
  {
    kind: 'youtube',
    src: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    header: `${SPAMMER} @下午1:50`,
  },
  {
    kind: 'image',
    src: 'https://www.gstatic.com/webp/gallery/1.jpg',
    header: `${SPAMMER} @下午1:50`,
    similarImage: true,
  },
];

export interface SquareMenuOptions {
  kerma: string;
  kermaCls?: string | undefined;
  slowMode?: boolean;
  username?: string | null;
  owner?: boolean;
}

export function squareMenu(options: SquareMenuOptions): MenuEntry[] {
  const i18n = t();
  const { kerma, kermaCls, slowMode = false, username = null, owner = false } = options;
  return [
    { label: 'Home' },
    ...(username
      ? [{ label: username }, { label: i18n.t('logout') }]
      : [{ label: i18n.t('login') }]),
    { label: kerma, cls: kermaCls },
    { separator: true },
    { label: i18n.t('kermaShop') },
    { separator: true },
    { label: i18n.t('votingRecents') },
    ...(owner ? [{ label: i18n.t('manageCoAnchors') }, { label: i18n.t('dismissAnchor') }] : []),
    { separator: true },
    { label: i18n.t('deviceShape') },
    { separator: true },
    ...(slowMode
      ? [{ label: i18n.t('slowMode'), cls: 'SquareCssResource-slowModeMenu' }, { separator: true }]
      : []),
    { label: 'Q & A' },
  ];
}

export function posterRows(): ChatRow[] {
  return [...referenceRows('下午2:43', '下午2:41'), ...referenceRows('下午2:37', '下午2:35')];
}

export function posterMedias(): MediaItem[] {
  return [
    {
      kind: 'youtube',
      src: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      header: `${SPAMMER} @下午2:43`,
    },
    {
      kind: 'image',
      src: 'https://www.gstatic.com/webp/gallery/1.jpg',
      header: `${SPAMMER} @下午2:43`,
      similarImage: true,
    },
    {
      kind: 'youtube',
      src: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      header: `${SPAMMER} @下午2:37`,
    },
    {
      kind: 'image',
      src: 'https://www.gstatic.com/webp/gallery/1.jpg',
      header: `${SPAMMER} @下午2:37`,
      similarImage: true,
    },
  ];
}
