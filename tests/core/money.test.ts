import { describe, it, expect } from 'vitest';
import { formatEuro, parseEuro } from '$core/money';

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

describe('parseEuro', () => {
  it('parses comma and dot decimals', () => {
    expect(parseEuro('4,50')).toBe(450);
    expect(parseEuro('4.50')).toBe(450);
    expect(parseEuro('4')).toBe(400);
    expect(parseEuro(' 2,5 ')).toBe(250);
  });
  it('rejects junk', () => {
    expect(parseEuro('')).toBeNull();
    expect(parseEuro('abc')).toBeNull();
    expect(parseEuro('-4')).toBeNull();
    expect(parseEuro('4,555')).toBeNull();
  });
});
