// tests/core/change.test.ts
import { describe, it, expect } from 'vitest';
import { makeChange, canMakeChange, askOptions } from '$core/change';
import { fullTill } from '$core/till';

describe('makeChange', () => {
  it('returns [] for zero', () => {
    expect(makeChange(fullTill(), 0)).toEqual([]);
  });
  it('uses fewest pieces', () => {
    expect(makeChange(fullTill(), 380)).toEqual([200, 100, 50, 20, 10]);
    expect(makeChange(fullTill(), 1500)).toEqual([1000, 500]);
  });
  it('works around missing denominations (non-greedy)', () => {
    // no 1€ coins: 300 = 200 + 50 + 50 must be found
    const till = { 200: 1, 100: 0, 50: 3 };
    expect(makeChange(till, 300)).toEqual([200, 50, 50]);
  });
  it('respects counts', () => {
    expect(makeChange({ 100: 1 }, 200)).toBeNull();
    expect(makeChange({ 100: 2 }, 200)).toEqual([100, 100]);
  });
  it('returns null when impossible', () => {
    expect(makeChange({ 200: 5 }, 150)).toBeNull();
    expect(canMakeChange({ 200: 5 }, 150)).toBe(false);
  });
});

describe('askOptions', () => {
  it('empty when change already makeable', () => {
    expect(askOptions(fullTill(), 100)).toEqual([]);
  });
  it('finds the coin that unlocks change', () => {
    // due 1,00 change, till only has 2€ coins: ask for 1,00 → give 2,00
    const till = { 200: 5 };
    expect(askOptions(till, 100)).toEqual([100]);
  });
  it('lists all unlocking coins ascending', () => {
    // change due 150; till has only 2€: +50c → 200 ✓
    const till = { 200: 5 };
    expect(askOptions(till, 150)).toEqual([50]);
  });
});
