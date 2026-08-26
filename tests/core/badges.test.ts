import { describe, it, expect } from 'vitest';
import { newBadges, BADGE_IDS, type BadgeContext } from '$core/badges';

const base: BadgeContext = {
  mode: 'level', finished: 'lost', stars: 0, level: 1, maxStreak: 0,
  trapCaught: false, disputeWon: false, tabServed: false, splitServed: false,
  elapsedMs: 0, dailyStreak: 0,
  weeklyWeeks: 0, lifetimeTips: 0, lifetimeRounds: 0, threeStarLevels: 0, titleRank: 0,
};

describe('newBadges', () => {
  it('first win and three-star', () => {
    const got = newBadges({ ...base, finished: 'won', stars: 3 }, []);
    expect(got).toContain('first-win');
    expect(got).toContain('three-star');
  });
  it('level milestones need a WIN at that level', () => {
    expect(newBadges({ ...base, finished: 'won', level: 20 }, [])).toContain('level-20');
    expect(newBadges({ ...base, finished: 'lost', level: 20 }, [])).not.toContain('level-20');
  });
  it('mechanic badges fire regardless of outcome, even in practice', () => {
    const got = newBadges({ ...base, mode: 'practice', trapCaught: true, maxStreak: 10 }, []);
    expect(got).toContain('trap-caught');
    expect(got).toContain('streak-10');
    expect(got).not.toContain('first-win');
  });
  it('rush badges', () => {
    const got = newBadges({ ...base, mode: 'rush', finished: 'lost', elapsedMs: 300000, stars: 0 }, []);
    expect(got).toContain('rush-5min');
  });
  it('rush with at least one served customer counts as a first win', () => {
    expect(newBadges({ ...base, mode: 'rush', finished: 'lost', elapsedMs: 1000, maxStreak: 1 }, []))
      .toContain('first-win');
    expect(newBadges({ ...base, mode: 'rush', finished: 'lost', elapsedMs: 1000, maxStreak: 0 }, []))
      .not.toContain('first-win');
  });
  it('daily badge', () => {
    expect(newBadges({ ...base, mode: 'daily', finished: 'won', dailyStreak: 7 }, [])).toContain('daily-7');
  });
  it('owned badges are filtered and ids are unique', () => {
    const all = newBadges({ ...base, finished: 'won', stars: 3, level: 30, maxStreak: 10,
      trapCaught: true, disputeWon: true, tabServed: true, splitServed: true,
      elapsedMs: 400000, dailyStreak: 8, mode: 'level' }, ['first-win']);
    expect(all).not.toContain('first-win');
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(BADGE_IDS).toContain(id);
  });
});

