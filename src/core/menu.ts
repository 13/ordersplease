import type { Cents } from './money';

export interface MenuItem {
  id: string;
  name: string;
  priceCents: Cents;
  category?: 'drink' | 'food';
}

export interface MenuProfile {
  id: string;
  name: string;
  items: MenuItem[];
}

export function newProfileId(): string {
  return `menu-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export type PriceStyle = 'round' | 'half' | 'tens' | 'any';

export const DEFAULT_MENU: MenuItem[] = [
  { id: 'beer', name: 'Beer', priceCents: 400, category: 'drink' },
  { id: 'veneziano', name: 'Veneziano', priceCents: 500, category: 'drink' },
  { id: 'water', name: 'Water', priceCents: 250, category: 'drink' },
  { id: 'cola', name: 'Cola', priceCents: 300, category: 'drink' },
  { id: 'wine', name: 'Wine', priceCents: 450, category: 'drink' },
  { id: 'coffee', name: 'Coffee', priceCents: 200, category: 'drink' },
  { id: 'hugo', name: 'Hugo', priceCents: 450, category: 'drink' },
  { id: 'hefe', name: 'Wheat Beer', priceCents: 420, category: 'drink' },
  { id: 'schnaps', name: 'Schnapps', priceCents: 300, category: 'drink' },
  { id: 'wurst', name: 'Sausage', priceCents: 350, category: 'food' },
  { id: 'haehnchen', name: 'Roast Chicken', priceCents: 850, category: 'food' },
  { id: 'schnitzel', name: 'Schnitzel', priceCents: 1050, category: 'food' },
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
  hugo: 'Hugo', hefe: 'Hefe', schnaps: 'Schnaps',
  wurst: 'Wurst', haehnchen: 'Hähnchen', schnitzel: 'Schnitzel',
};

/** Default menu with localized display names; ids, prices, and order are
 *  identical across locales so seeded generation stays deterministic. */
export function localizedDefaultMenu(locale: 'en' | 'de'): MenuItem[] {
  if (locale === 'en') return DEFAULT_MENU.map((m) => ({ ...m }));
  return DEFAULT_MENU.map((m) => ({ ...m, name: DE_NAMES[m.id] ?? m.name }));
}

/** Food joins the bar from level 10; below that, drinks only. */
export function menuForLevel(menu: MenuItem[], level: number): MenuItem[] {
  return level >= 10 ? menu : menu.filter((m) => m.category !== 'food');
}

/** Legacy stored menus: default category, snap prices to the 10c grid. Idempotent. */
export function migrateMenuItems(items: MenuItem[]): MenuItem[] {
  return items.map((m) => ({
    ...m,
    priceCents: Math.max(10, Math.round(m.priceCents / 10) * 10),
    category: m.category ?? 'drink',
  }));
}

/** Parses and validates an imported menu profile (untrusted JSON). Returns
 *  null on any structural or item-level problem — never throws. */
export function parseImportedProfile(raw: unknown): MenuProfile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (name === '' || !Array.isArray(obj.items) || obj.items.length === 0) return null;

  const items: MenuItem[] = [];
  for (const [i, raw2] of obj.items.entries()) {
    if (typeof raw2 !== 'object' || raw2 === null) return null;
    const it = raw2 as Record<string, unknown>;
    const itemName = typeof it.name === 'string' ? it.name : '';
    const priceCents = typeof it.priceCents === 'number' ? it.priceCents : NaN;
    if (validateItem(itemName, priceCents)) return null; // non-null = error code
    items.push({
      id: typeof it.id === 'string' && it.id !== '' ? it.id : `import-${i}-${Date.now()}`,
      name: itemName.trim(),
      priceCents,
      category: it.category === 'food' ? 'food' : 'drink',
    });
  }
  return { id: newProfileId(), name, items };
}
