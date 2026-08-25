import { describe, it, expect } from 'vitest';
import { recordRound, recordDay, dayStreak, type Stats } from '../../src/stores/stats';

const empty: Stats = {
  errors: { 'sum-wrong': 0, 'change-wrong': 0, 'shortage-missed': 0, 'parse-wrong': 0, timeout: 0 },
  rounds: 0, roundsFailed: 0, totalMs: 0, days: {}, rushHigh: 0,
};

describe('stats', () => {
  it('recordRound counts errors and time', () => {
    const s = recordRound(empty, ['sum-wrong', 'parse-wrong'], 4200, true);
    expect(s.errors['sum-wrong']).toBe(1);
    expect(s.errors['parse-wrong']).toBe(1);
    expect(s.rounds).toBe(1);
    expect(s.roundsFailed).toBe(1);
    expect(s.totalMs).toBe(4200);
  });
  it('dayStreak counts consecutive days ending today', () => {
    let s = empty;
    s = recordDay(s, new Date('2026-08-23'));
    s = recordDay(s, new Date('2026-08-24'));
    s = recordDay(s, new Date('2026-08-25'));
    expect(dayStreak(s, new Date('2026-08-25'))).toBe(3);
  });
  it('gap breaks the streak', () => {
    let s = empty;
    s = recordDay(s, new Date('2026-08-20'));
    s = recordDay(s, new Date('2026-08-25'));
    expect(dayStreak(s, new Date('2026-08-25'))).toBe(1);
  });
});
