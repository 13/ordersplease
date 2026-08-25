import { describe, it, expect } from 'vitest';
import { recordRound, recordDay, dayStreak, EMPTY, type Stats } from '../../src/stores/stats';

const empty: Stats = {
  errors: { 'sum-wrong': 0, 'change-wrong': 0, 'shortage-missed': 0, 'parse-wrong': 0, timeout: 0, 'trap-missed': 0, 'dispute-wrong': 0, 'tab-wrong': 0, 'split-wrong': 0 },
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
    s = recordDay(s, new Date('2026-08-23T12:00:00'));
    s = recordDay(s, new Date('2026-08-24T12:00:00'));
    s = recordDay(s, new Date('2026-08-25T12:00:00'));
    expect(dayStreak(s, new Date('2026-08-25T12:00:00'))).toBe(3);
  });
  it('gap breaks the streak', () => {
    let s = empty;
    s = recordDay(s, new Date('2026-08-20T12:00:00'));
    s = recordDay(s, new Date('2026-08-25T12:00:00'));
    expect(dayStreak(s, new Date('2026-08-25T12:00:00'))).toBe(1);
  });
  it('streak survives when today has not been played yet', () => {
    let s = empty;
    s = recordDay(s, new Date('2026-08-23T12:00:00'));
    s = recordDay(s, new Date('2026-08-24T12:00:00'));
    expect(dayStreak(s, new Date('2026-08-25T12:00:00'))).toBe(2);
  });
});

describe('round-2 stats', () => {
  it('EMPTY is exported and has all 9 error keys at 0', () => {
    expect(Object.keys(EMPTY.errors).sort()).toEqual([
      'change-wrong', 'dispute-wrong', 'parse-wrong', 'shortage-missed',
      'split-wrong', 'sum-wrong', 'tab-wrong', 'timeout', 'trap-missed',
    ]);
  });
  it('recordRound tolerates legacy stats missing new keys', () => {
    const legacy = {
      ...empty,
      errors: { 'sum-wrong': 2, 'change-wrong': 0, 'shortage-missed': 0, 'parse-wrong': 0, timeout: 1 },
    } as unknown as typeof empty;
    const s = recordRound(legacy, ['trap-missed'], 1000, true);
    expect(s.errors['trap-missed']).toBe(1);
    expect(s.errors['sum-wrong']).toBe(2);
  });
});
