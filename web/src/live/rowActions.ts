import { inject, provide, type InjectionKey } from 'vue';

export interface RowActions {
  forbid: (publicId: string, nickname: string) => void;
}

const KEY: InjectionKey<RowActions> = Symbol('hiroba.rowActions');

export function provideRowActions(actions: RowActions): void {
  provide(KEY, actions);
}

export function useRowActions(): RowActions {
  return inject(KEY, { forbid: () => undefined });
}
