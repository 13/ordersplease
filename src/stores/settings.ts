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
  /** One-time migration marker: menu prices became visible by default in 1.9.3.
   *  Deliberately absent from the defaults below — persisted merges stored
   *  settings OVER the defaults, so a marker that has a default value is
   *  already set for old saves and the migration could never fire. */
  pricesDefaultApplied?: boolean;
  theme: 'dark' | 'light';
  fontScale: number;
  leftHand: boolean;
  accent: string;
}

export const settings = persisted<Settings>('op.settings', {
  locale: 'auto', sound: true, symbolFirst: false, useCustomMenu: false, alwaysShowPrices: true, highlightOrdered: false, amountEntry: false, volume: 1, haptics: true,
  piecesDefaultApplied: true,
  theme: 'dark', fontScale: 1, leftHand: false, accent: 'default',
});

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
