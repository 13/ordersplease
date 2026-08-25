import { describe, it, expect } from 'vitest';
import { renderOrder, renderAmendment } from '$core/text-order';

const beer = { id: 'beer', name: 'Beer', priceCents: 400 };
const ven = { id: 'veneziano', name: 'Veneziano', priceCents: 500 };

describe('renderOrder EN', () => {
  it('single item, qty 1', () => {
    expect(renderOrder({ lines: [{ item: beer, qty: 1 }], totalCents: 400 }, 'en'))
      .toBe('A Beer, please.');
  });
  it('plural and conjunction', () => {
    expect(renderOrder(
      { lines: [{ item: beer, qty: 2 }, { item: ven, qty: 1 }], totalCents: 1300 }, 'en'))
      .toBe('Two Beers and a Veneziano, please.');
  });
  it('three lines use commas', () => {
    const water = { id: 'water', name: 'Water', priceCents: 250 };
    expect(renderOrder(
      { lines: [{ item: beer, qty: 2 }, { item: ven, qty: 1 }, { item: water, qty: 3 }], totalCents: 0 }, 'en'))
      .toBe('Two Beers, a Veneziano and three Waters, please.');
  });
});

describe('renderOrder DE', () => {
  it('single item, qty 1', () => {
    expect(renderOrder({ lines: [{ item: beer, qty: 1 }], totalCents: 400 }, 'de'))
      .toBe('Ein Beer, bitte.');
  });
  it('no plural mutation in German', () => {
    expect(renderOrder(
      { lines: [{ item: beer, qty: 2 }, { item: ven, qty: 1 }], totalCents: 1300 }, 'de'))
      .toBe('Zwei Beer und ein Veneziano, bitte.');
  });
});

describe('renderAmendment', () => {
  it('EN', () => {
    expect(renderAmendment({ item: beer, qty: 3 }, 'en'))
      .toBe('Actually, make that three Beers.');
  });
  it('DE', () => {
    expect(renderAmendment({ item: beer, qty: 3 }, 'de'))
      .toBe('Ach, machen Sie doch drei Beer.');
  });
});
