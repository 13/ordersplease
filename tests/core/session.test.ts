import { describe, it, expect } from 'vitest';
import {
  createSession, tickSession, completeRound, spawnCustomer, patienceFrac, MAX_LIVES,
} from '$core/session';
import { DEFAULT_MENU } from '$core/menu';
import { createRound, submitSum, submitChange, timeoutRound } from '$core/round';
import type { DifficultyParams } from '$core/difficulty';
import { paramsForLevel } from '$core/difficulty';
import { completeSubRound } from '$core/session';
import { dailyLevelFor } from '$core/daily';

function freshSession(level = 1) {
  return createSession('level', level, DEFAULT_MENU, false, 42);
}

function winRound(s: ReturnType<typeof freshSession>) {
  // craft a trivially winnable round against the session till
  const beer = s.menu[0];
  const order = { lines: [{ item: beer, qty: 1 }], totalCents: beer.priceCents };
  let r = createRound(order, [beer.priceCents === 400 ? 500 : 5000], s.till);
  r = submitSum(r, order.totalCents);
  const change = r.changeDue;
  // level 1 default menu: beer 400, paid 500 → change 100
  r = submitChange(r, change === 0 ? [] : [change]);
  expect(r.success).toBe(true);
  return r;
}

describe('createSession', () => {
  it('level 1: full till, one customer, round-price menu', () => {
    const s = freshSession();
    expect(s.queue.length).toBe(1);
    expect(s.till[5]).toBeGreaterThan(0);
    for (const m of s.menu) expect(m.priceCents % 50).toBe(0);
  });
  it('custom menu prices untouched', () => {
    const s = createSession('level', 1, [{ id: 'x', name: 'X', priceCents: 435 }], true, 1);
    expect(s.menu[0].priceCents).toBe(435);
  });
});

describe('tickSession', () => {
  it('drains head patience and expires customers at cost of a life', () => {
    let s = freshSession();
    const max = s.queue[0].maxPatienceMs;
    s = tickSession(s, 1000);
    expect(s.queue[0].patienceMs).toBe(max - 1000);
    s = tickSession(s, max);
    expect(s.queue.length).toBe(0);
    expect(s.livesLost).toBe(1);
  });
  it('three lost lives finish the session as lost', () => {
    let s = freshSession();
    for (let i = 0; i < MAX_LIVES; i++) {
      s = spawnCustomer(s);
      s = tickSession(s, 10_000_000);
    }
    expect(s.finished).toBe('lost');
  });
  it('rush spawns over time and unserved customers end the night', () => {
    let s = createSession('rush', 1, DEFAULT_MENU, false, 7);
    // spawn fires at most once per tick, so walk the clock in minute steps
    for (let i = 0; i < 50 && !s.finished; i++) s = tickSession(s, 60_000);
    expect(s.finished).toBe('lost'); // everyone walked out eventually
  });
});

describe('completeRound', () => {
  it('successful round: score up, streak up, round counted, till updated', () => {
    let s = freshSession();
    const r = winRound(s);
    s = completeRound(s, r, { orderText: 'x', ms: 1000 });
    expect(s.score).toBeGreaterThan(0);
    expect(s.streak).toBe(1);
    expect(s.roundsDone).toBe(1);
    expect(s.queue.length).toBe(0);
    expect(s.till).toEqual(r.till);
  });
  it('failed round: life lost, streak reset, till unchanged', () => {
    let s = freshSession();
    const tillBefore = s.till;
    const r = timeoutRound(createRound(
      { lines: [{ item: s.menu[0], qty: 1 }], totalCents: s.menu[0].priceCents },
      [500], s.till,
    ));
    s = completeRound(s, r, { orderText: 'x', ms: 1000 });
    expect(s.livesLost).toBe(1);
    expect(s.streak).toBe(0);
    expect(s.till).toEqual(tillBefore);
  });
  it('level completes as won after ordersPerLevel rounds', () => {
    let s = freshSession();
    for (let i = 0; i < s.params.ordersPerLevel; i++) {
      if (s.queue.length === 0) s = spawnCustomer(s);
      s = completeRound(s, winRound(s), { orderText: 'x', ms: 1000 });
    }
    expect(s.finished).toBe('won');
  });
});

