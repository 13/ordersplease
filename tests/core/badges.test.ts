import { describe, it, expect } from 'vitest';
import { newBadges, BADGE_IDS, type BadgeContext } from '$core/badges';

const base: BadgeContext = {
  mode: 'level', finished: 'lost', stars: 0, level: 1, maxStreak: 0,
  trapCaught: false, disputeWon: false, tabServed: false, splitServed: false,
  elapsedMs: 0, dailyStreak: 0,
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
