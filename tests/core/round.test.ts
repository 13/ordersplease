import { describe, it, expect } from 'vitest';
import {
  createRound, submitSum, submitChange, askCustomer, timeoutRound, MAX_TRIES, challengePayment, markHint,
} from '$core/round';
import { fullTill } from '$core/till';

const beer = { id: 'beer', name: 'Beer', priceCents: 400 };
const order2beer = { lines: [{ item: beer, qty: 2 }], totalCents: 800 };

describe('round happy path', () => {
  it('sum → change → success, till updated', () => {
    let s = createRound(order2beer, [1000], fullTill());
    expect(s.phase).toBe('sum');
    s = submitSum(s, 800);
    expect(s.phase).toBe('change');
    expect(s.changeDue).toBe(200);
    s = submitChange(s, [200]);
    expect(s.phase).toBe('done');
    expect(s.success).toBe(true);
    expect(s.errors).toEqual([]);
    expect(s.till[1000]).toBe(fullTill()[1000] + 1); // note went in
    expect(s.till[200]).toBe(fullTill()[200] - 1);   // coin went out
  });
  it('exact payment: empty pile confirms zero change', () => {
    let s = createRound(order2beer, [500, 200, 100], fullTill());
    s = submitSum(s, 800);
    expect(s.changeDue).toBe(0);
    s = submitChange(s, []);
    expect(s.success).toBe(true);
  });
});

describe('sum failures', () => {
  it('first wrong sum keeps phase, second fails round', () => {
    let s = createRound(order2beer, [1000], fullTill());
    s = submitSum(s, 700);
    expect(s.phase).toBe('sum');
    expect(s.sumTries).toBe(1);
    s = submitSum(s, 900);
    expect(s.phase).toBe('done');
    expect(s.success).toBe(false);
    expect(s.errors).toContain('sum-wrong');
  });
  it('multi-line wrong sum also flags parse-wrong', () => {
    const ven = { id: 'v', name: 'Veneziano', priceCents: 500 };
    const order = { lines: [{ item: beer, qty: 1 }, { item: ven, qty: 1 }], totalCents: 900 };
    let s = createRound(order, [1000], fullTill());
    s = submitSum(s, 800);
    s = submitSum(s, 800);
    expect(s.errors).toContain('sum-wrong');
    expect(s.errors).toContain('parse-wrong');
  });
});

describe('change failures and shortage', () => {
  it('wrong pile twice fails with change-wrong', () => {
    let s = createRound(order2beer, [1000], fullTill());
    s = submitSum(s, 800);
    s = submitChange(s, [100]);
    expect(s.phase).toBe('change');
    s = submitChange(s, [100, 50]);
    expect(s.success).toBe(false);
    expect(s.errors).toContain('change-wrong');
  });
  it('shortage: valid ask raises changeDue and payment', () => {
    const till = { ...fullTill(), 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 }; // only 2€ coins + notes
    let s = createRound(order2beer, [500, 500, 100], till); // pays 11,00 → change 3,00...
    s = submitSum(s, 800);
    expect(s.changeDue).toBe(300);
    // 300 = 200+100 impossible (no 1€); ask for 1,00 → 400 = 2x200 ✓
    s = askCustomer(s, 100);
    expect(s.usedAsk).toBe(true);
    expect(s.changeDue).toBe(400);
    s = submitChange(s, [200, 200]);
    expect(s.success).toBe(true);
    expect(s.till[100]).toBe(1 + 1); // customer's asked coin and the paid 1€ both landed in till
  });
  it('failing change without asking during shortage flags shortage-missed', () => {
    const till = { ...fullTill(), 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 };
    let s = createRound(order2beer, [500, 500, 100], till);
    s = submitSum(s, 800);
    s = submitChange(s, [200]);
    s = submitChange(s, [200]);
    expect(s.success).toBe(false);
    expect(s.errors).toContain('shortage-missed');
  });
  it('invalid ask counts as change try', () => {
    let s = createRound(order2beer, [1000], fullTill()); // change 200 makeable → no valid asks
    s = submitSum(s, 800);
    s = askCustomer(s, 50);
    expect(s.usedAsk).toBe(false);
    expect(s.changeTries).toBe(1);
  });
  it('second ask is rejected and burns a change try', () => {
    const till = { ...fullTill(), 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 };
    let s = createRound(order2beer, [500, 500, 100], till);
    s = submitSum(s, 800);
    s = askCustomer(s, 100); // valid first ask
    expect(s.usedAsk).toBe(true);
    s = askCustomer(s, 100); // second ask must be rejected
    expect(s.changeDue).toBe(400); // unchanged
    expect(s.changeTries).toBe(1);
  });
});

describe('timeout', () => {
  it('fails from any live phase', () => {
    const s = timeoutRound(createRound(order2beer, [1000], fullTill()));
    expect(s.success).toBe(false);
    expect(s.errors).toEqual(['timeout']);
  });
});

describe('payment traps', () => {
  it('correct challenge tops up the payment and continues', () => {
    let s = createRound(order2beer, [500, 200], fullTill()); // 7,00 for 8,00 due
    s = submitSum(s, 800);
    s = challengePayment(s);
    expect(s.phase).toBe('change');
    expect(s.usedTrapCall).toBe(true);
    expect(s.paymentCents).toBeGreaterThanOrEqual(800);
    expect(s.changeDue).toBe(s.paymentCents - 800);
  });
  it('challenging a fine payment burns a change try', () => {
    let s = createRound(order2beer, [1000], fullTill());
    s = submitSum(s, 800);
    s = challengePayment(s);
    expect(s.usedTrapCall).toBe(false);
    expect(s.changeTries).toBe(1);
  });
  it('confirming change on an underpaid payment fails with trap-missed', () => {
    let s = createRound(order2beer, [500, 200], fullTill());
    s = submitSum(s, 800);
    s = submitChange(s, []);
    expect(s.success).toBe(false);
    expect(s.errors).toEqual(['trap-missed']);
  });
  it('asking during an underpaid round burns a change try, never cures the trap', () => {
    let s = createRound(order2beer, [500, 200], fullTill()); // 7,00 for 8,00 due
    s = submitSum(s, 800);
    s = askCustomer(s, 100); // would make changeDue 0 — must be rejected
    expect(s.usedAsk).toBe(false);
    expect(s.changeTries).toBe(1);
    s = askCustomer(s, 100);
    expect(s.success).toBe(false);
    expect(s.errors).toEqual(['trap-missed']);
  });
});

describe('round kinds', () => {
  it('tab rounds attribute sum failure to tab-wrong', () => {
    let s = createRound(order2beer, [1000], fullTill(), 'tab');
    s = submitSum(s, 700);
    s = submitSum(s, 900);
    expect(s.errors).toContain('sum-wrong');
    expect(s.errors).toContain('tab-wrong');
    expect(s.errors).not.toContain('parse-wrong');
  });
  it('split rounds attribute sum failure to split-wrong even on one line', () => {
    let s = createRound(order2beer, [1000], fullTill(), 'split');
    s = submitSum(s, 700);
    s = submitSum(s, 900);
    expect(s.errors).toContain('split-wrong');
  });
});

describe('markHint', () => {
  it('sets usedHint idempotently, no phase change', () => {
    let s = createRound(order2beer, [1000], fullTill());
    expect(s.usedHint).toBe(false);
    s = markHint(s);
    expect(s.usedHint).toBe(true);
    expect(s.phase).toBe('sum');
    expect(markHint(s).usedHint).toBe(true);
  });
});
