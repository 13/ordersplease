import { describe, it, expect } from 'vitest';
import {
  weekKey, weeklySeed, weeklyLevelFor, nextWeeklyRecord, weeklyShareText, WEEKLY_ORDERS,
} from '../../src/core/weekly';

describe('weekKey', () => {
  it('formats ISO weeks with year wrap handled', () => {
    expect(weekKey(new Date(2026, 7, 26))).toBe('2026-W35');   // Wed Aug 26 2026
    expect(weekKey(new Date(2026, 0, 1))).toBe('2026-W01');    // Thu Jan 1 2026
    expect(weekKey(new Date(2027, 0, 1))).toBe('2026-W53');    // Fri Jan 1 2027 → ISO week 53 of 2026
    expect(weekKey(new Date(2024, 11, 30))).toBe('2025-W01');  // Mon Dec 30 2024 → week 1 of 2025
  });
});

describe('weeklySeed', () => {
  it('is deterministic per week and differs across weeks', () => {
    expect(weeklySeed(new Date(2026, 7, 26))).toBe(weeklySeed(new Date(2026, 7, 24))); // same ISO week (Mon..Wed)
    expect(weeklySeed(new Date(2026, 7, 26))).not.toBe(weeklySeed(new Date(2026, 8, 2)));
  });
});

describe('weeklyLevelFor', () => {
  it('ramps 5 → 30 across the 20 orders', () => {
    expect(weeklyLevelFor(0)).toBe(5);
    expect(weeklyLevelFor(19)).toBe(30);
    expect(weeklyLevelFor(25)).toBe(30); // clamped
    for (let i = 1; i < WEEKLY_ORDERS; i++) {
      expect(weeklyLevelFor(i)).toBeGreaterThanOrEqual(weeklyLevelFor(i - 1));
    }
  });
});

describe('nextWeeklyRecord', () => {
  it('first finish sets the week; better runs update; best is all-time', () => {
    const d = new Date(2026, 7, 26);
    let r = nextWeeklyRecord(null, d, 1000);
    expect(r).toEqual({ week: '2026-W35', score: 1000, best: 1000 });
    r = nextWeeklyRecord(r, d, 800);
    expect(r.score).toBe(1000); // same week, worse run keeps first/best score
    r = nextWeeklyRecord(r, d, 1500);
    expect(r).toEqual({ week: '2026-W35', score: 1500, best: 1500 });
    r = nextWeeklyRecord(r, new Date(2026, 8, 2), 900); // next week
    expect(r).toEqual({ week: '2026-W36', score: 900, best: 1500 });
  });
});

describe('weeklyShareText', () => {
  it('carries the week key, points and served count', () => {
    const s = weeklyShareText(new Date(2026, 7, 26), 4230, 18, 20);
    expect(s).toContain('2026-W35');
    expect(s).toContain('4.230');
    expect(s).toContain('18/20');
  });
});
