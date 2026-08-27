import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Settings from '../../src/routes/Settings.svelte';
import { settings } from '../../src/stores/settings';
import { browserLang, locale } from '../../src/i18n';

describe('Settings language select', () => {
  beforeEach(() => {
    settings.update((s) => ({ ...s, locale: 'auto' }));
    browserLang.set('en');
  });

  it('offers automatic, English and Deutsch', () => {
    const { getByLabelText } = render(Settings);
    const select = getByLabelText('Language') as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(['auto', 'en', 'de']);
  });

  // Pinned to English, but the browser is German: the label must report the
  // language auto *would* pick, in the currently rendered chrome language.
  it('labels the automatic option with what it would resolve to', () => {
    settings.update((s) => ({ ...s, locale: 'en' }));
    browserLang.set('de');
    const { getByLabelText } = render(Settings);
    const select = getByLabelText('Language') as HTMLSelectElement;
    expect(select.options[0].textContent?.trim()).toBe('Automatic (Deutsch)');
  });

  it('renders German chrome when auto resolves to de', () => {
    browserLang.set('de');
    const { getByLabelText } = render(Settings);
    expect(get(locale)).toBe('de');
    const select = getByLabelText('Sprache') as HTMLSelectElement;
    expect(select.options[0].textContent?.trim()).toBe('Automatisch (Deutsch)');
  });
});
