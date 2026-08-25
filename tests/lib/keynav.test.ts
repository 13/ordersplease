import { describe, it, expect } from 'vitest';
import { nextIndex } from '../../src/lib/keynav';

const en = (n: number, disabledFrom = n) =>
  Array.from({ length: n }, (_, i) => i < disabledFrom);

describe('nextIndex', () => {
  it('moves right/left/down/up on a fully enabled grid', () => {
    const g = en(10); // 5 cols, 2 rows
    expect(nextIndex(g, 0, 'ArrowRight', 5)).toBe(1);
    expect(nextIndex(g, 1, 'ArrowLeft', 5)).toBe(0);
    expect(nextIndex(g, 2, 'ArrowDown', 5)).toBe(7);
    expect(nextIndex(g, 7, 'ArrowUp', 5)).toBe(2);
  });
  it('skips disabled targets in the same direction', () => {
    const g = [true, false, false, true];
    expect(nextIndex(g, 0, 'ArrowRight', 4)).toBe(3);
  });
  it('levels-map case: Down from row 1 clamps to the last enabled button', () => {
    // 30 cells, 5 cols, only first 3 unlocked
    const g = en(30, 3);
    expect(nextIndex(g, 0, 'ArrowDown', 5)).toBe(2);
    expect(nextIndex(g, 2, 'ArrowDown', 5)).toBe(null); // already at the last enabled
  });
  it('Up clamps toward the first enabled button', () => {
    const g = en(30, 3);
    expect(nextIndex(g, 2, 'ArrowUp', 5)).toBe(0); // -5 off-grid → clamp direction up
  });
  it('Home/End jump to first/last enabled', () => {
    const g = [false, true, true, false];
    expect(nextIndex(g, 2, 'Home', 1)).toBe(1);
    expect(nextIndex(g, 1, 'End', 1)).toBe(2);
  });
  it('null when nothing to do', () => {
    expect(nextIndex([true], 0, 'ArrowRight', 1)).toBe(null);
    expect(nextIndex([], 0, 'ArrowDown', 1)).toBe(null);
    expect(nextIndex([true, true], 5, 'ArrowLeft', 1)).toBe(null); // out-of-range current
  });
});
