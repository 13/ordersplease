import { describe, it, expect } from 'vitest';
import { monthGrid } from '../../src/core/calendar';

describe('monthGrid', () => {
  it('August 2026 starts on a Saturday and spans 6 Monday-weeks', () => {
    const g = monthGrid(2026, 7); // Aug 2026: Aug 1 = Saturday
    expect(g[0]).toEqual([null, null, null, null, null, '2026-08-01', '2026-08-02']);
    expect(g.at(-1)![0]).toBe('2026-08-31'); // Aug 31 is a Monday
    expect(g.flat().filter(Boolean)).toHaveLength(31);
  });
  it('February 2024 (leap) has 29 days and starts Thursday', () => {
    const g = monthGrid(2024, 1);
    expect(g.flat().filter(Boolean)).toHaveLength(29);
    expect(g[0][3]).toBe('2024-02-01');
  });
  it('December wraps years cleanly', () => {
    const g = monthGrid(2026, 11);
    expect(g.flat().filter(Boolean)).toHaveLength(31);
    expect(g[0][1]).toBe('2026-12-01'); // Dec 1 2026 is a Tuesday
  });
  it('every row has exactly 7 cells', () => {
    for (const row of monthGrid(2026, 7)) expect(row).toHaveLength(7);
  });
});
