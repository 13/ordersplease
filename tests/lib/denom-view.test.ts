import { describe, it, expect } from 'vitest';
import { denomLabel, isNote } from '../../src/lib/denom-view';

describe('denom-view', () => {
  it('labels notes and coins', () => {
    expect(denomLabel(5000)).toBe('50 €');
    expect(denomLabel(500)).toBe('5 €');
    expect(denomLabel(200)).toBe('2 €');
    expect(denomLabel(50)).toBe('50c');
    expect(denomLabel(5)).toBe('5c');
  });
  it('classifies notes', () => {
    expect(isNote(500)).toBe(true);
    expect(isNote(200)).toBe(false);
  });
});
