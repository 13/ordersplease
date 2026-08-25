import { persisted } from './persisted';
import type { RoundError } from '$core/round';

export interface Stats {
  errors: Record<RoundError, number>;
  rounds: number;
  roundsFailed: number;
  totalMs: number;
  days: Record<string, true>;
  rushHigh: number;
  tipsEarnedCents?: number;
}

export const EMPTY: Stats = {
  errors: {
    'sum-wrong': 0, 'change-wrong': 0, 'shortage-missed': 0, 'parse-wrong': 0, timeout: 0,
    'trap-missed': 0, 'dispute-wrong': 0, 'tab-wrong': 0, 'split-wrong': 0,
  },
  rounds: 0, roundsFailed: 0, totalMs: 0, days: {}, rushHigh: 0, tipsEarnedCents: 0,
};

export const stats = persisted<Stats>('op.stats', EMPTY);

export function recordRound(s: Stats, errors: RoundError[], ms: number, failed: boolean): Stats {
  const e = { ...s.errors };
  for (const err of errors) e[err] = (e[err] ?? 0) + 1;
  return {
    ...s, errors: e,
    rounds: s.rounds + 1,
    roundsFailed: s.roundsFailed + (failed ? 1 : 0),
    totalMs: s.totalMs + ms,
  };
}

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function recordDay(s: Stats, date: Date): Stats {
  return { ...s, days: { ...s.days, [dayKey(date)]: true } };
}

export function dayStreak(s: Stats, today: Date): number {
  const d = new Date(today);
  // streak counts from yesterday when today has not been played yet
  if (!s.days[dayKey(d)]) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (s.days[dayKey(d)]) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function recordTips(s: Stats, cents: number): Stats {
  return { ...s, tipsEarnedCents: (s.tipsEarnedCents ?? 0) + cents };
}
