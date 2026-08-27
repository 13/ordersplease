import { derived, writable } from 'svelte/store';
import { settings } from '../stores/settings';
import { detectLocale, isLocale, FALLBACK, type Locale } from './detect';
import en from './en';
import de from './de';

const dicts: Record<Locale, Record<string, string>> = { en, de };

/** The browser's preferred supported language. Set directly in tests. */
export const browserLang = writable<Locale>(detectLocale());

// Follow the OS/browser language while the pref is 'auto'. Optional call:
// `addEventListener` does not exist in the node test environment.
globalThis.addEventListener?.('languagechange', () => browserLang.set(detectLocale()));

/** The concrete locale to render in — never 'auto'. */
export const locale = derived([settings, browserLang], ([$s, $b]): Locale => {
  const want = $s.locale === 'auto' ? $b : $s.locale;
  return isLocale(want) ? want : FALLBACK;
});

export const t = derived(locale, ($l) => (key: string): string =>
  dicts[$l][key] ?? key,
);
