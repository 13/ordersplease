import { describe, it, expect } from 'vitest';
import {
  happyHourPrice, discountMenu, rollHappyHourStart, HAPPY_HOUR_ROUNDS,
} from '../../src/core/happy-hour';
import { paramsForLevel } from '../../src/core/difficulty';

describe('happyHourPrice', () => {
  it('discounts 20% on the 10c grid with a 10c floor', () => {
    expect(happyHourPrice(400)).toBe(320);  // 4,00 → 3,20
    expect(happyHourPrice(450)).toBe(360);  // 4,50 → 3,60
    expect(happyHourPrice(250)).toBe(200);
    expect(happyHourPrice(1050)).toBe(840);
    expect(happyHourPrice(10)).toBe(10);    // floor
    expect(happyHourPrice(30)).toBe(20);    // 24 → 20
  });
});

describe('rollHappyHourStart', () => {
  it('consumes exactly 2 rng calls whether or not it fires', () => {
    let calls = 0;
    const rng = () => { calls += 1; return 0.99; };
    expect(rollHappyHourStart(paramsForLevel(20), rng)).toBe(null);
    expect(calls).toBe(2);
    calls = 0;
    const rngHit = () => { calls += 1; return 0.01; };
    const start = rollHappyHourStart(paramsForLevel(20), rngHit);
    expect(calls).toBe(2);
    expect(start).not.toBe(null);
  });
  it('places the start inside [2, ordersPerLevel-3]', () => {
    const p = paramsForLevel(22); // ordersPerLevel 12
    for (const r of [0, 0.4999, 0.9999]) {
      const start = rollHappyHourStart(p, mkRng([0, r]));
      expect(start).toBeGreaterThanOrEqual(2);
      expect(start).toBeLessThanOrEqual(9);
    }
  });
  it('never fires below the gate', () => {
    expect(rollHappyHourStart(paramsForLevel(11), mkRng([0, 0]))).toBe(null);
  });
});

function mkRng(vals: number[]): () => number {
  let i = 0;
  return () => vals[Math.min(i++, vals.length - 1)];
}
