import {
  KERMA_COST,
  SHOP_DURATION_MS,
  clampKerma,
  increaseKerma,
  type KermaShopItem,
  type TimeKerma,
} from '@hiroba/shared';
import { eq, inArray } from 'drizzle-orm';
import { SELECT_BATCH, type Database } from '../db/client.js';
import { account, anonymous } from '../db/schema.js';
import { accountPrivateId, anonymousPrivateId, newAnonymousId, newColorToken } from './identity.js';

export interface ChatterState {
  privateId: string;
  kermaValue: number;
  kermaLastUpdateTime: number;
  kermaForbidForever: boolean;
  colorToken: string | null;
  createTime: number;
  forbidFromChatUntil: number;
  showColorUntil: number;
}

export type ChatterKind = 'ANONYMOUS' | 'ACCOUNT';

function kindOf(privateId: string): ChatterKind {
  return privateId.startsWith('ACCOUNT_') ? 'ACCOUNT' : 'ANONYMOUS';
}

function idOf(privateId: string): string {
  const separator = privateId.indexOf('_');
  return privateId.slice(separator + 1);
}

interface KermaRow {
  kermaValue: number;
  kermaLastUpdateTime: Date;
  kermaForbidForever: boolean;
  colorToken: string | null;
  createTime: Date;
  forbidFromChatUntil: Date;
  showColorUntil: Date;
}

function stateOf(privateId: string, row: KermaRow): ChatterState {
  return {
    privateId,
    kermaValue: row.kermaValue,
    kermaLastUpdateTime: row.kermaLastUpdateTime.getTime(),
    kermaForbidForever: row.kermaForbidForever,
    colorToken: row.colorToken,
    createTime: row.createTime.getTime(),
    forbidFromChatUntil: row.forbidFromChatUntil.getTime(),
    showColorUntil: row.showColorUntil.getTime(),
  };
}

function anonymousState(row: KermaRow & { anonymousId: string }): ChatterState {
  return stateOf(anonymousPrivateId(row.anonymousId), row);
}

function accountState(row: KermaRow & { accountUuid: string }): ChatterState {
  return stateOf(accountPrivateId(row.accountUuid), row);
}

export class ChatterRepository {
  constructor(private readonly db: Database) {}

  startAnonymous(anonymousId: string | undefined, now: number): ChatterState {
    if (anonymousId !== undefined && anonymousId.length > 0) {
      const found = this.loadAnonymous(anonymousId);
      if (found !== null) {
        return found;
      }
    }
    const created = {
      anonymousId: newAnonymousId(),
      kermaValue: 0,
      kermaLastUpdateTime: new Date(now),
      kermaForbidForever: false,
      colorToken: null,
      createTime: new Date(now),
      forbidFromChatUntil: new Date(now),
      showColorUntil: new Date(now),
    };
    this.db.insert(anonymous).values(created).run();
    return anonymousState(created);
  }

  loadAll(privateIds: readonly string[]): Map<string, ChatterState> {
    const found = new Map<string, ChatterState>();
    const anonymousIds: string[] = [];
    const accountUuids: string[] = [];
    for (const privateId of privateIds) {
      (kindOf(privateId) === 'ACCOUNT' ? accountUuids : anonymousIds).push(idOf(privateId));
    }
    for (let at = 0; at < anonymousIds.length; at += SELECT_BATCH) {
      const rows = this.db
        .select()
        .from(anonymous)
        .where(inArray(anonymous.anonymousId, anonymousIds.slice(at, at + SELECT_BATCH)))
        .all();
      for (const row of rows) {
        const state = anonymousState(row);
        found.set(state.privateId, state);
      }
    }
    for (let at = 0; at < accountUuids.length; at += SELECT_BATCH) {
      const rows = this.db
        .select()
        .from(account)
        .where(inArray(account.accountUuid, accountUuids.slice(at, at + SELECT_BATCH)))
        .all();
      for (const row of rows) {
        const state = accountState(row);
        found.set(state.privateId, state);
      }
    }
    return found;
  }

  load(privateId: string): ChatterState | null {
    return kindOf(privateId) === 'ACCOUNT'
      ? this.loadAccount(idOf(privateId))
      : this.loadAnonymous(idOf(privateId));
  }

