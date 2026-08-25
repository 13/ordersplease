import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { settings } from '../../src/stores/settings';
import { customMenu, activeMenu } from '../../src/stores/menu';
import { DEFAULT_MENU } from '../../src/core/menu';

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
