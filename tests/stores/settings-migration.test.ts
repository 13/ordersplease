import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';

const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

/** Load settings.ts fresh, as a page load would, over the given stored save. */
async function boot(stored?: Record<string, unknown>) {
  mem.clear();
  if (stored) mem.set('op.settings', JSON.stringify({ v: 1, data: stored }));
  vi.resetModules();
  const { settings } = await import('../../src/stores/settings');
  return get(settings);
}

const OLD_SAVE = {
  locale: 'en', sound: true, symbolFirst: false, useCustomMenu: false,
  alwaysShowPrices: false, amountEntry: false, volume: 1, haptics: true,
};

describe('prices-visible migration', () => {
  it('shows prices on a fresh install', async () => {
    expect((await boot()).alwaysShowPrices).toBe(true);
  });

  it('flips a save made before the default changed', async () => {
    const s = await boot({ ...OLD_SAVE, piecesDefaultApplied: true });
    expect(s.alwaysShowPrices).toBe(true);
    expect(s.pricesDefaultApplied).toBe(true);
  });

  it('leaves prices off once the player has turned them back off', async () => {
    const s = await boot({ ...OLD_SAVE, piecesDefaultApplied: true, pricesDefaultApplied: true });
    expect(s.alwaysShowPrices).toBe(false);
  });

  // The trap this migration was written around: persisted merges the stored
  // save OVER the defaults, so a marker carrying a default value is already
  // set for every old save and the migration can never run. Keep it undefined.
  it('still fires for a save that carries no markers at all', async () => {
    const s = await boot(OLD_SAVE); // pre-1.6 shape
    expect(s.alwaysShowPrices).toBe(true);
  });
});

describe('pieces-entry migration', () => {
  it('flips a pre-1.6 save that carries no markers', async () => {
    const s = await boot({ ...OLD_SAVE, amountEntry: true });
    expect(s.amountEntry).toBe(false);
    expect(s.piecesDefaultApplied).toBe(true);
  });

  it('leaves classic entry alone once the marker is stored', async () => {
    const s = await boot({ ...OLD_SAVE, amountEntry: true, piecesDefaultApplied: true });
    expect(s.amountEntry).toBe(true);
  });

  it('does not turn classic entry on for a fresh install', async () => {
    expect((await boot()).amountEntry).toBe(false);
  });
});
