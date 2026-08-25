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

import { parseEntry } from '$core/money';

describe('parseEntry (euros-first)', () => {
  it('bare number is euros', () => {
    expect(parseEntry('5')).toBe(500);
    expect(parseEntry('12')).toBe(1200);
  });
  it('comma starts cents, padded to two digits', () => {
    expect(parseEntry('4,5')).toBe(450);
    expect(parseEntry('4,50')).toBe(450);
    expect(parseEntry('0,05')).toBe(5);
    expect(parseEntry('7,')).toBe(700);
  });
  it('empty is zero', () => {
    expect(parseEntry('')).toBe(0);
  });
});
