import { derived } from 'svelte/store';
import { settings } from '../stores/settings';
import en from './en';
import de from './de';

const dicts = { en, de };

export const t = derived(settings, ($s) => (key: string): string =>
  dicts[$s.locale][key] ?? key,
);
