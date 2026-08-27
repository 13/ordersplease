import { describe, it, expect } from 'vitest';
import { DEFAULT_MENU, validateItem, applyPriceStyle, parseImportedProfile, moveMenuItem } from '$core/menu';

describe('moveMenuItem', () => {
  const ids = (m: { id: string }[]) => m.map((x) => x.id).join(',');
  const four = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] as never as
    typeof DEFAULT_MENU;

  it('moves an item down and up', () => {
    expect(ids(moveMenuItem(four, 0, 2))).toBe('b,c,a,d');
    expect(ids(moveMenuItem(four, 3, 1))).toBe('a,d,b,c');
  });
  it('is a no-op when the item does not move', () => {
    expect(ids(moveMenuItem(four, 2, 2))).toBe('a,b,c,d');
  });
  it('clamps out-of-range targets to the ends', () => {
    expect(ids(moveMenuItem(four, 1, -5))).toBe('b,a,c,d');
    expect(ids(moveMenuItem(four, 1, 99))).toBe('a,c,d,b');
  });
  it('returns the list unchanged for an out-of-range source', () => {
    expect(ids(moveMenuItem(four, -1, 0))).toBe('a,b,c,d');
    expect(ids(moveMenuItem(four, 4, 0))).toBe('a,b,c,d');
  });
  it('does not mutate the input', () => {
    const original = [...four];
    moveMenuItem(four, 0, 3);
    expect(four).toEqual(original);
  });
});

describe('menu', () => {
  it('default menu has the spec drinks', () => {
    const byId = Object.fromEntries(DEFAULT_MENU.map((m) => [m.id, m.priceCents]));
    expect(byId['beer']).toBe(400);
    expect(byId['veneziano']).toBe(500);
    expect(byId['water']).toBe(250);
    expect(DEFAULT_MENU.length).toBeGreaterThanOrEqual(6);
  });
  it('all default prices are multiples of 10 cents', () => {
    for (const m of DEFAULT_MENU) expect(m.priceCents % 10).toBe(0);
  });
  it('validates name and price', () => {
    expect(validateItem('Beer', 400)).toBeNull();
    expect(validateItem('', 400)).toBe('error.name-empty');
    expect(validateItem('Beer', 0)).toBe('error.price-invalid');
    expect(validateItem('Beer', 401)).toBe('error.price-invalid'); // not multiple of 10
    expect(validateItem('Beer', 405)).toBe('error.price-invalid'); // 5-multiples now invalid
    expect(validateItem('Beer', 410)).toBeNull();
  });
  it('applyPriceStyle rounds to style step', () => {
    const menu = [{ id: 'x', name: 'X', priceCents: 430 }];
    expect(applyPriceStyle(menu, 'round')[0].priceCents).toBe(400);
    expect(applyPriceStyle(menu, 'half')[0].priceCents).toBe(450);
    expect(applyPriceStyle(menu, 'tens')[0].priceCents).toBe(430);
    expect(applyPriceStyle(menu, 'any')[0].priceCents).toBe(430);
  });
  it('applyPriceStyle never returns zero price', () => {
    const menu = [{ id: 'x', name: 'X', priceCents: 40 }];
    expect(applyPriceStyle(menu, 'round')[0].priceCents).toBe(100);
  });
  it('applyPriceStyle "any" never rounds below the 10-cent minimum', () => {
    expect(applyPriceStyle([{ id: 'x', name: 'X', priceCents: 4 }], 'any')[0].priceCents).toBe(10);
  });
});

import { localizedDefaultMenu, menuForLevel, migrateMenuItems } from '$core/menu';

describe('localizedDefaultMenu', () => {
  it('DE names are translated, ids and prices identical', () => {
    const de = localizedDefaultMenu('de');
    const en = localizedDefaultMenu('en');
    expect(de.map((m) => m.name)).toEqual(['Bier', 'Veneziano', 'Wasser', 'Cola', 'Wein', 'Kaffee', 'Hugo', 'Hefe', 'Schnaps', 'Wurst', 'Hähnchen', 'Schnitzel']);
    expect(de.map((m) => m.id)).toEqual(en.map((m) => m.id));
    expect(de.map((m) => m.priceCents)).toEqual(en.map((m) => m.priceCents));
  });
  it('EN equals DEFAULT_MENU', () => {
    expect(localizedDefaultMenu('en')).toEqual(DEFAULT_MENU);
  });
});

