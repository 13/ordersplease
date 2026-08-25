import { describe, it, expect } from 'vitest';
import { hintFor } from '$core/hints';
import { createRound, submitSum, markHint } from '$core/round';
import { fullTill } from '$core/till';

const beer = { id: 'beer', name: 'Bier', priceCents: 400 };
const water = { id: 'water', name: 'Wasser', priceCents: 250 };
const order = { lines: [{ item: beer, qty: 2 }, { item: water, qty: 1 }], totalCents: 1050 };

describe('hintFor', () => {
  it('sum phase reveals line subtotals by index, clamped', () => {
    const r = createRound(order, [2000], fullTill());
    expect(hintFor(r, 0, 'de')).toBe('2× Bier = 8,00 €');
    expect(hintFor(r, 1, 'de')).toBe('1× Wasser = 2,50 €');
    expect(hintFor(r, 5, 'de')).toBe('1× Wasser = 2,50 €');
  });
  it('change phase reveals the change amount', () => {
    let r = createRound(order, [2000], fullTill());
    r = submitSum(r, 1050);
    expect(hintFor(r, 0, 'en')).toBe('Change: 9,50 €');
    expect(hintFor(r, 0, 'de')).toBe('Wechselgeld: 9,50 €');
  });
  it('underpaid payment nudges a re-count', () => {
    let r = createRound(order, [500, 200], fullTill()); // 7,00 for 10,50
    r = submitSum(r, 1050);
    expect(hintFor(r, 0, 'en')).toBe('Count the payment again…');
    expect(hintFor(r, 0, 'de')).toBe('Zähl das Geld nochmal nach…');
  });
  it('shortage nudges the ask', () => {
    const till = { 200: 5 }; // only 2€ coins
    let r = createRound({ lines: [{ item: beer, qty: 2 }], totalCents: 800 }, [500, 200, 200, 50], till);
    r = submitSum(r, 800); // change 1,50 — 200-only till can't make it
    expect(hintFor(r, 0, 'en')).toBe('The till can’t make this — ask for a coin.');
  });
});
