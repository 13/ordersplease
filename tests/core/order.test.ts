import { describe, it, expect } from 'vitest';
import {
  mulberry32, generateOrder, amendOrder, generatePayment, orderTotal, piecesTotal,
} from '$core/order';
import { DEFAULT_MENU } from '$core/menu';
import { paramsForLevel } from '$core/difficulty';

describe('mulberry32', () => {
  it('is deterministic and in [0,1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('generateOrder', () => {
  it('respects item quantity bounds and computes total', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const p = paramsForLevel(10); // itemsMin 2, itemsMax 3
      const o = generateOrder(DEFAULT_MENU, p, rng);
      const totalQty = o.lines.reduce((s, l) => s + l.qty, 0);
      expect(totalQty).toBeGreaterThanOrEqual(2);
      expect(totalQty).toBeLessThanOrEqual(3);
      expect(o.totalCents).toBe(orderTotal(o.lines));
      expect(o.totalCents).toBeGreaterThan(0);
    }
  });
});

describe('amendOrder', () => {
  it('bumps one line by one and recomputes total', () => {
    const rng = mulberry32(3);
    const base = generateOrder(DEFAULT_MENU, paramsForLevel(10), rng);
    const { order, amendedLine } = amendOrder(base, rng);
    const beforeQty = base.lines.reduce((s, l) => s + l.qty, 0);
    const afterQty = order.lines.reduce((s, l) => s + l.qty, 0);
    expect(afterQty).toBe(beforeQty + 1);
    expect(order.totalCents).toBe(base.totalCents + amendedLine.item.priceCents);
    expect(amendedLine.qty).toBeGreaterThanOrEqual(2);
  });
});

describe('generatePayment', () => {
  it('always covers the total', () => {
    const rng = mulberry32(11);
    for (const style of ['exact-or-round', 'round', 'awkward'] as const) {
      for (let i = 0; i < 50; i++) {
        const total = 5 * (1 + Math.floor(rng() * 2000)); // 0,05..100,00
        const pieces = generatePayment(total, style, rng);
        expect(piecesTotal(pieces)).toBeGreaterThanOrEqual(total);
      }
    }
  });
  it('round style pays with notes only', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 30; i++) {
      const pieces = generatePayment(430, 'round', rng);
      expect(pieces.every((p) => p >= 500)).toBe(true);
    }
  });
  it('round style at exact note totals pays that single note', () => {
    const rng = mulberry32(13);
    expect(generatePayment(5000, 'round', rng)).toEqual([5000]);
    expect(generatePayment(500, 'round', rng)).toEqual([500]);
  });
  it('awkward style adds at least one coin on top of a note', () => {
    const rng = mulberry32(9);
    const pieces = generatePayment(430, 'awkward', rng);
    expect(pieces.some((p) => p >= 500)).toBe(true);
    expect(pieces.some((p) => p <= 200)).toBe(true);
    expect(piecesTotal(pieces)).toBeGreaterThan(430);
  });
});
