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

import { practiceParams, SKILL_ERROR } from '$core/difficulty';

describe('round-2 probability rows', () => {
  it('anchors at L30 per spec', () => {
    const p = paramsForLevel(30);
    expect(p.underpayProb).toBeCloseTo(0.2);
    expect(p.disputeProb).toBeCloseTo(0.2);
    expect(p.tabProb).toBeCloseTo(0.25);
    expect(p.splitProb).toBeCloseTo(0.2);
  });
  it('is exactly zero strictly below each entry level', () => {
    expect(paramsForLevel(11).underpayProb).toBe(0);
    expect(paramsForLevel(12).underpayProb).toBeGreaterThan(0);
    expect(paramsForLevel(17).disputeProb).toBe(0);
    expect(paramsForLevel(18).disputeProb).toBeGreaterThan(0);
    expect(paramsForLevel(14).tabProb).toBe(0);
    expect(paramsForLevel(15).tabProb).toBeGreaterThan(0);
    expect(paramsForLevel(21).splitProb).toBe(0);
    expect(paramsForLevel(22).splitProb).toBeGreaterThan(0);
  });
  it('level 1 has all four at zero', () => {
    const p = paramsForLevel(1);
    expect(p.underpayProb + p.disputeProb + p.tabProb + p.splitProb).toBe(0);
  });
});

describe('practiceParams', () => {
  it('always 10 orders, zeroes the special mechanics by default', () => {
    const p = practiceParams('change');
    expect(p.ordersPerLevel).toBe(10);
    expect(p.tabProb + p.splitProb + p.underpayProb + p.disputeProb).toBe(0);
    expect(p.paymentStyle).toBe('awkward');
    expect(p.showPileTotal).toBe(false);
  });
  it('mechanic drills force their probability to 1', () => {
    expect(practiceParams('traps').underpayProb).toBe(1);
    expect(practiceParams('disputes').disputeProb).toBe(1);
    expect(practiceParams('tabs').tabProb).toBe(1);
    expect(practiceParams('splits').splitProb).toBe(1);
  });
  it('speed drill: short patience, small orders', () => {
    const p = practiceParams('speed');
    expect(p.patienceSeconds).toBe(12);
    expect(p.itemsMax).toBeLessThanOrEqual(2);
  });
  it('shortage drill guarantees a scarce till', () => {
    expect(practiceParams('shortages').scarceDenoms).toBeGreaterThanOrEqual(2);
  });
  it('SKILL_ERROR maps every skill to a distinct error', () => {
    const values = Object.values(SKILL_ERROR);
    expect(new Set(values).size).toBe(9);
    expect(SKILL_ERROR.traps).toBe('trap-missed');
  });
});
