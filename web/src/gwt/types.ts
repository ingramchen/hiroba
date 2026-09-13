export type MenuId =
  | 'home'
  | 'login'
  | 'account'
  | 'logout'
  | 'kerma'
  | 'kermaShop'
  | 'votingRecents'
  | 'manageCoAnchors'
  | 'dismissAnchor'
  | 'deviceShape'
  | 'qanda';

export interface MenuEntry {
  id?: MenuId | undefined;
  label?: string | undefined;
  cls?: string | undefined;
  separator?: boolean | undefined;
}
