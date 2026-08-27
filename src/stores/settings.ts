import { persisted } from './persisted';
import type { LocalePref } from '../i18n/detect';

export interface Settings {
  locale: LocalePref;
  sound: boolean;
  symbolFirst: boolean;
  useCustomMenu: boolean;
  alwaysShowPrices: boolean;
  amountEntry: boolean;
  volume: number;
  haptics: boolean;
  /** One-time migration marker: pieces entry became the default in 1.6.x. */
  piecesDefaultApplied?: boolean;
  theme: 'dark' | 'light';
  fontScale: number;
  leftHand: boolean;
  accent: string;
}

export const settings = persisted<Settings>('op.settings', {
  locale: 'auto', sound: true, symbolFirst: false, useCustomMenu: false, alwaysShowPrices: false, amountEntry: false, volume: 1, haptics: true,
  piecesDefaultApplied: true,
  theme: 'dark', fontScale: 1, leftHand: false, accent: 'default',
});

// Saves from before the pieces-mode default (or with the classic toggle left
// on unknowingly) get reset ONCE to the piece-by-piece entry; the classic
// toggle keeps working afterwards.
settings.update((s) => (
  s.piecesDefaultApplied ? s : { ...s, amountEntry: false, piecesDefaultApplied: true }
));
