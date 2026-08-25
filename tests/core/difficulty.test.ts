import { describe, it, expect } from 'vitest';
import { paramsForLevel, paramsForRush, MAX_LEVEL } from '$core/difficulty';

describe('difficulty', () => {
  it('level 1 matches spec anchors', () => {
    const p = paramsForLevel(1);
    expect(p.itemsMin).toBe(1);
    expect(p.itemsMax).toBe(1);
    expect(p.priceStyle).toBe('round');
    expect(p.paymentStyle).toBe('exact-or-round');
    expect(p.patienceSeconds).toBe(45);
    expect(p.menuVisibleSeconds).toBeNull();
    expect(p.scarceDenoms).toBe(0);
    expect(p.midOrderChangeProb).toBe(0);
    expect(p.showPileTotal).toBe(true);
  });
  it('level 30 matches spec anchors', () => {
    const p = paramsForLevel(MAX_LEVEL);
    expect(p.itemsMax).toBe(6);
    expect(p.priceStyle).toBe('any');
    expect(p.paymentStyle).toBe('awkward');
    expect(p.patienceSeconds).toBe(15);
    expect(p.menuVisibleSeconds).toBe(0);
    expect(p.midOrderChangeProb).toBeCloseTo(0.35);
    expect(p.showPileTotal).toBe(false);
  });
  it('difficulty is monotone: patience never increases with level', () => {
    for (let l = 2; l <= MAX_LEVEL; l++) {
      expect(paramsForLevel(l).patienceSeconds).toBeLessThanOrEqual(
        paramsForLevel(l - 1).patienceSeconds,
      );
    }
  });
  it('rush interpolates over time and caps', () => {
    expect(paramsForRush(0)).toEqual(paramsForLevel(1));
    expect(paramsForRush(10_000)).toEqual(paramsForLevel(MAX_LEVEL));
  });
});
