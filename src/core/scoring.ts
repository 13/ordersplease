export interface RoundScoreInput {
  success: boolean;
  firstTry: boolean;
  usedAsk: boolean;
  patienceFrac: number;
  streakBefore: number;
}

const BASE = 100;
const FIRST_TRY_BONUS = 1.5;
const ASK_BONUS = 50;

export function streakMultiplier(streak: number): number {
  return Math.min(1 + 0.1 * streak, 2);
}

export function scoreRound(i: RoundScoreInput): number {
  if (!i.success) return 0;
  const speed = 1 + 2 * Math.min(Math.max(i.patienceFrac, 0), 1);
  const firstTry = i.firstTry ? FIRST_TRY_BONUS : 1;
  const raw = BASE * speed * firstTry * streakMultiplier(i.streakBefore);
  return Math.round(raw) + (i.usedAsk ? ASK_BONUS : 0);
}

export function maxRoundScore(): number {
  return BASE * 3 * FIRST_TRY_BONUS;
}

export function starsFor(totalScore: number, orders: number): 1 | 2 | 3 {
  const perfect = orders * maxRoundScore();
  if (totalScore >= 0.9 * perfect) return 3;
  if (totalScore >= 0.7 * perfect) return 2;
  return 1;
}
