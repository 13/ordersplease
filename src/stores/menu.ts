import { derived } from 'svelte/store';
import { persisted } from './persisted';
import { DEFAULT_MENU, localizedDefaultMenu, type MenuItem } from '../core/menu';
import { settings } from './settings';

export const customMenu = persisted<MenuItem[]>(
  'op.custom-menu',
  DEFAULT_MENU.map((m) => ({ ...m })),
);

export const activeMenu = derived([settings, customMenu], ([$s, $c]) =>
  $s.useCustomMenu && $c.length > 0 ? $c : localizedDefaultMenu($s.locale),
);
