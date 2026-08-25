import { describe, it, expect } from 'vitest';
import { DEFAULT_MENU, validateItem, applyPriceStyle } from '$core/menu';

describe('menu', () => {
  it('default menu has the spec drinks', () => {
    const byId = Object.fromEntries(DEFAULT_MENU.map((m) => [m.id, m.priceCents]));
    expect(byId['beer']).toBe(400);
    expect(byId['veneziano']).toBe(500);
    expect(byId['water']).toBe(250);
    expect(DEFAULT_MENU.length).toBeGreaterThanOrEqual(6);
  });
  it('all default prices are multiples of 5 cents', () => {
    for (const m of DEFAULT_MENU) expect(m.priceCents % 5).toBe(0);
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

import { localizedDefaultMenu } from '$core/menu';

describe('localizedDefaultMenu', () => {
  it('DE names are translated, ids and prices identical', () => {
    const de = localizedDefaultMenu('de');
    const en = localizedDefaultMenu('en');
    expect(de.map((m) => m.name)).toEqual(['Bier', 'Veneziano', 'Wasser', 'Cola', 'Wein', 'Kaffee']);
    expect(de.map((m) => m.id)).toEqual(en.map((m) => m.id));
    expect(de.map((m) => m.priceCents)).toEqual(en.map((m) => m.priceCents));
  });
  it('EN equals DEFAULT_MENU', () => {
    expect(localizedDefaultMenu('en')).toEqual(DEFAULT_MENU);
  });
});
