import { describe, it, expect } from 'vitest';
import { maybeDispute } from '$core/dispute';

const always = () => 0;   // rng below any positive prob
const never = () => 0.999;

describe('maybeDispute', () => {
  it('claims one note step above the largest given note', () => {
    expect(maybeDispute([1000, 50], 1, always)).toEqual({ actualNote: 1000, claimedNote: 2000 });
    expect(maybeDispute([500], 1, always)).toEqual({ actualNote: 500, claimedNote: 1000 });
  });
  it('never fires on a 50 € note', () => {
    expect(maybeDispute([5000], 1, always)).toBeNull();
  });
  it('never fires on coin-only payments', () => {
    expect(maybeDispute([200, 200, 100], 1, always)).toBeNull();
  });
  it('respects probability', () => {
    expect(maybeDispute([1000], 0.5, never)).toBeNull();
    expect(maybeDispute([1000], 0, always)).toBeNull();
  });
});
