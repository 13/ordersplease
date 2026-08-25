// tests/core/till.test.ts
import { describe, it, expect } from 'vitest';
import {
  DENOMS, COIN_DENOMS, fullTill, scarceTill, tillTotal,
  removeFromTill, addToTill, hasPieces,
} from '$core/till';

describe('till', () => {
  it('denominations are descending and complete', () => {
    expect([...DENOMS]).toEqual([5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5]);
    expect([...COIN_DENOMS]).toEqual([200, 100, 50, 20, 10, 5]);
  });
  it('fullTill has stock of every denom', () => {
    const t = fullTill();
    for (const d of DENOMS) expect(t[d]).toBeGreaterThan(0);
  });
  it('tillTotal sums denom * count', () => {
    expect(tillTotal({ 200: 2, 5: 3 })).toBe(415);
  });
  it('remove and add are immutable and consistent', () => {
    const t = fullTill();
    const t2 = removeFromTill(t, [200, 200, 5]);
    expect(t2[200]).toBe(t[200] - 2);
    expect(t2[5]).toBe(t[5] - 1);
    expect(t[200]).not.toBe(t2[200]); // original untouched
    const t3 = addToTill(t2, [200, 200, 5]);
    expect(t3).toEqual(t);
  });
  it('remove throws when insufficient', () => {
    expect(() => removeFromTill({ 100: 1 }, [100, 100])).toThrow('insufficient');
  });
  it('hasPieces checks availability without mutating', () => {
    expect(hasPieces({ 100: 1, 50: 2 }, [100, 50])).toBe(true);
    expect(hasPieces({ 100: 1 }, [100, 100])).toBe(false);
  });
  it('scarceTill zeroes/lowers exactly N coin denoms, never notes', () => {
    let seed = 0;
    const rng = () => ((seed = (seed * 9301 + 49297) % 233280), seed / 233280);
    const t = scarceTill(rng, 2);
    const low = COIN_DENOMS.filter((d) => t[d] <= 1);
    expect(low.length).toBe(2);
    expect(t[5000]).toBeGreaterThan(0);
    expect(t[500]).toBeGreaterThan(0);
  });
});
