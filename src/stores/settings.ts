import { persisted } from './persisted';

export interface Settings {
  locale: 'en' | 'de';
  sound: boolean;
  symbolFirst: boolean;
  useCustomMenu: boolean;
  alwaysShowPrices: boolean;
}

export const settings = persisted<Settings>('op.settings', {
  locale: 'en', sound: true, symbolFirst: false, useCustomMenu: false, alwaysShowPrices: false,
});
