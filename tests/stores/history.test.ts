import { describe, it, expect } from 'vitest';
import {
  localDayKey, recordDayEntry, pruneHistory, type History,
} from '../../src/stores/history';

describe('history', () => {
  it('localDayKey formats local yyyy-mm-dd', () => {
    expect(localDayKey(new Date(2026, 7, 25))).toBe('2026-08-25');
    expect(localDayKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
  it('recordDayEntry accumulates into the day', () => {
    let h: History = {};
    h = recordDayEntry(h, '2026-08-25', { rounds: 6, correct: 5, ms: 60000, tips: 40 });
    h = recordDayEntry(h, '2026-08-25', { rounds: 4, correct: 4, ms: 30000, tips: 0 });
    expect(h['2026-08-25']).toEqual({ rounds: 10, correct: 9, ms: 90000, tips: 40 });
  });
  it('pruneHistory drops entries older than keepDays', () => {
    const h: History = {
      '2026-08-25': { rounds: 1, correct: 1, ms: 1, tips: 0 },
      '2026-06-01': { rounds: 1, correct: 1, ms: 1, tips: 0 }, // 85 days before
      '2026-07-01': { rounds: 1, correct: 1, ms: 1, tips: 0 }, // 55 days before
    };
    const pruned = pruneHistory(h, '2026-08-25', 60);
    expect(pruned['2026-06-01']).toBeUndefined();
    expect(pruned['2026-07-01']).toBeDefined();
    expect(pruned['2026-08-25']).toBeDefined();
    expect(pruneHistory(pruned, '2026-08-25', 60)).toEqual(pruned); // idempotent
  });
});