describe('round log', () => {
  it('completeRound appends a log entry with the gained score', () => {
    let s = freshSession();
    const r = winRound(s);
    s = completeRound(s, r, { orderText: 'Two Beers, please.', ms: 3200 });
    expect(s.roundLog.length).toBe(1);
    expect(s.roundLog[0]).toMatchObject({
      orderText: 'Two Beers, please.', ms: 3200, success: true, errors: [],
    });
    expect(s.roundLog[0].scoreGained).toBe(s.score);
  });
});

describe('practice mode', () => {
  function practiceSession() {
    const override: DifficultyParams = { ...paramsForLevel(15), ordersPerLevel: 10 };
    return createSession('practice', 15, DEFAULT_MENU, false, 5, override);
  }
  it('uses the override params', () => {
    expect(practiceSession().params.ordersPerLevel).toBe(10);
  });
  it('never finishes as lost, finishes won after 10 rounds', () => {
    let s = practiceSession();
    for (let i = 0; i < 10; i++) {
      if (s.queue.length === 0) s = spawnCustomer(s);
      const r = timeoutRound(createRound(
        { lines: [{ item: s.menu[0], qty: 1 }], totalCents: s.menu[0].priceCents },
        [500], s.till,
      ));
      s = completeRound(s, r, { orderText: 'x', ms: 500 });
    }
    expect(s.livesLost).toBe(10);
    expect(s.finished).toBe('won'); // all rounds played, session complete
  });
});

describe('daily mode', () => {
  it('ramps params by round index but keeps the fixed order count', () => {
    const override = { ...paramsForLevel(dailyLevelFor(0)), ordersPerLevel: 10 };
    let s = createSession('daily', 1, DEFAULT_MENU, false, 20260825, override);
    const patienceBefore = s.params.patienceSeconds;
    if (s.queue.length === 0) s = spawnCustomer(s);
    s = completeRound(s, winRound(s), { orderText: 'x', ms: 500 });
    expect(s.params.patienceSeconds).toBeLessThanOrEqual(patienceBefore);
    expect(s.params).toEqual({ ...paramsForLevel(dailyLevelFor(1)), ordersPerLevel: 10 });
  });
});

describe('walkout reporting', () => {
  it('tickSession sets lastWalkouts', () => {
    let s = freshSession();
    s = tickSession(s, 1000);
    expect(s.lastWalkouts).toBe(0);
    s = tickSession(s, 10_000_000);
    expect(s.lastWalkouts).toBe(1);
  });
});

describe('completeSubRound', () => {
  it('scores and logs without consuming the customer or the round count', () => {
    let s = freshSession();
    const r = winRound(s);
    s = completeSubRound(s, r, { orderText: 'payer 1', ms: 800 });
    expect(s.queue.length).toBe(1);
    expect(s.roundsDone).toBe(0);
    expect(s.score).toBeGreaterThan(0);
    expect(s.roundLog.length).toBe(1);
    expect(s.till).toEqual(r.till);
    expect(s.roundLog[0].sub).toBe(true);
  });
});

describe('rush fast-spawn', () => {
  it('caps the spawn cooldown when the queue empties after a served round', () => {
    let s = createSession('rush', 1, DEFAULT_MENU, false, 7);
    expect(s.spawnCooldownMs).toBeGreaterThan(1500); // sanity: normal cooldown is long
    s = completeRound(s, winRound(s), { orderText: 'x', ms: 1000 });
    expect(s.queue.length).toBe(0);
    expect(s.spawnCooldownMs).toBeLessThanOrEqual(1500);
  });
  it('does not cap while other customers are still queued', () => {
    let s = createSession('rush', 1, DEFAULT_MENU, false, 7);
    s = spawnCustomer(s);
    const before = s.spawnCooldownMs;
    s = completeRound(s, winRound(s), { orderText: 'x', ms: 1000 });
    expect(s.queue.length).toBe(1);
    expect(s.spawnCooldownMs).toBe(before);
  });
});

describe('hint kills the first-try bonus', () => {
  it('a hinted perfect round scores without the 1.5x', () => {
    let s = freshSession();
    let r = winRound(s);
    r = { ...r, usedHint: true };
    s = completeRound(s, r, { orderText: 'x', ms: 500 });
    expect(s.roundLog[0].scoreGained).toBe(300); // 100 * 3 speed, no first-try bonus
    expect(s.streak).toBe(0); // hinted round doesn't extend the streak
  });
});
