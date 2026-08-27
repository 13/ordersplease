import { persisted } from './persisted';
import type { LocalePref } from '../i18n/detect';

export interface Settings {
  locale: LocalePref;
  sound: boolean;
  symbolFirst: boolean;
  useCustomMenu: boolean;
  alwaysShowPrices: boolean;
  highlightOrdered: boolean;
  amountEntry: boolean;
  volume: number;
  haptics: boolean;
  /** One-time migration marker: pieces entry became the default in 1.6.x. */
  piecesDefaultApplied?: boolean;
  /** One-time migration marker: menu prices became visible by default in 1.9.3. */
  pricesDefaultApplied?: boolean;
  theme: 'dark' | 'light';
  fontScale: number;
  leftHand: boolean;
  accent: string;
}

export const settings = persisted<Settings>('op.settings', {
  locale: 'auto', sound: true, symbolFirst: false, useCustomMenu: false, alwaysShowPrices: true, highlightOrdered: false, amountEntry: false, volume: 1, haptics: true,
  theme: 'dark', fontScale: 1, leftHand: false, accent: 'default',
});

// Migration markers are deliberately absent from the defaults above: persisted
// merges a stored save OVER the defaults, so a marker carrying a default value
// is already set for every old save and its migration could never fire.

// Saves from before the pieces-mode default (or with the classic toggle left
// on unknowingly) get reset ONCE to the piece-by-piece entry; the classic
// toggle keeps working afterwards.
settings.update((s) => (
  s.piecesDefaultApplied ? s : { ...s, amountEntry: false, piecesDefaultApplied: true }
));

// Prices became visible by default in 1.9.3. Saves made before that get shown
// them ONCE; the toggle keeps working, so turning them back off sticks.
settings.update((s) => (
  s.pricesDefaultApplied ? s : { ...s, alwaysShowPrices: true, pricesDefaultApplied: true }
));
