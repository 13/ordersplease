import { persisted } from './persisted';

export interface DayEntry { rounds: number; correct: number; ms: number; tips: number }
export type History = Record<string, DayEntry>;

export const history = persisted<History>('op.history', {});

export function localDayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function recordDayEntry(h: History, key: string, delta: DayEntry): History {
  const prev = h[key] ?? { rounds: 0, correct: 0, ms: 0, tips: 0 };
  return {
    ...h,
    [key]: {
      rounds: prev.rounds + delta.rounds,
      correct: prev.correct + delta.correct,
      ms: prev.ms + delta.ms,
      tips: prev.tips + delta.tips,
    },
  };
}

/** Day keys sort lexicographically, so a string cutoff comparison is exact. */
export function pruneHistory(h: History, todayKey: string, keepDays = 60): History {
  const [y, m, d] = todayKey.split('-').map(Number);
  const cutoff = new Date(y, m - 1, d);
  cutoff.setDate(cutoff.getDate() - keepDays);
  const cutoffKey = localDayKey(cutoff);
  const out: History = {};
  for (const [k, v] of Object.entries(h)) if (k >= cutoffKey) out[k] = v;
  return out;
}
