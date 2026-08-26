export const WEEKLY_ORDERS = 20;

/** ISO-8601 week: Thursday of the current week determines the week-year. */
export function weekKey(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - day + 3); // this week's Thursday
  const weekYear = d.getFullYear();
  const jan4 = new Date(weekYear, 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7;
  const week1Mon = new Date(weekYear, 0, 4 - jan4Day);
  const week = 1 + Math.round((d.getTime() - week1Mon.getTime()) / (7 * 86400000));
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}

export function weeklySeed(date: Date): number {
  const key = weekKey(date);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** Virtual difficulty for order index 0..19: 5 → 30. */
export function weeklyLevelFor(roundIndex: number): number {
  return Math.min(30, 5 + Math.floor((Math.min(roundIndex, WEEKLY_ORDERS - 1) * 25) / (WEEKLY_ORDERS - 1)));
}

export interface WeeklyRecord { week: string; score: number; best: number }

export function nextWeeklyRecord(
  prev: WeeklyRecord | null, date: Date, score: number,
): WeeklyRecord {
  const week = weekKey(date);
  const best = Math.max(prev?.best ?? 0, score);
  if (prev && prev.week === week) {
    return { week, score: Math.max(prev.score, score), best };
  }
  return { week, score, best };
}

function formatPts(score: number): string {
  return String(score).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function weeklyShareText(
  date: Date, score: number, served: number, total: number,
): string {
  const check = served === total ? ' ✓' : '';
  return `Orders, Please ${weekKey(date)} — ${formatPts(score)} pts · ${served}/${total}${check}`;
}
