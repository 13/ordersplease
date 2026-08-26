import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { settings } from '../../src/stores/settings';
import { menuProfiles, activeProfileId, activeMenu } from '../../src/stores/menu';
import { DEFAULT_MENU, migrateMenuItems } from '../../src/core/menu';

describe('activeMenu', () => {
  it('falls back to default menu when the active profile is empty', () => {
    settings.update((s) => ({ ...s, useCustomMenu: true }));
    menuProfiles.set([{ id: 'p1', name: 'Empty', items: [] }]);
    activeProfileId.set('p1');
    expect(get(activeMenu)).toEqual(DEFAULT_MENU);
  });
  it('uses the active profile when non-empty and enabled', () => {
    settings.update((s) => ({ ...s, useCustomMenu: true }));
    const mine = [{ id: 'x', name: 'X', priceCents: 435 }];
    menuProfiles.set([{ id: 'p1', name: 'Mine', items: mine }]);
    activeProfileId.set('p1');
    expect(get(activeMenu)).toEqual(mine);
  });
  it('ignores profiles when the custom-menu toggle is off', () => {
    settings.update((s) => ({ ...s, useCustomMenu: false }));
    menuProfiles.set([{ id: 'p1', name: 'Mine', items: [{ id: 'x', name: 'X', priceCents: 435 }] }]);
    activeProfileId.set('p1');
    expect(get(activeMenu)).toEqual(DEFAULT_MENU);
  });
});

describe('profile item migration', () => {
  it('migrateMenuItems normalizes legacy 5c prices and missing categories', () => {
    const items = migrateMenuItems([{ id: 'x', name: 'X', priceCents: 435 }]);
    expect(items[0].priceCents).toBe(440);
    expect(items[0].category).toBe('drink');
  });
});