describe('round-4 menu', () => {
  it('default menu has 12 items with the spec prices and categories', () => {
    const byId = Object.fromEntries(DEFAULT_MENU.map((m) => [m.id, m]));
    expect(DEFAULT_MENU.length).toBe(12);
    expect(byId['hugo']).toMatchObject({ priceCents: 450, category: 'drink' });
    expect(byId['hefe']).toMatchObject({ name: 'Wheat Beer', priceCents: 420, category: 'drink' });
    expect(byId['schnaps']).toMatchObject({ name: 'Schnapps', priceCents: 300 });
    expect(byId['wurst']).toMatchObject({ name: 'Sausage', priceCents: 350, category: 'food' });
    expect(byId['haehnchen']).toMatchObject({ priceCents: 850, category: 'food' });
    expect(byId['schnitzel']).toMatchObject({ priceCents: 1050, category: 'food' });
  });
  it('DE names for the new items', () => {
    const de = Object.fromEntries(localizedDefaultMenu('de').map((m) => [m.id, m.name]));
    expect(de['hefe']).toBe('Hefe');
    expect(de['schnaps']).toBe('Schnaps');
    expect(de['wurst']).toBe('Wurst');
    expect(de['haehnchen']).toBe('Hähnchen');
    expect(de['schnitzel']).toBe('Schnitzel');
  });
  it('menuForLevel gates food at level 10', () => {
    expect(menuForLevel(DEFAULT_MENU, 9).every((m) => m.category === 'drink')).toBe(true);
    expect(menuForLevel(DEFAULT_MENU, 9).length).toBe(9);
    expect(menuForLevel(DEFAULT_MENU, 10).length).toBe(12);
  });
  it('migrateMenuItems rounds prices to 10 and defaults category, idempotently', () => {
    const legacy = [{ id: 'x', name: 'X', priceCents: 435 }];
    const once = migrateMenuItems(legacy);
    expect(once[0]).toMatchObject({ priceCents: 440, category: 'drink' });
    expect(migrateMenuItems(once)).toEqual(once);
    expect(migrateMenuItems([{ id: 'y', name: 'Y', priceCents: 4 }])[0].priceCents).toBe(10);
  });
});

describe('parseImportedProfile', () => {
  it('accepts a well-formed profile', () => {
    const p = parseImportedProfile({
      name: 'Kirchweih',
      items: [{ id: 'a', name: 'Bier', priceCents: 350, category: 'drink' }],
    });
    expect(p).not.toBeNull();
    expect(p!.name).toBe('Kirchweih');
    expect(p!.items).toEqual([{ id: 'a', name: 'Bier', priceCents: 350, category: 'drink' }]);
  });
  it('assigns a fresh id and defaults category to drink', () => {
    const p = parseImportedProfile({ name: 'X', items: [{ name: 'Y', priceCents: 100 }] });
    expect(p!.items[0].id).toBeTruthy();
    expect(p!.items[0].category).toBe('drink');
  });
  it('rejects missing/blank name', () => {
    expect(parseImportedProfile({ items: [{ name: 'Y', priceCents: 100 }] })).toBeNull();
    expect(parseImportedProfile({ name: '  ', items: [{ name: 'Y', priceCents: 100 }] })).toBeNull();
  });
  it('rejects empty or missing items', () => {
    expect(parseImportedProfile({ name: 'X', items: [] })).toBeNull();
    expect(parseImportedProfile({ name: 'X' })).toBeNull();
  });
  it('rejects an invalid item anywhere in the list', () => {
    expect(parseImportedProfile({
      name: 'X',
      items: [{ name: 'Ok', priceCents: 100 }, { name: '', priceCents: 100 }],
    })).toBeNull();
    expect(parseImportedProfile({
      name: 'X',
      items: [{ name: 'Ok', priceCents: 105 }], // not a 10c multiple
    })).toBeNull();
  });
  it('rejects non-object input without throwing', () => {
    expect(parseImportedProfile(null)).toBeNull();
    expect(parseImportedProfile('hello')).toBeNull();
    expect(parseImportedProfile(42)).toBeNull();
    expect(parseImportedProfile([1, 2, 3])).toBeNull();
  });
});
