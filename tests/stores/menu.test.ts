import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { settings } from '../../src/stores/settings';
import { customMenu, activeMenu } from '../../src/stores/menu';
import { DEFAULT_MENU, migrateMenuItems } from '../../src/core/menu';

describe('activeMenu', () => {
  it('falls back to default menu when custom menu is empty', () => {
    settings.update((s) => ({ ...s, useCustomMenu: true }));
    customMenu.set([]);
    expect(get(activeMenu)).toEqual(DEFAULT_MENU);
  });
  it('uses custom menu when non-empty and enabled', () => {
    settings.update((s) => ({ ...s, useCustomMenu: true }));
    const mine = [{ id: 'x', name: 'X', priceCents: 435 }];
    customMenu.set(mine);
    expect(get(activeMenu)).toEqual(mine);
  });
});

describe('customMenu migration', () => {
  it('customMenu migrates legacy 5c prices on load', () => {
    customMenu.set([{ id: 'x', name: 'X', priceCents: 435 }]);
    // simulate the module-init migration path
    customMenu.update((items) => migrateMenuItems(items));
    const items = get(customMenu);
    expect(items[0].priceCents).toBe(440);
    expect(items[0].category).toBe('drink');
  });
});
