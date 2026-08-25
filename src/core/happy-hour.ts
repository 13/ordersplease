import type { MenuItem } from './menu';
import type { DifficultyParams } from './difficulty';
import type { SessionState } from './session';

export const HAPPY_HOUR_ROUNDS = 3;

/** 20% off, rounded to the 10c grid, never below 10c. */
export function happyHourPrice(cents: number): number {
  return Math.max(10, Math.round((cents * 0.8) / 10) * 10);
}

export function discountMenu(menu: MenuItem[]): MenuItem[] {
  return menu.map((m) => ({ ...m, priceCents: happyHourPrice(m.priceCents) }));
}

/** Rolled once at session start. Always consumes exactly 2 rng calls. */
export function rollHappyHourStart(
  params: DifficultyParams, rng: () => number,
): number | null {
  const roll = rng();
  const pos = rng();
  if (params.happyHourProb <= 0 || roll >= params.happyHourProb) return null;
  const lo = 2;
  const hi = Math.max(lo, params.ordersPerLevel - 3);
  return lo + Math.floor(pos * (hi - lo + 1));
}

export function happyHourActive(s: SessionState): boolean {
  return s.happyHourStart !== null
    && s.roundsDone >= s.happyHourStart
    && s.roundsDone < s.happyHourStart + HAPPY_HOUR_ROUNDS;
}
