import { describe, it, expect } from 'vitest';
import { tipFor, tipEligible } from '../../src/core/tips';

describe('tipFor', () => {
  it('is 10% rounded UP to the 10c grid, min 10c', () => {
    expect(tipFor(400)).toBe(40);
    expect(tipFor(450)).toBe(50);   // 45 → 50
    expect(tipFor(1010)).toBe(110); // 101 → 110
    expect(tipFor(50)).toBe(10);    // 5 → min 10
  });
});

describe('tipEligible', () => {
  const base = { success: true, firstTry: true, usedHint: false, patienceFrac: 0.6 };
  it('requires all four conditions', () => {
    expect(tipEligible(base)).toBe(true);
    expect(tipEligible({ ...base, success: false })).toBe(false);
    expect(tipEligible({ ...base, firstTry: false })).toBe(false);
    expect(tipEligible({ ...base, usedHint: true })).toBe(false);
    expect(tipEligible({ ...base, patienceFrac: 0.49 })).toBe(false);
    expect(tipEligible({ ...base, patienceFrac: 0.5 })).toBe(true);
  });
});
