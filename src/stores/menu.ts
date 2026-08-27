import { derived, get } from 'svelte/store';
import { persisted } from './persisted';
import {
  DEFAULT_MENU, localizedDefaultMenu, migrateMenuItems, type MenuItem, type MenuProfile,
} from '../core/menu';
import { settings } from './settings';
import { locale } from '../i18n';

// legacy single-menu store — read once to migrate, never written to again
const legacyCustomMenu = persisted<MenuItem[]>(
  'op.custom-menu',
  DEFAULT_MENU.map((m) => ({ ...m })),
);

function defaultProfiles(): MenuProfile[] {
  const items = migrateMenuItems(get(legacyCustomMenu));
  const name = get(locale) === 'de' ? 'Meine Karte' : 'My Menu';
  return [{ id: 'my-menu', name, items }];
}

export const menuProfiles = persisted<MenuProfile[]>('op.menu-profiles', defaultProfiles());
export const activeProfileId = persisted<string>('op.active-profile-id', 'my-menu');

export const activeProfile = derived(
  [menuProfiles, activeProfileId],
  ([$profiles, $id]) => $profiles.find((p) => p.id === $id) ?? $profiles[0] ?? null,
);

export const activeMenu = derived(
  [settings, locale, menuProfiles, activeProfileId],
  ([$s, $l, $profiles, $id]) => {
    if (!$s.useCustomMenu) return localizedDefaultMenu($l);
    const p = $profiles.find((pr) => pr.id === $id) ?? $profiles[0];
    return p && p.items.length > 0 ? p.items : localizedDefaultMenu($l);
  },
);
