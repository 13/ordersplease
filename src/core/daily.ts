export const DAILY_ORDERS = 10;

export function dailySeed(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export function dailyKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Virtual difficulty level for order index 0..9: 5 → 25 linear. */
export function dailyLevelFor(roundIndex: number): number {
  return 5 + Math.min(roundIndex, DAILY_ORDERS - 1) * (20 / (DAILY_ORDERS - 1));
}

export interface DailyRecord {
  date: string;
  score: number;
  perfect: boolean;
  attempts: number;
  streak: number;
}

export function isRanked(prev: DailyRecord | null, date: Date): boolean {
  return prev === null || prev.date !== dailyKey(date);
}

export function nextDailyRecord(
  prev: DailyRecord | null, date: Date, score: number, perfect: boolean,
): DailyRecord {
  const key = dailyKey(date);
  if (prev && prev.date === key) {
    return { ...prev, attempts: prev.attempts + 1 }; // unranked replay
  }
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const streak = prev && prev.date === dailyKey(yesterday) ? prev.streak + 1 : 1;
  return { date: key, score, perfect, attempts: 1, streak };
}

function formatPts(score: number): string {
  // locale-independent thousands dot: 3450 → "3.450"
  return String(score).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function shareText(
  date: Date, score: number, served: number, total: number, streak: number,
): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const check = served === total ? ` ✓` : '';
  return `Orders, Please ${day}.${month}. — ${formatPts(score)} pts · ${served}/${total}${check} · 🔥${streak}`;
}
