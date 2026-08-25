import { describe, it, expect } from 'vitest';
import { TUTORIAL_STEPS, tutorialTill } from '../../src/core/tutorial';
import { DEFAULT_MENU } from '../../src/core/menu';
import { canMakeChange } from '../../src/core/change';
import { piecesTotal } from '../../src/core/order';

const price = (id: string) => DEFAULT_MENU.find((m) => m.id === id)!.priceCents;

describe('TUTORIAL_STEPS', () => {
  it('has 3 steps with arithmetically consistent totals', () => {
    expect(TUTORIAL_STEPS).toHaveLength(3);
    for (const s of TUTORIAL_STEPS) {
      const total = s.lines.reduce((sum, l) => sum + price(l.id) * l.qty, 0);
      expect(s.totalCents).toBe(total);
    }
  });
  it('step 1 is an exact payment (Finish flow)', () => {
    const s = TUTORIAL_STEPS[0];
    expect(piecesTotal(s.paymentPieces)).toBe(s.totalCents);
    expect(s.changeDue).toBe(0);
    expect(s.needsAsk).toBe(false);
  });
  it('step 2 pays 10 for 5,50', () => {
    const s = TUTORIAL_STEPS[1];
    expect(s.totalCents).toBe(550);
    expect(piecesTotal(s.paymentPieces)).toBe(1000);
    expect(s.changeDue).toBe(450);
  });
  it('step 3 genuinely needs the ask', () => {
    const s = TUTORIAL_STEPS[2];
    const till = tutorialTill(2);
    expect(canMakeChange(till, piecesTotal(s.paymentPieces) - s.totalCents)).toBe(false);
    expect(s.askDenom).toBe(50);
    // after asking for 50c: payment 5,50, change 1,00 — makeable
    expect(s.changeDue).toBe(100);
    expect(canMakeChange(till, 100)).toBe(true);
  });
});
