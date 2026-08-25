import { describe, it, expect } from 'vitest';
import { formatEuro } from '$core/money';

describe('formatEuro', () => {
  it('formats euros and cents with comma', () => {
    expect(formatEuro(450)).toBe('4,50 €');
  });
  it('pads cents', () => {
    expect(formatEuro(1005)).toBe('10,05 €');
  });
  it('formats zero', () => {
    expect(formatEuro(0)).toBe('0,00 €');
  });
  it('formats negative', () => {
    expect(formatEuro(-125)).toBe('-1,25 €');
  });
  it('symbol-first variant', () => {
    expect(formatEuro(450, true)).toBe('€ 4,50');
  });
});
