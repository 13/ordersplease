import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';

const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

async function load(saved?: Record<string, unknown>) {
  mem.clear();
  if (saved) mem.set('op.settings', JSON.stringify({ v: 1, data: saved }));
  vi.resetModules();
  const i18n = await import('../../src/i18n');
  const { settings } = await import('../../src/stores/settings');
  return { ...i18n, settings };
}

describe('locale store', () => {
  it('exposes the saved locale', async () => {
    const { locale } = await load({ locale: 'de' });
    expect(get(locale)).toBe('de');
  });

  it('drives t', async () => {
    const { t } = await load({ locale: 'de' });
    expect(get(t)('home.play')).toBe('Spielen');
  });

  it('follows a change to the setting', async () => {
    const { locale, t, settings } = await load({ locale: 'en' });
    expect(get(t)('home.play')).toBe('Play');
    settings.update((s) => ({ ...s, locale: 'de' }));
    expect(get(locale)).toBe('de');
    expect(get(t)('home.play')).toBe('Spielen');
  });

  it('keeps t returning the key for an unknown key', async () => {
    const { t } = await load({ locale: 'en' });
    expect(get(t)('no.such.key')).toBe('no.such.key');
  });
});

describe('dictionary parity', () => {
  it('en and de define the same keys', async () => {
    const en = (await import('../../src/i18n/en')).default;
    const de = (await import('../../src/i18n/de')).default;
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });
});
