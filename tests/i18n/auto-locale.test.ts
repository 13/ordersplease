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

describe('the auto pref', () => {
  it('defaults to auto on a fresh install', async () => {
    const { settings } = await load();
    expect(get(settings).locale).toBe('auto');
  });

  it('follows the browser when the pref is auto', async () => {
    const { locale, browserLang, t } = await load({ locale: 'auto' });
    browserLang.set('de');
    expect(get(locale)).toBe('de');
    expect(get(t)('home.play')).toBe('Spielen');
  });

  it('ignores the browser when a locale is pinned', async () => {
    const { locale, browserLang, t } = await load({ locale: 'de' });
    browserLang.set('en');
    expect(get(locale)).toBe('de');
    expect(get(t)('home.play')).toBe('Spielen');
  });

  it('updates live when the browser language changes under auto', async () => {
    const { browserLang, t } = await load({ locale: 'auto' });
    browserLang.set('en');
    expect(get(t)('home.play')).toBe('Play');
    browserLang.set('de');
    expect(get(t)('home.play')).toBe('Spielen');
  });

  it('never exposes auto downstream', async () => {
    const { locale } = await load({ locale: 'auto' });
    expect(['en', 'de']).toContain(get(locale));
  });

  it('falls back to en for a corrupt saved locale', async () => {
    const { locale, t } = await load({ locale: 'fr' });
    expect(get(locale)).toBe('en');
    expect(get(t)('home.play')).toBe('Play');
  });
});

describe('existing saves', () => {
  // Regression guard: existing players must not be re-languaged.
  it('keeps a saved en', async () => {
    const { settings, locale } = await load({ locale: 'en' });
    expect(get(settings).locale).toBe('en');
    expect(get(locale)).toBe('en');
  });

  it('keeps a saved de', async () => {
    const { settings, locale } = await load({ locale: 'de' });
    expect(get(settings).locale).toBe('de');
    expect(get(locale)).toBe('de');
  });
});

describe('consumers follow the resolved locale', () => {
  it('gives activeMenu the German default menu under auto+de', async () => {
    const { browserLang } = await load({ locale: 'auto', useCustomMenu: false });
    const { activeMenu } = await import('../../src/stores/menu');
    const { localizedDefaultMenu } = await import('../../src/core/menu');
    browserLang.set('de');
    expect(get(activeMenu)).toEqual(localizedDefaultMenu('de'));
    browserLang.set('en');
    expect(get(activeMenu)).toEqual(localizedDefaultMenu('en'));
  });
});
