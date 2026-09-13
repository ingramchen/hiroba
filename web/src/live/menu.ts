import type { MenuEntry } from '../gwt/types';
import type { Translator } from '../i18n';
import type { DeviceShape } from '../runtime';

export const LICENSE_NAME = 'MIT License';

export function homeMenuEntries(i18n: Translator, username: string | null): MenuEntry[] {
  return [
    { id: 'home', label: 'Home' },
    ...(username === null
      ? [{ id: 'login' as const, label: i18n.t('login') }]
      : [
          { id: 'account' as const, label: username },
          { id: 'logout' as const, label: i18n.t('logout') },
        ]),
    { separator: true },
    { id: 'qanda', label: 'Q & A' },
  ];
}

export interface SquareMenuOptions {
  i18n: Translator;
  kerma: string;
  kermaCls?: string | undefined;
  username?: string | null;
  owner?: boolean;
}

export function squareMenuEntries(options: SquareMenuOptions): MenuEntry[] {
  const { i18n, kerma, kermaCls, username = null, owner = false } = options;
  return [
    { id: 'home', label: 'Home' },
    ...(username === null
      ? [{ id: 'login' as const, label: i18n.t('login') }]
      : [
          { id: 'account' as const, label: username },
          { id: 'logout' as const, label: i18n.t('logout') },
        ]),
    { id: 'kerma', label: kerma, cls: kermaCls },
    { separator: true },
    { id: 'kermaShop', label: i18n.t('kermaShop') },
    { separator: true },
    { id: 'votingRecents', label: i18n.t('votingRecents') },
    ...(owner
      ? [
          { id: 'manageCoAnchors' as const, label: i18n.t('manageCoAnchors') },
          { id: 'dismissAnchor' as const, label: i18n.t('dismissAnchor') },
        ]
      : []),
    { separator: true },
    { id: 'deviceShape', label: i18n.t('deviceShape') },
    { separator: true },
    { id: 'qanda', label: 'Q & A' },
  ];
}

export const DEVICE_SHAPES: DeviceShape[] = ['RESPONSIVE', 'DESKTOP', 'COMPACT'];

const DEVICE_SHAPE_LABELS: Record<
  DeviceShape,
  'deviceShapeResponsive' | 'deviceShapeDesktop' | 'deviceShapeCompact'
> = {
  RESPONSIVE: 'deviceShapeResponsive',
  DESKTOP: 'deviceShapeDesktop',
  COMPACT: 'deviceShapeCompact',
};

export function deviceShapeEntries(i18n: Translator, selected: DeviceShape): MenuEntry[] {
  return DEVICE_SHAPES.map((shape) => ({
    label: i18n.t(DEVICE_SHAPE_LABELS[shape]),
    ...(shape === selected ? { cls: 'SquareCssResource-deviceShapeSelected' } : {}),
  }));
}
