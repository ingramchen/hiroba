import type { ChatRow } from './types';
import { t } from '../runtime';

const SENDER = { name: 'sender', color: 'rgb(122,15,64)' };
const VIEWER = { name: 'viewer', color: 'rgb(148,41,102)' };

type Line = [who: 'sender' | 'viewer', time: string, text: string, replyToMe?: boolean];

const ANCHOR_LINES: Line[] = [
  ['sender', '下午2:47', 'hello from the anchor square'],
  ['sender', '下午2:47', '@viewer 這是回覆你的訊息'],
  ['sender', '下午2:47', '科科科 anchor room'],
  ['sender', '下午2:40', 'hello from the anchor square'],
  ['sender', '下午2:40', '@viewer 這是回覆你的訊息'],
  ['sender', '下午2:40', '科科科 anchor room'],
  ['sender', '下午2:34', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  ['sender', '下午2:33', 'https://www.gstatic.com/webp/gallery/1.jpg'],
  ['sender', '下午2:31', 'https://www.gstatic.com/webp/gallery/1.jpg'],
  ['sender', '下午2:28', 'https://www.gstatic.com/webp/gallery/2.jpg'],
  ['sender', '下午2:23', '@viewer 這是即時回覆你的訊息'],
  ['viewer', '下午2:23', 'viewer 先發一句話讓大家記得我'],
  ['sender', '下午2:22', '@viewer 這是即時回覆你的訊息'],
  ['sender', '下午2:20', 'hello from the anchor square'],
  ['sender', '下午2:20', '@viewer 這是回覆你的訊息'],
  ['sender', '下午2:20', '科科科 anchor room'],
];

const REPLY_LINES: Line[] = [
  ['sender', '下午2:48', '@viewer 這是即時回覆你的訊息', true],
  ['viewer', '下午2:48', 'viewer 先發一句話讓大家記得我'],
  ['sender', '下午2:47', 'hello from the anchor square'],
  ['sender', '下午2:47', '@viewer 這是回覆你的訊息', true],
  ['sender', '下午2:47', '科科科 anchor room'],
  ['sender', '下午2:40', 'hello from the anchor square'],
  ['sender', '下午2:40', '@viewer 這是回覆你的訊息', true],
  ['sender', '下午2:40', '科科科 anchor room'],
  ['sender', '下午2:34', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  ['sender', '下午2:33', 'https://www.gstatic.com/webp/gallery/1.jpg'],
  ['sender', '下午2:31', 'https://www.gstatic.com/webp/gallery/1.jpg'],
  ['sender', '下午2:28', 'https://www.gstatic.com/webp/gallery/2.jpg'],
  ['sender', '下午2:23', '@viewer 這是即時回覆你的訊息', true],
  ['viewer', '下午2:23', 'viewer 先發一句話讓大家記得我'],
  ['sender', '下午2:22', '@viewer 這是即時回覆你的訊息'],
  ['sender', '下午2:20', 'hello from the anchor square'],
  ['sender', '下午2:20', '@viewer 這是回覆你的訊息'],
  ['sender', '下午2:20', '科科科 anchor room'],
];

const LATER_LINES: Line[] = ANCHOR_LINES.slice(3);

const WASH_LINES: Line[] = LATER_LINES.map((l, i) =>
  i === 1 || i === 7 ? ([l[0], l[1], l[2], true] as Line) : l,
);

function toRows(lines: Line[], startEven = 0): ChatRow[] {
  return lines.map(([who, time, text, replyToMe], i) => {
    const person = who === 'viewer' ? VIEWER : SENDER;
    const row: ChatRow = {
      nickname: person.name,
      color: person.color,
      replyTo: `${t().t('replyTo')} @${person.name}`,
      even: i % 2 === startEven,
      time,
      parts: [{ kind: 'text', text }],
    };
    if (replyToMe) row.replyToMe = true;
    return row;
  });
}

export const ANCHOR_KEKE_ROWS = (): ChatRow[] => toRows(ANCHOR_LINES);
export const REPLY_TO_ME_KEKE_ROWS = (): ChatRow[] => toRows(REPLY_LINES);
export const LATER_KEKE_ROWS = (): ChatRow[] => toRows(LATER_LINES, 1);
export const WASH_KEKE_ROWS = (): ChatRow[] => toRows(WASH_LINES, 1);

export const ANCHOR = { name: 'probeuser', href: 'https://twitter.com/probeuser' };
