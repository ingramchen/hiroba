import { KERMA_COST, type KermaShopItem } from '@hiroba/shared';
import type { MessageKey } from '../i18n';

export type ShopMenuItem = KermaShopItem | 'mirrorWorld';

export const SHOP_ITEMS: readonly ShopMenuItem[] = [
  'changeColor',
  'forbidFromChat',
  'mirrorWorld',
  'showColor',
  'euroSpray',
];

const CONFIRM_KEY: Record<ShopMenuItem, MessageKey> = {
  changeColor: 'confirmChanageColor',
  forbidFromChat: 'confirmForbidFromChat',
  mirrorWorld: 'startMirrorWorld',
  showColor: 'confirmShowColor',
  euroSpray: 'confirmEuroSpray',
};

const LABEL_KEY: Record<ShopMenuItem, MessageKey> = {
  changeColor: 'consumeToChangeColor',
  forbidFromChat: 'consumeToForbidFromChat',
  mirrorWorld: 'foolMirrorWorld',
  showColor: 'consumeToShowColor',
  euroSpray: 'consumeToEuroSpray',
};

const EXTRA_COST: Record<'mirrorWorld', number> = { mirrorWorld: 0 };

export function shopConfirmKey(item: ShopMenuItem): MessageKey {
  return CONFIRM_KEY[item];
}

export function shopLabelKey(item: ShopMenuItem): MessageKey {
  return LABEL_KEY[item];
}

export function shopCost(item: ShopMenuItem): number {
  return item === 'mirrorWorld' ? EXTRA_COST.mirrorWorld : KERMA_COST[item];
}

export interface ShopFlowOptions {
  confirmText: (item: ShopMenuItem) => string;
  buy: (item: ShopMenuItem) => Promise<void>;
}

export class ShopFlow {
  private item: ShopMenuItem | null = null;
  private text = '';

  constructor(private readonly options: ShopFlowOptions) {}

  get pending(): ShopMenuItem | null {
    return this.item;
  }

  get confirmation(): string {
    return this.text;
  }

  request(item: ShopMenuItem): void {
    this.item = item;
    this.text = this.options.confirmText(item);
  }

  cancel(): void {
    this.item = null;
    this.text = '';
  }

  async accept(): Promise<void> {
    const item = this.item;
    this.cancel();
    if (item === null) {
      return;
    }
    await this.options.buy(item);
  }
}