describe('new career badges (13-20)', () => {
  it('BADGE_IDS has 20 entries with original 12 first', () => {
    expect(BADGE_IDS.length).toBe(20);
    const original = ['first-win', 'three-star', 'streak-10', 'trap-caught', 'dispute-won',
      'tab-served', 'split-served', 'level-10', 'level-20', 'level-30',
      'rush-5min', 'daily-7'];
    expect(BADGE_IDS.slice(0, 12)).toEqual(original);
  });

  it('weekly-first fires only in weekly mode with finished !== null', () => {
    expect(newBadges({ ...base, mode: 'weekly', finished: 'won' }, [])).toContain('weekly-first');
    expect(newBadges({ ...base, mode: 'weekly', finished: 'lost' }, [])).toContain('weekly-first');
    expect(newBadges({ ...base, mode: 'weekly', finished: null }, [])).not.toContain('weekly-first');
    expect(newBadges({ ...base, mode: 'level', finished: 'won' }, [])).not.toContain('weekly-first');
    expect(newBadges({ ...base, mode: 'practice', finished: 'won' }, [])).not.toContain('weekly-first');
  });

  it('weekly-3 fires when weeklyWeeks >= 3 but not in practice', () => {
    expect(newBadges({ ...base, mode: 'level', weeklyWeeks: 3 }, [])).toContain('weekly-3');
    expect(newBadges({ ...base, mode: 'level', weeklyWeeks: 2 }, [])).not.toContain('weekly-3');
    expect(newBadges({ ...base, mode: 'practice', weeklyWeeks: 3 }, [])).not.toContain('weekly-3');
  });

  it('level-40 fires only for level-mode win at level >= 40', () => {
    expect(newBadges({ ...base, mode: 'level', finished: 'won', level: 40 }, [])).toContain('level-40');
    expect(newBadges({ ...base, mode: 'level', finished: 'won', level: 50 }, [])).toContain('level-40');
    expect(newBadges({ ...base, mode: 'level', finished: 'won', level: 39 }, [])).not.toContain('level-40');
    expect(newBadges({ ...base, mode: 'level', finished: 'lost', level: 40 }, [])).not.toContain('level-40');
    expect(newBadges({ ...base, mode: 'rush', finished: 'won', level: 40 }, [])).not.toContain('level-40');
    expect(newBadges({ ...base, mode: 'practice', finished: 'won', level: 40 }, [])).not.toContain('level-40');
  });

  it('tips-10 fires at lifetimeTips >= 1000, including practice', () => {
    expect(newBadges({ ...base, lifetimeTips: 1000 }, [])).toContain('tips-10');
    expect(newBadges({ ...base, lifetimeTips: 2000 }, [])).toContain('tips-10');
    expect(newBadges({ ...base, lifetimeTips: 999 }, [])).not.toContain('tips-10');
    expect(newBadges({ ...base, mode: 'practice', lifetimeTips: 1000 }, [])).toContain('tips-10');
  });

  it('tips-100 fires at lifetimeTips >= 10000, including practice', () => {
    expect(newBadges({ ...base, lifetimeTips: 10000 }, [])).toContain('tips-100');
    expect(newBadges({ ...base, lifetimeTips: 20000 }, [])).toContain('tips-100');
    expect(newBadges({ ...base, lifetimeTips: 9999 }, [])).not.toContain('tips-100');
    expect(newBadges({ ...base, mode: 'practice', lifetimeTips: 10000 }, [])).toContain('tips-100');
  });

  it('stars-10 fires at threeStarLevels >= 10 but not in practice', () => {
    expect(newBadges({ ...base, threeStarLevels: 10 }, [])).toContain('stars-10');
    expect(newBadges({ ...base, threeStarLevels: 15 }, [])).toContain('stars-10');
    expect(newBadges({ ...base, threeStarLevels: 9 }, [])).not.toContain('stars-10');
    expect(newBadges({ ...base, mode: 'practice', threeStarLevels: 10 }, [])).not.toContain('stars-10');
  });

  it('rounds-100 fires at lifetimeRounds >= 100, including practice', () => {
    expect(newBadges({ ...base, lifetimeRounds: 100 }, [])).toContain('rounds-100');
    expect(newBadges({ ...base, lifetimeRounds: 150 }, [])).toContain('rounds-100');
    expect(newBadges({ ...base, lifetimeRounds: 99 }, [])).not.toContain('rounds-100');
    expect(newBadges({ ...base, mode: 'practice', lifetimeRounds: 100 }, [])).toContain('rounds-100');
  });

  it('career-wirt fires at titleRank >= 3 but not in practice', () => {
    expect(newBadges({ ...base, titleRank: 3 }, [])).toContain('career-wirt');
    expect(newBadges({ ...base, titleRank: 4 }, [])).toContain('career-wirt');
    expect(newBadges({ ...base, titleRank: 2 }, [])).not.toContain('career-wirt');
    expect(newBadges({ ...base, mode: 'practice', titleRank: 3 }, [])).not.toContain('career-wirt');
  });

  it('owned filtering still works across all 20 badges', () => {
    const all = newBadges({
      ...base, mode: 'weekly', finished: 'won', weeklyWeeks: 3, level: 40,
      lifetimeTips: 10000, threeStarLevels: 10, lifetimeRounds: 100, titleRank: 3,
    }, ['weekly-first', 'tips-100']);
    expect(all).not.toContain('weekly-first');
    expect(all).not.toContain('tips-100');
    expect(all).toContain('weekly-3');
  });
});
