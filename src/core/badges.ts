export const BADGE_IDS = [
  'first-win', 'three-star', 'streak-10', 'trap-caught', 'dispute-won',
  'tab-served', 'split-served', 'level-10', 'level-20', 'level-30',
  'rush-5min', 'daily-7',
  'weekly-first', 'weekly-3', 'level-40', 'tips-10', 'tips-100', 'stars-10', 'rounds-100', 'career-wirt',
] as const;
export type BadgeId = (typeof BADGE_IDS)[number];

export interface BadgeContext {
  mode: 'level' | 'rush' | 'practice' | 'daily' | 'weekly';
  finished: 'won' | 'lost' | null;
  stars: number;
  level: number;
  maxStreak: number;
  trapCaught: boolean;
  disputeWon: boolean;
  tabServed: boolean;
  splitServed: boolean;
  elapsedMs: number;
  dailyStreak: number;
  weeklyWeeks: number;
  lifetimeTips: number;
  lifetimeRounds: number;
  threeStarLevels: number;
  titleRank: number;
}

/** Newly earned badges for a finished session. Pure and deterministic. */
export function newBadges(ctx: BadgeContext, owned: readonly string[]): BadgeId[] {
  const earned = new Set<BadgeId>();
  const levelWon = ctx.mode === 'level' && ctx.finished === 'won';
  const anyWin = levelWon
    || ((ctx.mode === 'daily' || ctx.mode === 'weekly') && ctx.finished === 'won')
    || (ctx.mode === 'rush' && ctx.maxStreak >= 1);

  if (anyWin && ctx.mode !== 'practice') earned.add('first-win');
  if (levelWon && ctx.stars === 3) earned.add('three-star');
  if (ctx.maxStreak >= 10) earned.add('streak-10');
  if (ctx.trapCaught) earned.add('trap-caught');
  if (ctx.disputeWon) earned.add('dispute-won');
  if (ctx.tabServed) earned.add('tab-served');
  if (ctx.splitServed) earned.add('split-served');
  if (levelWon && ctx.level >= 10) earned.add('level-10');
  if (levelWon && ctx.level >= 20) earned.add('level-20');
  if (levelWon && ctx.level >= 30) earned.add('level-30');
  if (ctx.mode === 'rush' && ctx.elapsedMs >= 300_000) earned.add('rush-5min');
  if (ctx.dailyStreak >= 7) earned.add('daily-7');

  // Career badges (13-20)
  if (ctx.mode === 'weekly' && ctx.finished !== null) earned.add('weekly-first');
  if (ctx.weeklyWeeks >= 3 && ctx.mode !== 'practice') earned.add('weekly-3');
  if (levelWon && ctx.level >= 40) earned.add('level-40');
  if (ctx.lifetimeTips >= 1000) earned.add('tips-10');
  if (ctx.lifetimeTips >= 10000) earned.add('tips-100');
  if (ctx.threeStarLevels >= 10 && ctx.mode !== 'practice') earned.add('stars-10');
  if (ctx.lifetimeRounds >= 100) earned.add('rounds-100');
  if (ctx.titleRank >= 3 && ctx.mode !== 'practice') earned.add('career-wirt');

  return [...earned].filter((id) => !owned.includes(id));
}
