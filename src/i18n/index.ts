import { derived } from 'svelte/store';
import { settings } from '../stores/settings';
import { type Locale } from './detect';
import en from './en';
import de from './de';

const dicts: Record<Locale, Record<string, string>> = { en, de };

/** The concrete locale to render in. Task 3 teaches this to resolve 'auto'. */
export const locale = derived(settings, ($s): Locale => $s.locale);

export const t = derived(locale, ($l) => (key: string): string =>
  dicts[$l][key] ?? key,
);
