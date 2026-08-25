import { persisted } from './persisted';
import type { RoundError } from '$core/round';

export interface Stats {
  errors: Record<RoundError, number>;
  rounds: number;
  roundsFailed: number;
  totalMs: number;
  days: Record<string, true>;
  rushHigh: number;
}

const EMPTY: Stats = {
  errors: { 'sum-wrong': 0, 'change-wrong': 0, 'shortage-missed': 0, 'parse-wrong': 0, timeout: 0 },
  rounds: 0, roundsFailed: 0, totalMs: 0, days: {}, rushHigh: 0,
};

export const stats = persisted<Stats>('op.stats', EMPTY);

export function recordRound(s: Stats, errors: RoundError[], ms: number, failed: boolean): Stats {
  const e = { ...s.errors };
  for (const err of errors) e[err] += 1;
  return {
    ...s, errors: e,
    rounds: s.rounds + 1,
    roundsFailed: s.roundsFailed + (failed ? 1 : 0),
    totalMs: s.totalMs + ms,
  };
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function recordDay(s: Stats, date: Date): Stats {
  return { ...s, days: { ...s.days, [dayKey(date)]: true } };
}

export function dayStreak(s: Stats, today: Date): number {
  let streak = 0;
  const d = new Date(today);
  while (s.days[dayKey(d)]) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
