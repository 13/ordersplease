import type { Cents } from './money';

export interface MenuItem {
  id: string;
  name: string;
  priceCents: Cents;
}

export type PriceStyle = 'round' | 'half' | 'tens' | 'any';

export const DEFAULT_MENU: MenuItem[] = [
  { id: 'beer', name: 'Beer', priceCents: 400 },
  { id: 'veneziano', name: 'Veneziano', priceCents: 500 },
  { id: 'water', name: 'Water', priceCents: 250 },
  { id: 'cola', name: 'Cola', priceCents: 300 },
  { id: 'wine', name: 'Wine', priceCents: 450 },
  { id: 'coffee', name: 'Coffee', priceCents: 200 },
];

export function validateItem(name: string, priceCents: number): string | null {
  if (name.trim() === '') return 'error.name-empty';
  if (!Number.isInteger(priceCents) || priceCents <= 0 || priceCents % 10 !== 0)
    return 'error.price-invalid';
  return null;
}

const STEP: Record<PriceStyle, number> = { round: 100, half: 50, tens: 10, any: 10 };

/** Round menu prices to the difficulty's step. Used with the default menu only;
 *  custom menus keep real prices (priceStyle ignored by callers). */
export function applyPriceStyle(menu: MenuItem[], style: PriceStyle): MenuItem[] {
  const step = STEP[style];
  return menu.map((m) => ({
    ...m,
    priceCents: Math.max(step, Math.round(m.priceCents / step) * step),
  }));
}

const DE_NAMES: Record<string, string> = {
  beer: 'Bier', veneziano: 'Veneziano', water: 'Wasser',
  cola: 'Cola', wine: 'Wein', coffee: 'Kaffee',
};

/** Default menu with localized display names; ids, prices, and order are
 *  identical across locales so seeded generation stays deterministic. */
export function localizedDefaultMenu(locale: 'en' | 'de'): MenuItem[] {
  if (locale === 'en') return DEFAULT_MENU.map((m) => ({ ...m }));
  return DEFAULT_MENU.map((m) => ({ ...m, name: DE_NAMES[m.id] ?? m.name }));
}
