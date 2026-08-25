import { describe, it, expect } from 'vitest';
import { scoreRound, streakMultiplier, starsFor, maxRoundScore } from '$core/scoring';

describe('scoring', () => {
  it('failed round scores zero', () => {
    expect(scoreRound({ success: false, firstTry: false, usedAsk: false, patienceFrac: 1, streakBefore: 5 })).toBe(0);
  });
  it('perfect fast round: 100 * 3 * 1.5 = 450', () => {
    expect(scoreRound({ success: true, firstTry: true, usedAsk: false, patienceFrac: 1, streakBefore: 0 })).toBe(450);
    expect(maxRoundScore()).toBe(450);
  });
  it('slow non-first-try round: base only', () => {
    expect(scoreRound({ success: true, firstTry: false, usedAsk: false, patienceFrac: 0, streakBefore: 0 })).toBe(100);
  });
  it('ask bonus adds 50', () => {
    expect(scoreRound({ success: true, firstTry: true, usedAsk: true, patienceFrac: 1, streakBefore: 0 })).toBe(500);
  });
  it('streak multiplier grows 10% per round, caps at 2x', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(5)).toBeCloseTo(1.5);
    expect(streakMultiplier(20)).toBe(2);
    expect(scoreRound({ success: true, firstTry: true, usedAsk: false, patienceFrac: 1, streakBefore: 10 })).toBe(900);
  });
  it('stars thresholds', () => {
    const orders = 10; // perfect = 4500
    expect(starsFor(4200, orders)).toBe(3); // ≥ 90%
    expect(starsFor(3200, orders)).toBe(2); // ≥ 70%
    expect(starsFor(1000, orders)).toBe(1);
  });
  it('trap-call bonus adds 50 like the ask bonus', () => {
    expect(scoreRound({
      success: true, firstTry: true, usedAsk: false, usedTrapCall: true,
      patienceFrac: 1, streakBefore: 0,
    })).toBe(500);
  });
  it('ask and trap bonuses stack to +100', () => {
    expect(scoreRound({
      success: true, firstTry: true, usedAsk: true, usedTrapCall: true,
      patienceFrac: 1, streakBefore: 0,
    })).toBe(550);
  });
});
