import { describe, it, expect } from 'vitest';
import { paramsForLevel, paramsForRush, MAX_LEVEL } from '$core/difficulty';

describe('difficulty', () => {
  it('level 1 matches spec anchors', () => {
    const p = paramsForLevel(1);
    expect(p.itemsMin).toBe(1);
    expect(p.itemsMax).toBe(2);
    expect(p.priceStyle).toBe('half');
    expect(p.paymentStyle).toBe('exact-or-round');
    expect(p.patienceSeconds).toBe(35);
    expect(p.menuVisibleSeconds).toBeNull();
    expect(p.scarceDenoms).toBe(0);
    expect(p.midOrderChangeProb).toBe(0);
    expect(p.showPileTotal).toBe(true);
    expect(p.ordersPerLevel).toBe(6);
  });
  it('level 30 matches spec anchors', () => {
    const p = paramsForLevel(30);
    expect(p.itemsMax).toBe(7);
    expect(p.priceStyle).toBe('any');
    expect(p.paymentStyle).toBe('awkward');
    expect(p.patienceSeconds).toBe(12);
    expect(p.menuVisibleSeconds).toBe(0);
    expect(p.midOrderChangeProb).toBeCloseTo(0.4);
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
  it('is exactly zero strictly below each entry level', () => {
    expect(paramsForLevel(5).underpayProb).toBe(0);
    expect(paramsForLevel(6).underpayProb).toBeGreaterThan(0);
    expect(paramsForLevel(8).disputeProb).toBe(0);
    expect(paramsForLevel(9).disputeProb).toBeGreaterThan(0);
    expect(paramsForLevel(7).tabProb).toBe(0);
    expect(paramsForLevel(8).tabProb).toBeGreaterThan(0);
    expect(paramsForLevel(10).splitProb).toBe(0);
    expect(paramsForLevel(11).splitProb).toBeGreaterThan(0);
  });
  it('anchors at L6 and L22 per spec', () => {
    const p6 = paramsForLevel(6);
    expect(p6.patienceSeconds).toBe(28);
    expect(p6.ordersPerLevel).toBe(8);
    expect(p6.underpayProb).toBeCloseTo(0.08);
    const p22 = paramsForLevel(22);
    expect(p22.patienceSeconds).toBe(15);
    expect(p22.tabProb).toBeCloseTo(0.25);
  });
  it('L30 endgame', () => {
    const p = paramsForLevel(30);
    expect(p.itemsMax).toBe(7);
    expect(p.patienceSeconds).toBe(12);
    expect(p.scarceDenoms).toBe(4);
    expect(p.midOrderChangeProb).toBeCloseTo(0.4);
    expect(p.underpayProb).toBeCloseTo(0.25);
    expect(p.disputeProb).toBeCloseTo(0.25);
    expect(p.tabProb).toBeCloseTo(0.3);
    expect(p.splitProb).toBeCloseTo(0.25);
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

describe('round-6 mechanic params', () => {
  it('happy hour gates at 12', () => {
    expect(paramsForLevel(11).happyHourProb).toBe(0);
    expect(paramsForLevel(12).happyHourProb).toBeGreaterThan(0);
    expect(paramsForLevel(14).happyHourProb).toBeCloseTo(0.3);
    expect(paramsForLevel(30).happyHourProb).toBeCloseTo(0.5);
  });
  it('rowdy gates at 16', () => {
    expect(paramsForLevel(15).rowdyProb).toBe(0);
    expect(paramsForLevel(16).rowdyProb).toBeGreaterThan(0);
    expect(paramsForLevel(22).rowdyProb).toBeCloseTo(0.1);
    expect(paramsForLevel(30).rowdyProb).toBeCloseTo(0.15);
  });
  it('practice zeroes both', () => {
    for (const s of ['sums', 'traps', 'disputes'] as const) {
      expect(practiceParams(s).happyHourProb).toBe(0);
      expect(practiceParams(s).rowdyProb).toBe(0);
    }
  });
});

describe('levels 31-40', () => {
  it('MAX_LEVEL is 40 and L40 hits the new anchor', () => {
    expect(MAX_LEVEL).toBe(40);
    const p = paramsForLevel(40);
    expect(p.itemsMin).toBe(6);
    expect(p.itemsMax).toBe(8);
    expect(p.patienceSeconds).toBe(10);
    expect(p.ordersPerLevel).toBe(14);
    expect(p.scarceDenoms).toBe(5);
    expect(p.underpayProb).toBeCloseTo(0.3);
    expect(p.disputeProb).toBeCloseTo(0.3);
    expect(p.tabProb).toBeCloseTo(0.35);
    expect(p.splitProb).toBeCloseTo(0.3);
    expect(p.happyHourProb).toBeCloseTo(0.6);
    expect(p.rowdyProb).toBeCloseTo(0.2);
  });
  it('L30 is unchanged and 30→40 interpolates', () => {
    const p30 = paramsForLevel(30);
    expect(p30.ordersPerLevel).toBe(12);
    expect(p30.patienceSeconds).toBe(12);
    const p35 = paramsForLevel(35);
    expect(p35.ordersPerLevel).toBe(13);
    expect(p35.patienceSeconds).toBe(11);
    expect(p35.underpayProb).toBeCloseTo(0.275);
  });
});
