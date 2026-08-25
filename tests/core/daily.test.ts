import { describe, it, expect } from 'vitest';
import {
  dailySeed, dailyKey, dailyLevelFor, DAILY_ORDERS,
  isRanked, nextDailyRecord, shareText, type DailyRecord,
} from '$core/daily';

const d25 = new Date('2026-08-25T12:00:00');
const d26 = new Date('2026-08-26T12:00:00');

describe('daily seed and curve', () => {
  it('seed is local yyyymmdd', () => {
    expect(dailySeed(d25)).toBe(20260825);
    expect(dailyKey(d25)).toBe('2026-08-25');
  });
  it('same date → same seed, different date → different', () => {
    expect(dailySeed(d25)).toBe(dailySeed(new Date('2026-08-25T23:00:00')));
    expect(dailySeed(d25)).not.toBe(dailySeed(d26));
  });
  it('level curve ramps 5 → 25 over the 10 orders', () => {
    expect(dailyLevelFor(0)).toBe(5);
    expect(dailyLevelFor(DAILY_ORDERS - 1)).toBe(25);
    for (let i = 1; i < DAILY_ORDERS; i++) {
      expect(dailyLevelFor(i)).toBeGreaterThan(dailyLevelFor(i - 1));
    }
  });
});

describe('daily record', () => {
  it('first attempt of a day is ranked and starts/extends the streak', () => {
    expect(isRanked(null, d25)).toBe(true);
    const first = nextDailyRecord(null, d25, 3000, true);
    expect(first).toEqual({ date: '2026-08-25', score: 3000, perfect: true, attempts: 1, streak: 1 });
    const next = nextDailyRecord(first, d26, 2000, false);
    expect(next.streak).toBe(2);
    expect(next.score).toBe(2000);
    expect(next.attempts).toBe(1);
  });
  it('replays on the same day are unranked: score kept, attempts counted', () => {
    const first = nextDailyRecord(null, d25, 3000, true);
    expect(isRanked(first, d25)).toBe(false);
    const replay = nextDailyRecord(first, d25, 9999, false);
    expect(replay.score).toBe(3000);
    expect(replay.perfect).toBe(true);
    expect(replay.attempts).toBe(2);
    expect(replay.streak).toBe(1);
  });
  it('a skipped day resets the streak', () => {
    const first = nextDailyRecord(null, d25, 3000, true);
    const later = nextDailyRecord(first, new Date('2026-08-28T12:00:00'), 1000, false);
    expect(later.streak).toBe(1);
  });
});

describe('shareText', () => {
  it('formats score, served count and streak', () => {
    expect(shareText(d25, 3450, 10, 10, 4)).toBe('Orders, Please 25.08. — 3.450 pts · 10/10 ✓ · 🔥4');
    expect(shareText(d25, 900, 7, 10, 1)).toBe('Orders, Please 25.08. — 900 pts · 7/10 · 🔥1');
  });
});
