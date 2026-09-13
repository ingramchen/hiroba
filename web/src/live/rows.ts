import { LIMITS, calculateColor, rgbCss, rgbHex, type MessageEvent } from '@hiroba/shared';
import type { ChatRow } from '../fixtures/types';
import { renderMessageContent } from '../media/message';
import type { EmojiRenderOptions } from '../emoji/decorator';

export interface Chatter {
  nickname: string;
  colorToken: string | null;
}

export class RecentChatters {
  private readonly byPublicId = new Map<string, Chatter>();
  private readonly byNickname = new Map<string, string>();

  remember(publicId: string, nickname: string, colorToken: string | null): void {
    if (publicId.length === 0) {
      return;
    }
    this.byPublicId.set(publicId, { nickname, colorToken });
    this.byNickname.set(nickname, publicId);
  }

  get(publicId: string): Chatter | undefined {
    return this.byPublicId.get(publicId);
  }

  publicIdOf(nickname: string): string | null {
    return this.byNickname.get(nickname) ?? null;
  }

  list(): { publicId: string; nickname: string; colorToken: string | null }[] {
    return [...this.byPublicId].map(([publicId, chatter]) => ({ publicId, ...chatter }));
  }
}

export function mentionedPublicIds(content: string, chatters: RecentChatters): string[] {
  const found: string[] = [];
  let from = 0;
  for (let scanned = 0; scanned < LIMITS.replyPublicIdsClient; scanned += 1) {
    const at = content.indexOf('@', from);
    if (at === -1) {
      break;
    }
    const start = at + 1;
    const space = content.indexOf(' ', start);
    const end = space === -1 ? content.length : space;
    const publicId = chatters.publicIdOf(content.slice(start, end));
    if (publicId !== null) {
      found.push(publicId);
    }
    from = end;
  }
  return found;
}

export function formatTime(date: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(date),
  );
}

export interface RowOptions {
  myPublicId: string;
  showColor: boolean;
  locale: string;
  replyToLabel: string;
  forbidIcon?: boolean;
  emoji?: EmojiRenderOptions;
}

export function toChatRow(event: MessageEvent, seq: number, options: RowOptions): ChatRow {
  const rgb = calculateColor(event.senderPublicId, event.senderColorToken);
  const replyIds = event.payload?.replyPublicIds ?? [];
  const row: ChatRow = {
    nickname: event.senderNickName,
    color: rgbCss(rgb),
    replyTo: `${options.replyToLabel} @${event.senderNickName}`,
    even: seq % 2 === 1,
    time: formatTime(event.date, options.locale),
    parts: renderMessageContent(event.content, event.eventType, options.emoji ?? {}),
  };
  if (replyIds.includes(options.myPublicId)) {
    row.replyToMe = true;
  }
  if (event.anchorUsername.length > 0) {
    row.anchor = true;
  }
  if (options.showColor) {
    row.showColor = '#' + rgbHex(rgb);
  }
  if (options.forbidIcon === true) {
    row.forbidIcon = true;
    row.senderPublicId = event.senderPublicId;
  }
  return row;
}

export class ChatPane {
  private seq = 0;
  readonly rows: ChatRow[] = [];

  constructor(private readonly maxRows: number = LIMITS.chatPaneRows) {}

  reset(): void {
    this.seq = 0;
    this.rows.length = 0;
  }

  push(event: MessageEvent, options: RowOptions): ChatRow {
    const row = toChatRow(event, this.seq, options);
    this.seq += 1;
    this.rows.unshift(row);
    if (this.rows.length > this.maxRows) {
      this.rows.length = this.maxRows;
    }
    return row;
  }
}
