import type { MessageEvent } from '@hiroba/shared';
import type { ChatRow } from '../fixtures/types';
import { ChatPane, type RowOptions } from './rows';

export interface WatchView {
  publicId: string;
  nickname: string;
  color: string;
  forbid: boolean;
  rows: ChatRow[];
}

interface WatchState {
  publicId: string;
  nickname: string;
  color: string;
  forbid: boolean;
  pane: ChatPane;
}

export class WatchBook {
  private readonly watches: WatchState[] = [];

  constructor(private readonly maxMessages: number) {}

  open(publicId: string, nickname: string, color: string, forbid: boolean): void {
    const found = this.watches.find((watch) => watch.publicId === publicId);
    if (found !== undefined) {
      found.nickname = nickname;
      found.color = color;
      found.forbid = forbid;
      return;
    }
    this.watches.push({
      publicId,
      nickname,
      color,
      forbid,
      pane: new ChatPane(this.maxMessages),
    });
  }

  close(publicId: string): void {
    const at = this.watches.findIndex((watch) => watch.publicId === publicId);
    if (at !== -1) {
      this.watches.splice(at, 1);
    }
  }

  clear(): void {
    this.watches.length = 0;
  }

  has(publicId: string): boolean {
    return this.watches.some((watch) => watch.publicId === publicId);
  }

  push(event: MessageEvent, options: RowOptions): boolean {
    const watch = this.watches.find((entry) => entry.publicId === event.senderPublicId);
    if (watch === undefined) {
      return false;
    }
    watch.nickname = event.senderNickName;
    watch.pane.push(event, options);
    return true;
  }

  get views(): WatchView[] {
    return this.watches.map((watch) => ({
      publicId: watch.publicId,
      nickname: watch.nickname,
      color: watch.color,
      forbid: watch.forbid,
      rows: [...watch.pane.rows],
    }));
  }
}
