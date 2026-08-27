import { describe, it, expect } from 'vitest';
import { indexAtY } from '../../src/lib/dragsort';

/** Four 40px rows starting at y=100, no gaps. */
const rows = (n = 4, top = 100, h = 40) =>
  Array.from({ length: n }, (_, i) => ({ top: top + i * h, bottom: top + (i + 1) * h }));

describe('indexAtY', () => {
  it('returns the row whose band contains the pointer', () => {
    const r = rows();
    expect(indexAtY(r, 110)).toBe(0);
    expect(indexAtY(r, 150)).toBe(1);
    expect(indexAtY(r, 190)).toBe(2);
    expect(indexAtY(r, 230)).toBe(3);
  });
  it('clamps above the first and below the last row', () => {
    const r = rows();
    expect(indexAtY(r, 0)).toBe(0);
    expect(indexAtY(r, 99)).toBe(0);
    expect(indexAtY(r, 260)).toBe(3);
    expect(indexAtY(r, 10_000)).toBe(3);
  });
  it('lands in the nearer row when the pointer falls in a gap', () => {
    // 30px rows spaced 40px apart: 10px gap after each row
    const r = [
      { top: 0, bottom: 30 },
      { top: 40, bottom: 70 },
    ];
    expect(indexAtY(r, 32)).toBe(0); // gap, nearer the first
    expect(indexAtY(r, 38)).toBe(1); // gap, nearer the second
  });
  it('handles a single row and an empty list', () => {
    expect(indexAtY(rows(1), 10_000)).toBe(0);
    expect(indexAtY([], 50)).toBe(-1);
  });
});