  private loadAnonymous(anonymousId: string): ChatterState | null {
    const row = this.db
      .select()
      .from(anonymous)
      .where(eq(anonymous.anonymousId, anonymousId))
      .get();
    return row === undefined ? null : anonymousState(row);
  }

  private loadAccount(accountUuid: string): ChatterState | null {
    const row = this.db.select().from(account).where(eq(account.accountUuid, accountUuid)).get();
    return row === undefined ? null : accountState(row);
  }

  private patch(privateId: string, values: Record<string, unknown>): void {
    if (kindOf(privateId) === 'ACCOUNT') {
      this.db
        .update(account)
        .set(values)
        .where(eq(account.accountUuid, idOf(privateId)))
        .run();
      return;
    }
    this.db
      .update(anonymous)
      .set(values)
      .where(eq(anonymous.anonymousId, idOf(privateId)))
      .run();
  }

  setForbidForever(privateId: string, forbid: boolean): ChatterState | null {
    const state = this.load(privateId);
    if (state === null) {
      return null;
    }
    this.patch(privateId, { kermaForbidForever: forbid });
    return { ...state, kermaForbidForever: forbid };
  }

  timeKerma(state: ChatterState): TimeKerma {
    return { value: state.kermaValue, lastUpdateTime: state.kermaLastUpdateTime };
  }

  grow(privateId: string, now: number): ChatterState | null {
    const state = this.load(privateId);
    if (state === null || state.kermaForbidForever) {
      return state;
    }
    const grown = increaseKerma(this.timeKerma(state), now);
    if (grown.value === state.kermaValue) {
      return state;
    }
    this.patch(privateId, {
      kermaValue: grown.value,
      kermaLastUpdateTime: new Date(grown.lastUpdateTime),
    });
    return { ...state, kermaValue: grown.value, kermaLastUpdateTime: grown.lastUpdateTime };
  }

  punish(privateId: string, amount: number): void {
    const state = this.load(privateId);
    if (state === null) {
      return;
    }
    this.patch(privateId, { kermaValue: clampKerma(state.kermaValue - amount) });
  }

  punishBoth(id: string, amount: number): void {
    this.punish(anonymousPrivateId(id), amount);
    this.punish(accountPrivateId(id), amount);
  }

  buy(privateId: string, item: KermaShopItem, now: number, minSquareKerma: number): ChatterState {
    const state = this.load(privateId);
    if (state === null) {
      throw new ShopError('NO_SUCH_CHATTER');
    }
    const cost = KERMA_COST[item];
    if (state.kermaForbidForever) {
      throw new ShopError('KERMA_NOT_ENOUGH');
    }
    if (item === 'euroSpray') {
      if (state.kermaValue - minSquareKerma < cost) {
        throw new ShopError('KERMA_NOT_ENOUGH_FOR_MIN_SQUARE');
      }
    } else if (state.kermaValue < cost) {
      throw new ShopError('KERMA_NOT_ENOUGH');
    }
    const values: Record<string, unknown> = { kermaValue: clampKerma(state.kermaValue - cost) };
    if (item === 'changeColor') {
      values['colorToken'] = newColorToken();
    }
    if (item === 'forbidFromChat') {
      values['forbidFromChatUntil'] = new Date(now + SHOP_DURATION_MS);
    }
    if (item === 'showColor') {
      values['showColorUntil'] = new Date(now + SHOP_DURATION_MS);
    }
    this.patch(privateId, values);
    return {
      ...state,
      kermaValue: values['kermaValue'] as number,
      ...(item === 'changeColor' ? { colorToken: values['colorToken'] as string } : {}),
      ...(item === 'forbidFromChat'
        ? { forbidFromChatUntil: (values['forbidFromChatUntil'] as Date).getTime() }
        : {}),
      ...(item === 'showColor'
        ? { showColorUntil: (values['showColorUntil'] as Date).getTime() }
        : {}),
    };
  }
}

export type ShopErrorCode =
  'NO_SUCH_CHATTER' | 'KERMA_NOT_ENOUGH' | 'KERMA_NOT_ENOUGH_FOR_MIN_SQUARE';

export class ShopError extends Error {
  constructor(readonly code: ShopErrorCode) {
    super(code);
  }
}
