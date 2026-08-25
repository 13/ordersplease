# Orders, Please — Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement round 2 of "Orders, Please" per `docs/superpowers/specs/2026-08-25-orders-please-round2-design.md`: payment traps, disputes, running tabs, split bills, practice mode, seeded daily challenge, sound/animation/breakdown pass, and the v1 polish list.

**Architecture:** All new game rules land in `src/core/` first (TDD, headless): difficulty gains gated probability rows + practice presets, order generation gains underpay/tab/split generators, a new `dispute.ts`, round/session state machines extend for traps and new modes, new `daily.ts`. UI work follows: two extracted components (EndOverlay, RoundDetails, DisputeDialog), Game.svelte wiring per mechanic, new Practice route, CSS-only animation.

**Tech Stack:** unchanged — Svelte 5 (runes), Vite, TypeScript, Vitest, vite-plugin-pwa. No new runtime dependencies.

## Global Constraints

- All v1 constraints hold: integer cents, `4,50 €` format, `src/core/` never imports Svelte/DOM, EN+DE for every UI string through `t()`, localStorage envelope `{ v: 1, data }`, touch targets ≥ 48px, test runner `npx vitest run`, svelte-check must stay at 0 errors.
- New error keys, exactly: `trap-missed`, `dispute-wrong`, `tab-wrong`, `split-wrong` (RoundError grows 5 → 9).
- Mechanic entry levels (zero probability strictly below): underpay 12, dispute 18, tab 15, split 22.
- Persisted stats from v1 must keep working: missing error keys read as 0, `recordRound` must not crash on them.
- At most one of tab/split per customer; traps/disputes may combine with either.
- Disputes never fire when the largest payment note is 5000 (no plausible higher claim).
- All animation disabled under `@media (prefers-reduced-motion: reduce)`.
- Every commit message ends with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01BFFLt2muz8HfETCzn4N1ok`

---

### Task 1: difficulty — new probability rows, gates, practice presets

**Files:**
- Modify: `src/core/difficulty.ts`
- Test: `tests/core/difficulty.test.ts` (extend)

**Interfaces:**
- Consumes: existing `DifficultyParams`, `paramsForLevel`, `paramsForRush`, `MAX_LEVEL`; `RoundError` type from `$core/round` (type-only import; round.ts does not import difficulty, so no cycle).
- Produces:

```ts
export interface DifficultyParams {
  // ...existing 10 fields unchanged, plus:
  underpayProb: number;
  disputeProb: number;
  tabProb: number;
  splitProb: number;
}
export type Skill =
  | 'sums' | 'parsing' | 'change' | 'shortages' | 'speed'
  | 'traps' | 'disputes' | 'tabs' | 'splits';
export const SKILL_ERROR: Record<Skill, RoundError>; // sums→'sum-wrong', parsing→'parse-wrong', change→'change-wrong', shortages→'shortage-missed', speed→'timeout', traps→'trap-missed', disputes→'dispute-wrong', tabs→'tab-wrong', splits→'split-wrong'
export function practiceParams(skill: Skill): DifficultyParams;
```

NOTE: this task type-references the four new RoundError members before Task 4 widens the union. To keep the build green, Task 4's union change is folded into THIS task (it is a one-line type edit in `src/core/round.ts` with no behavior): widen `RoundError` here, add the behavior in Task 4.

- [ ] **Step 1: Write failing tests**

Append to `tests/core/difficulty.test.ts`:

```ts
import { practiceParams, SKILL_ERROR } from '$core/difficulty';

describe('round-2 probability rows', () => {
  it('anchors at L30 per spec', () => {
    const p = paramsForLevel(30);
    expect(p.underpayProb).toBeCloseTo(0.2);
    expect(p.disputeProb).toBeCloseTo(0.2);
    expect(p.tabProb).toBeCloseTo(0.25);
    expect(p.splitProb).toBeCloseTo(0.2);
  });
  it('is exactly zero strictly below each entry level', () => {
    expect(paramsForLevel(11).underpayProb).toBe(0);
    expect(paramsForLevel(12).underpayProb).toBeGreaterThan(0);
    expect(paramsForLevel(17).disputeProb).toBe(0);
    expect(paramsForLevel(18).disputeProb).toBeGreaterThan(0);
    expect(paramsForLevel(14).tabProb).toBe(0);
    expect(paramsForLevel(15).tabProb).toBeGreaterThan(0);
    expect(paramsForLevel(21).splitProb).toBe(0);
    expect(paramsForLevel(22).splitProb).toBeGreaterThan(0);
  });
  it('level 1 has all four at zero', () => {
    const p = paramsForLevel(1);
    expect(p.underpayProb + p.disputeProb + p.tabProb + p.splitProb).toBe(0);
  });
});

describe('practiceParams', () => {
  it('always 10 orders, zeroes the special mechanics by default', () => {
    const p = practiceParams('change');
    expect(p.ordersPerLevel).toBe(10);
    expect(p.tabProb + p.splitProb + p.underpayProb + p.disputeProb).toBe(0);
    expect(p.paymentStyle).toBe('awkward');
    expect(p.showPileTotal).toBe(false);
  });
  it('mechanic drills force their probability to 1', () => {
    expect(practiceParams('traps').underpayProb).toBe(1);
    expect(practiceParams('disputes').disputeProb).toBe(1);
    expect(practiceParams('tabs').tabProb).toBe(1);
    expect(practiceParams('splits').splitProb).toBe(1);
  });
  it('speed drill: short patience, small orders', () => {
    const p = practiceParams('speed');
    expect(p.patienceSeconds).toBe(12);
    expect(p.itemsMax).toBeLessThanOrEqual(2);
  });
  it('shortage drill guarantees a scarce till', () => {
    expect(practiceParams('shortages').scarceDenoms).toBeGreaterThanOrEqual(2);
  });
  it('SKILL_ERROR maps every skill to a distinct error', () => {
    const values = Object.values(SKILL_ERROR);
    expect(new Set(values).size).toBe(9);
    expect(SKILL_ERROR.traps).toBe('trap-missed');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/difficulty.test.ts`
Expected: FAIL — `practiceParams` not exported; new fields missing.

- [ ] **Step 3: Widen RoundError (type-only, no behavior)**

In `src/core/round.ts` replace the `RoundError` type with:

```ts
export type RoundError =
  | 'sum-wrong' | 'change-wrong' | 'shortage-missed' | 'parse-wrong' | 'timeout'
  | 'trap-missed' | 'dispute-wrong' | 'tab-wrong' | 'split-wrong';
```

- [ ] **Step 4: Implement difficulty changes**

In `src/core/difficulty.ts`:

Add to the `DifficultyParams` interface (after `ordersPerLevel`):

```ts
  underpayProb: number;
  disputeProb: number;
  tabProb: number;
  splitProb: number;
```

Extend each anchor row (values per spec table):

```ts
// level 1:  underpayProb: 0,    disputeProb: 0,   tabProb: 0,    splitProb: 0
// level 10: underpayProb: 0.05, disputeProb: 0,   tabProb: 0,    splitProb: 0
// level 20: underpayProb: 0.15, disputeProb: 0.1, tabProb: 0.15, splitProb: 0.1
// level 30: underpayProb: 0.2,  disputeProb: 0.2, tabProb: 0.25, splitProb: 0.2
```

At the end of `paramsForLevel`, after building the result object, apply the entry-level gates (add just before `return`; restructure to `const result = { ... }` then gate then `return result`):

```ts
  const gated = (value: number, entry: number) => (l < entry ? 0 : value);
  result.underpayProb = gated(lerp(lo.underpayProb, hi.underpayProb, t), 12);
  result.disputeProb = gated(lerp(lo.disputeProb, hi.disputeProb, t), 18);
  result.tabProb = gated(lerp(lo.tabProb, hi.tabProb, t), 15);
  result.splitProb = gated(lerp(lo.splitProb, hi.splitProb, t), 22);
  return result;
```

Append at the end of the file:

```ts
import type { RoundError } from './round';

export type Skill =
  | 'sums' | 'parsing' | 'change' | 'shortages' | 'speed'
  | 'traps' | 'disputes' | 'tabs' | 'splits';

export const SKILL_ERROR: Record<Skill, RoundError> = {
  sums: 'sum-wrong',
  parsing: 'parse-wrong',
  change: 'change-wrong',
  shortages: 'shortage-missed',
  speed: 'timeout',
  traps: 'trap-missed',
  disputes: 'dispute-wrong',
  tabs: 'tab-wrong',
  splits: 'split-wrong',
};

/** Drill presets: mid-level base, all special mechanics off, then per-skill overrides. */
export function practiceParams(skill: Skill): DifficultyParams {
  const base: DifficultyParams = {
    ...paramsForLevel(15),
    ordersPerLevel: 10,
    underpayProb: 0,
    disputeProb: 0,
    tabProb: 0,
    splitProb: 0,
  };
  switch (skill) {
    case 'sums':
    case 'parsing':
      return { ...base, itemsMin: 3, itemsMax: 6, menuVisibleSeconds: 3 };
    case 'change':
      return { ...base, paymentStyle: 'awkward', showPileTotal: false };
    case 'shortages':
      return { ...base, scarceDenoms: 3 };
    case 'speed':
      return { ...base, patienceSeconds: 12, itemsMin: 1, itemsMax: 2 };
    case 'traps':
      return { ...base, underpayProb: 1 };
    case 'disputes':
      return { ...base, disputeProb: 1, paymentStyle: 'round' };
    case 'tabs':
      return { ...base, tabProb: 1 };
    case 'splits':
      return { ...base, splitProb: 1, itemsMin: 3, itemsMax: 6 };
  }
}
```

(The `import type` line goes to the top of the file with the other imports; shown here for locality. Note the level-15 base already has `paymentStyle: 'awkward'` and `showPileTotal: false` — the explicit overrides in `'change'` document intent and guard against future anchor edits.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/core/difficulty.test.ts`
Expected: all pass (4 old + 8 new). Then `npx vitest run` — full suite green (existing session/order tests construct `DifficultyParams` via `paramsForLevel`, so the interface growth is absorbed; if any test builds a params literal by hand, add the four zero fields there).

- [ ] **Step 6: Commit**

```bash
git add src/core/difficulty.ts src/core/round.ts tests/core/difficulty.test.ts
git commit -m "feat: gated mechanic probabilities and practice presets"
```

---

### Task 2: order — underpay, tabs, splits

**Files:**
- Modify: `src/core/order.ts`
- Test: `tests/core/order.test.ts` (extend)

**Interfaces:**
- Consumes: existing `Order`, `OrderLine`, `orderTotal`, `piecesTotal`, `exactPieces`-style internals, `DENOMS`, `NOTE_DENOMS`, `MenuItem`, `DifficultyParams`, `mulberry32`.
- Produces:

```ts
export function generateUnderPayment(totalCents: Cents, rng: () => number): Denom[];
// pieces summing to LESS than totalCents, plausible-looking.
export interface Tab { waves: Order[]; merged: Order }
export function generateTab(menu: MenuItem[], params: DifficultyParams, rng: () => number): Tab;
// 2-3 waves of 1-2 items each; merged combines lines by item id; merged.totalCents = sum of wave totals.
export function splitOrder(order: Order, rng: () => number): OrderLine[][];
// partition of order.lines into 2-3 disjoint, non-empty groups covering every line exactly once.
// Orders with fewer than 2 lines return a single group (caller treats <2 groups as "no split").
```

- [ ] **Step 1: Write failing tests**

Append to `tests/core/order.test.ts`:

```ts
import { generateUnderPayment, generateTab, splitOrder } from '$core/order';

describe('generateUnderPayment', () => {
  it('always sums strictly below the total but above zero', () => {
    const rng = mulberry32(21);
    for (let i = 0; i < 100; i++) {
      const total = 5 * (1 + Math.floor(rng() * 2000));
      const pieces = generateUnderPayment(total, rng);
      expect(piecesTotal(pieces)).toBeGreaterThan(0);
      expect(piecesTotal(pieces)).toBeLessThan(total);
    }
  });
});

describe('generateTab', () => {
  it('produces 2-3 waves whose totals sum to the merged total', () => {
    const rng = mulberry32(31);
    for (let i = 0; i < 30; i++) {
      const tab = generateTab(DEFAULT_MENU, paramsForLevel(20), rng);
      expect(tab.waves.length).toBeGreaterThanOrEqual(2);
      expect(tab.waves.length).toBeLessThanOrEqual(3);
      const waveSum = tab.waves.reduce((s, w) => s + w.totalCents, 0);
      expect(tab.merged.totalCents).toBe(waveSum);
    }
  });
  it('merged lines combine duplicate items by id', () => {
    const rng = mulberry32(32);
    const tab = generateTab(DEFAULT_MENU, paramsForLevel(20), rng);
    const ids = tab.merged.lines.map((l) => l.item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('splitOrder', () => {
  it('partitions into 2-3 disjoint groups covering all lines', () => {
    const rng = mulberry32(41);
    for (let i = 0; i < 30; i++) {
      const order = generateOrder(DEFAULT_MENU, { ...paramsForLevel(25), itemsMin: 3, itemsMax: 6 }, rng);
      if (order.lines.length < 2) continue;
      const groups = splitOrder(order, rng);
      expect(groups.length).toBeGreaterThanOrEqual(2);
      expect(groups.length).toBeLessThanOrEqual(3);
      for (const g of groups) expect(g.length).toBeGreaterThan(0);
      const flat = groups.flat();
      expect(flat.length).toBe(order.lines.length);
      expect(new Set(flat).size).toBe(order.lines.length); // same line objects, no duplicates
    }
  });
  it('single-line order returns one group', () => {
    const rng = mulberry32(42);
    const order = { lines: [{ item: DEFAULT_MENU[0], qty: 2 }], totalCents: 800 };
    expect(splitOrder(order, rng)).toEqual([order.lines]);
  });
});
```

Add the needed imports at the top of the test file: `DEFAULT_MENU` from `$core/menu`, `paramsForLevel` from `$core/difficulty` (both may already be imported — reuse).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/order.test.ts`
Expected: FAIL — new functions not exported.

- [ ] **Step 3: Implement**

Append to `src/core/order.ts`:

```ts
/** Payment that is plausibly short: exact decomposition minus its largest piece,
 *  or (single-piece totals) the next denomination below. */
export function generateUnderPayment(totalCents: Cents, rng: () => number): Denom[] {
  const pieces = exactPieces(totalCents);
  if (pieces.length > 1) {
    // drop one piece — bias toward a small one so the shortfall isn't obvious
    const dropIdx = rng() < 0.5 ? pieces.length - 1 : 0;
    return pieces.toSpliced(dropIdx, 1);
  }
  const below = DENOMS.filter((d) => d < pieces[0]);
  return [below[0] ?? 5];
}

export interface Tab {
  waves: Order[];
  merged: Order;
}

/** 2-3 waves of 1-2 items each; merged combines lines by item id. */
export function generateTab(
  menu: MenuItem[], params: DifficultyParams, rng: () => number,
): Tab {
  const waveCount = 2 + (rng() < 0.4 ? 1 : 0);
  const waveParams = { ...params, itemsMin: 1, itemsMax: 2 };
  const waves: Order[] = [];
  for (let w = 0; w < waveCount; w++) waves.push(generateOrder(menu, waveParams, rng));
  const byId = new Map<string, OrderLine>();
  for (const wave of waves) {
    for (const line of wave.lines) {
      const existing = byId.get(line.item.id);
      if (existing) byId.set(line.item.id, { ...existing, qty: existing.qty + line.qty });
      else byId.set(line.item.id, { ...line });
    }
  }
  const lines = [...byId.values()];
  return { waves, merged: { lines, totalCents: orderTotal(lines) } };
}

/** Disjoint 2-3 way partition of the order's lines; <2 lines → single group. */
export function splitOrder(order: Order, rng: () => number): OrderLine[][] {
  if (order.lines.length < 2) return [order.lines];
  const groupCount = Math.min(order.lines.length, 2 + (rng() < 0.4 ? 1 : 0));
  const groups: OrderLine[][] = Array.from({ length: groupCount }, () => []);
  // deal one line to each group first so none is empty, then scatter the rest
  const shuffled = [...order.lines].sort(() => rng() - 0.5);
  shuffled.forEach((line, i) => {
    const target = i < groupCount ? i : Math.floor(rng() * groupCount);
    groups[target].push(line);
  });
  return groups;
}
```

`exactPieces` is currently a private function in this file — it stays private; `generateUnderPayment` lives in the same module and may use it directly. `DENOMS` is already imported.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/order.test.ts`
Expected: all pass (7 old + 5 new). Then full suite: `npx vitest run` — green.

- [ ] **Step 5: Commit**

```bash
git add src/core/order.ts tests/core/order.test.ts
git commit -m "feat: underpay, tab, and split-order generation"
```

---

### Task 3: dispute.ts + text-order additions

**Files:**
- Create: `src/core/dispute.ts`
- Modify: `src/core/text-order.ts`
- Test: `tests/core/dispute.test.ts`, `tests/core/text-order.test.ts` (extend)

**Interfaces:**
- Consumes: `Denom`, `NOTE_DENOMS` from `$core/till`; `Order`, `OrderLine` from `$core/order`.
- Produces:

```ts
// dispute.ts
export interface Dispute { actualNote: Denom; claimedNote: Denom; }
export function maybeDispute(paymentPieces: Denom[], prob: number, rng: () => number): Dispute | null;
// null when: rng() >= prob, no note in the payment, or largest note is 5000.
// Otherwise claimedNote = one NOTE_DENOMS step above the largest note actually given.

// text-order.ts
export function renderWave(order: Order, locale: 'en' | 'de'): string;
// EN: "And two Beers." / "And a Veneziano."   DE: "Und zwei Beer." / "Und ein Veneziano."
export function renderPayer(lines: OrderLine[], locale: 'en' | 'de'): string;
// EN: "I pay two Beers and a Veneziano." DE: "Ich zahle zwei Beer und ein Veneziano."
```

- [ ] **Step 1: Write failing tests**

```ts
// tests/core/dispute.test.ts
import { describe, it, expect } from 'vitest';
import { maybeDispute } from '$core/dispute';

const always = () => 0;   // rng below any positive prob
const never = () => 0.999;

describe('maybeDispute', () => {
  it('claims one note step above the largest given note', () => {
    expect(maybeDispute([1000, 50], 1, always)).toEqual({ actualNote: 1000, claimedNote: 2000 });
    expect(maybeDispute([500], 1, always)).toEqual({ actualNote: 500, claimedNote: 1000 });
  });
  it('never fires on a 50 € note', () => {
    expect(maybeDispute([5000], 1, always)).toBeNull();
  });
  it('never fires on coin-only payments', () => {
    expect(maybeDispute([200, 200, 100], 1, always)).toBeNull();
  });
  it('respects probability', () => {
    expect(maybeDispute([1000], 0.5, never)).toBeNull();
    expect(maybeDispute([1000], 0, always)).toBeNull();
  });
});
```

Append to `tests/core/text-order.test.ts`:

```ts
import { renderWave, renderPayer } from '$core/text-order';

describe('renderWave', () => {
  it('EN', () => {
    expect(renderWave({ lines: [{ item: beer, qty: 2 }], totalCents: 800 }, 'en'))
      .toBe('And two Beers.');
    expect(renderWave({ lines: [{ item: ven, qty: 1 }], totalCents: 500 }, 'en'))
      .toBe('And a Veneziano.');
  });
  it('DE', () => {
    expect(renderWave({ lines: [{ item: beer, qty: 2 }], totalCents: 800 }, 'de'))
      .toBe('Und zwei Beer.');
  });
});

describe('renderPayer', () => {
  it('EN', () => {
    expect(renderPayer([{ item: beer, qty: 2 }, { item: ven, qty: 1 }], 'en'))
      .toBe('I pay two Beers and a Veneziano.');
  });
  it('DE', () => {
    expect(renderPayer([{ item: beer, qty: 2 }], 'de')).toBe('Ich zahle zwei Beer.');
  });
});
```

(`beer` and `ven` fixtures already exist at the top of that test file.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/dispute.test.ts tests/core/text-order.test.ts`
Expected: FAIL — module/functions missing.

- [ ] **Step 3: Implement**

```ts
// src/core/dispute.ts
import { NOTE_DENOMS, type Denom } from './till';

export interface Dispute {
  actualNote: Denom;
  claimedNote: Denom;
}

/** Customer claims to have paid with a bigger note than they did.
 *  Null when the roll fails, the payment has no note, or the largest
 *  note is already 50 € (no plausible higher claim exists). */
export function maybeDispute(
  paymentPieces: Denom[], prob: number, rng: () => number,
): Dispute | null {
  if (rng() >= prob) return null;
  const notes = paymentPieces.filter((p) => p >= 500);
  if (notes.length === 0) return null;
  const actualNote = Math.max(...notes);
  const asc = [...NOTE_DENOMS].sort((a, b) => a - b);
  const claimedNote = asc.find((n) => n > actualNote);
  if (claimedNote === undefined) return null; // actual is 5000
  return { actualNote, claimedNote };
}
```

Append to `src/core/text-order.ts` (uses the existing private `lineText`/`joinLines` helpers):

```ts
export function renderWave(order: Order, locale: Locale): string {
  const and = locale === 'en' ? 'And' : 'Und';
  return `${and} ${joinLines(order.lines.map((l) => lineText(l, locale)), locale)}.`;
}

export function renderPayer(lines: OrderLine[], locale: Locale): string {
  const prefix = locale === 'en' ? 'I pay' : 'Ich zahle';
  return `${prefix} ${joinLines(lines.map((l) => lineText(l, locale)), locale)}.`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/dispute.test.ts tests/core/text-order.test.ts`
Expected: all pass. Full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/core/dispute.ts src/core/text-order.ts tests/core/dispute.test.ts tests/core/text-order.test.ts
git commit -m "feat: dispute generation and wave/payer sentences"
```

---

### Task 4: round — traps, round kinds, error attribution; scoring trap bonus

**Files:**
- Modify: `src/core/round.ts`, `src/core/scoring.ts`
- Test: `tests/core/round.test.ts`, `tests/core/scoring.test.ts` (extend)

**Interfaces:**
- Consumes: existing round/scoring exports; `DENOMS` from `$core/till`.
- Produces:

```ts
// round.ts
export type RoundKind = 'normal' | 'tab' | 'split';
export interface RoundState { /* existing fields plus: */ kind: RoundKind; usedTrapCall: boolean; }
export function createRound(order: Order, paymentPieces: Denom[], till: Till, kind?: RoundKind): RoundState; // kind defaults to 'normal'
export function challengePayment(s: RoundState): RoundState;
// change phase only. Underpaid → customer tops up: the smallest single denom ≥ shortfall is
// appended to paymentPieces, paymentCents/changeDue recomputed, usedTrapCall = true.
// Not underpaid → burns a change try (like an invalid ask).
// submitChange while underpaid → fail(['trap-missed']).
// submitSum failure attribution: kind 'tab' → 'tab-wrong' replaces 'parse-wrong';
// kind 'split' → 'split-wrong' replaces 'parse-wrong' (and is added even for 1-line subsets).

// scoring.ts
export interface RoundScoreInput { /* existing fields plus: */ usedTrapCall?: boolean; } // +50 after rounding, like usedAsk
```

Note: with an underpaid payment, `submitSum` of the correct total sets `changeDue` negative — that is fine; the change phase's confirm path must check underpayment BEFORE comparing pile totals.

- [ ] **Step 1: Write failing tests**

Append to `tests/core/round.test.ts`:

```ts
import { challengePayment } from '$core/round';

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
```

Append to `tests/core/scoring.test.ts`:

```ts
it('trap-call bonus adds 50 like the ask bonus', () => {
  expect(scoreRound({
    success: true, firstTry: true, usedAsk: false, usedTrapCall: true,
    patienceFrac: 1, streakBefore: 0,
  })).toBe(500);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/round.test.ts tests/core/scoring.test.ts`
Expected: FAIL — `challengePayment` missing, `kind` param unknown, scoring field unknown.

- [ ] **Step 3: Implement round changes**

In `src/core/round.ts`:

Add to imports: `DENOMS` from `./till`.

Add after the `RoundError` type:

```ts
export type RoundKind = 'normal' | 'tab' | 'split';
```

Add to `RoundState`: `kind: RoundKind;` and `usedTrapCall: boolean;`.

Change `createRound` signature and body:

```ts
export function createRound(
  order: Order, paymentPieces: Denom[], till: Till, kind: RoundKind = 'normal',
): RoundState {
  return {
    phase: 'sum',
    kind,
    order,
    paymentPieces,
    paymentCents: piecesTotal(paymentPieces),
    till,
    changeDue: 0,
    sumTries: 0,
    changeTries: 0,
    usedAsk: false,
    usedTrapCall: false,
    success: null,
    errors: [],
  };
}
```

In `submitSum`, replace the failure-attribution block:

```ts
  const tries = s.sumTries + 1;
  if (tries >= MAX_TRIES) {
    const errors: RoundError[] = ['sum-wrong'];
    if (s.kind === 'tab') errors.push('tab-wrong');
    else if (s.kind === 'split') errors.push('split-wrong');
    else if (s.order.lines.length > 1) errors.push('parse-wrong');
    return fail({ ...s, sumTries: tries }, errors);
  }
  return { ...s, sumTries: tries };
```

Add a helper and the new transition, and guard `submitChange`:

```ts
function isUnderpaid(s: RoundState): boolean {
  return s.paymentCents < s.order.totalCents;
}

export function challengePayment(s: RoundState): RoundState {
  if (s.phase !== 'change') return s;
  if (isUnderpaid(s)) {
    const shortfall = s.order.totalCents - s.paymentCents;
    const topUp = [...DENOMS].sort((a, b) => a - b).find((d) => d >= shortfall) ?? 5000;
    const paymentPieces = [...s.paymentPieces, topUp];
    const paymentCents = piecesTotal(paymentPieces);
    return {
      ...s,
      usedTrapCall: true,
      paymentPieces,
      paymentCents,
      changeDue: paymentCents - s.order.totalCents,
    };
  }
  return bumpChangeTry(s);
}
```

At the top of `submitChange`, after the phase guard, add:

```ts
  if (isUnderpaid(s)) return fail(s, ['trap-missed']);
```

`askCustomer` needs no change (asking during an underpaid round is pointless but harmless — `askOptions` operates on the negative `changeDue` and will reject, burning a try, which is fair).

- [ ] **Step 4: Implement scoring change**

In `src/core/scoring.ts`: add `usedTrapCall?: boolean;` to `RoundScoreInput`, and change the return line of `scoreRound`:

```ts
  return Math.round(raw) + (i.usedAsk ? ASK_BONUS : 0) + (i.usedTrapCall ? ASK_BONUS : 0);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/core/round.test.ts tests/core/scoring.test.ts`
Expected: all pass (10 + 5 new round/scoring cases). Full suite: `npx vitest run` — green (`Game.svelte` still compiles: `createRound`'s new param has a default; `RoundState` gained fields but no consumer breaks).

- [ ] **Step 6: Commit**

```bash
git add src/core/round.ts src/core/scoring.ts tests/core/round.test.ts tests/core/scoring.test.ts
git commit -m "feat: payment traps, round kinds, trap-call scoring bonus"
```

---

### Task 5: daily.ts core + op.daily store

**Files:**
- Create: `src/core/daily.ts`, `src/stores/daily.ts`
- Test: `tests/core/daily.test.ts`

**Interfaces:**
- Consumes: nothing from other core modules (self-contained); `persisted` from the stores layer.
- Produces:

```ts
// core/daily.ts
export function dailySeed(date: Date): number;            // local yyyymmdd as integer
export function dailyKey(date: Date): string;             // local 'YYYY-MM-DD'
export const DAILY_ORDERS = 10;
export function dailyLevelFor(roundIndex: number): number; // 5 → 25 across indices 0..9
export interface DailyRecord {
  date: string;      // dailyKey of the ranked attempt
  score: number;
  perfect: boolean;  // all 10 rounds succeeded
  attempts: number;  // total attempts today (ranked + unranked)
  streak: number;    // consecutive daily-challenge days
}
export function isRanked(prev: DailyRecord | null, date: Date): boolean; // no record for today yet
export function nextDailyRecord(prev: DailyRecord | null, date: Date, score: number, perfect: boolean): DailyRecord;
export function shareText(date: Date, score: number, served: number, total: number, streak: number): string;

// stores/daily.ts
export const daily: Writable<DailyRecord | null>;         // key 'op.daily'
```

- [ ] **Step 1: Write failing tests**

```ts
// tests/core/daily.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/daily.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/core/daily.ts
export const DAILY_ORDERS = 10;

export function dailySeed(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export function dailyKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Virtual difficulty level for order index 0..9: 5 → 25 linear. */
export function dailyLevelFor(roundIndex: number): number {
  return 5 + Math.min(roundIndex, DAILY_ORDERS - 1) * (20 / (DAILY_ORDERS - 1));
}

export interface DailyRecord {
  date: string;
  score: number;
  perfect: boolean;
  attempts: number;
  streak: number;
}

export function isRanked(prev: DailyRecord | null, date: Date): boolean {
  return prev === null || prev.date !== dailyKey(date);
}

export function nextDailyRecord(
  prev: DailyRecord | null, date: Date, score: number, perfect: boolean,
): DailyRecord {
  const key = dailyKey(date);
  if (prev && prev.date === key) {
    return { ...prev, attempts: prev.attempts + 1 }; // unranked replay
  }
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const streak = prev && prev.date === dailyKey(yesterday) ? prev.streak + 1 : 1;
  return { date: key, score, perfect, attempts: 1, streak };
}

function formatPts(score: number): string {
  return score.toLocaleString('de-AT'); // 3450 → "3.450"
}

export function shareText(
  date: Date, score: number, served: number, total: number, streak: number,
): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const check = served === total ? ` ✓` : '';
  return `Orders, Please ${day}.${month}. — ${formatPts(score)} pts · ${served}/${total}${check} · 🔥${streak}`;
}
```

```ts
// src/stores/daily.ts
import { persisted } from './persisted';
import type { DailyRecord } from '../core/daily';

export const daily = persisted<DailyRecord | null>('op.daily', null);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/daily.test.ts`
Expected: 7 passed. Full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/core/daily.ts src/stores/daily.ts tests/core/daily.test.ts
git commit -m "feat: daily challenge seed, curve, record, share text"
```

---

### Task 6: session — practice/daily modes, round log, walkout reporting

**Files:**
- Modify: `src/core/session.ts`, `src/routes/Game.svelte` (call-site only), `tests/core/session.test.ts`
- Test: `tests/core/session.test.ts` (extend + adjust)

**Interfaces:**
- Consumes: `practiceParams` not needed here (callers pass overrides); `dailyLevelFor` from `$core/daily`; existing round/scoring/till/menu exports.
- Produces:

```ts
export type SessionMode = 'level' | 'rush' | 'practice' | 'daily';
export interface RoundLogEntry {
  orderText: string; ms: number; success: boolean;
  errors: RoundError[]; scoreGained: number;
}
export interface SessionState { /* existing fields with mode: SessionMode, plus: */
  roundLog: RoundLogEntry[];
  lastWalkouts: number;   // walkouts in the most recent tickSession call
}
export function createSession(
  mode: SessionMode, level: number, baseMenu: MenuItem[],
  isCustomMenu: boolean, seed: number, paramsOverride?: DifficultyParams,
): SessionState;
export interface RoundMeta { orderText: string; ms: number; }
export function completeRound(s: SessionState, round: RoundState, meta: RoundMeta): SessionState; // NEW third arg (breaking)
export function completeSubRound(s: SessionState, round: RoundState, meta: RoundMeta): SessionState;
// split payers before the last: success-only — score/log/till/streak updated,
// queue NOT sliced, roundsDone NOT counted, no won/lost checks.
```

Behavior rules:
- `paramsOverride` (practice and daily pass it) replaces the level/rush param derivation. Daily callers pass `paramsForLevel(dailyLevelFor(0))`.
- `checkLost` applies only to `level` and `rush`. `finished: 'won'` at `ordersPerLevel` applies to `level`, `practice`, `daily`.
- Daily ramp: in `completeRound`, when mode is `daily` and the session isn't finished, `params` is re-derived as `paramsForLevel(dailyLevelFor(roundsDone))`.
- `tickSession` records `lastWalkouts` (0 when none) so the UI can flash walkouts; it still charges lives/streak exactly as before (in practice/daily, `livesLost` may grow but never ends the session).
- `completeRound` gains scoring input `usedTrapCall: success && round.usedTrapCall` and appends a `RoundLogEntry`.

- [ ] **Step 1: Update existing tests + write new ones**

In `tests/core/session.test.ts`: every existing `completeRound(s, r)` call gains a meta third argument — use `{ orderText: 'x', ms: 1000 }`. Then append:

```ts
import type { DifficultyParams } from '$core/difficulty';
import { paramsForLevel } from '$core/difficulty';
import { completeSubRound } from '$core/session';
import { dailyLevelFor } from '$core/daily';

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
  });
});
```

Note: the practice `winRound` helper reuse — `winRound` pays with a 500 note against the level-15-style menu; if the drill menu's first item isn't 400 cents, the helper's ternary handles it (pays 5000). Keep the helper as-is.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/session.test.ts`
Expected: FAIL — signatures/fields missing.

- [ ] **Step 3: Implement session changes**

In `src/core/session.ts`:

```ts
// imports gain:
import { dailyLevelFor } from './daily';
import type { RoundError } from './round';

export type SessionMode = 'level' | 'rush' | 'practice' | 'daily';

export interface RoundLogEntry {
  orderText: string;
  ms: number;
  success: boolean;
  errors: RoundError[];
  scoreGained: number;
}

export interface RoundMeta { orderText: string; ms: number; }
```

`SessionState`: `mode: SessionMode;` plus new fields `roundLog: RoundLogEntry[];` and `lastWalkouts: number;`.

`createSession`:

```ts
export function createSession(
  mode: SessionMode, level: number,
  baseMenu: MenuItem[], isCustomMenu: boolean, seed: number,
  paramsOverride?: DifficultyParams,
): SessionState {
  const params = paramsOverride
    ?? (mode === 'level' ? paramsForLevel(level) : paramsForRush(0));
  const rng = mulberry32(seed);
  const till = params.scarceDenoms === 0 ? fullTill() : scarceTill(rng, params.scarceDenoms);
  const menu = isCustomMenu ? baseMenu : applyPriceStyle(baseMenu, params.priceStyle);
  const s: SessionState = {
    mode, level, elapsedMs: 0, menu, till,
    queue: [], livesLost: 0, score: 0, streak: 0, roundsDone: 0,
    finished: null, params, rng, nextCustomerId: 1,
    spawnCooldownMs: spawnIntervalMs(params),
    roundLog: [], lastWalkouts: 0,
  };
  return spawnCustomer(s);
}
```

`checkLost`:

```ts
function checkLost(s: SessionState): SessionState {
  if ((s.mode === 'level' || s.mode === 'rush')
      && s.finished === null && s.livesLost >= MAX_LIVES) {
    return { ...s, finished: 'lost' };
  }
  return s;
}
```

`tickSession`: after computing `walkouts`, also set `next.lastWalkouts = walkouts;` (and ensure the early-return path for finished sessions leaves `lastWalkouts` untouched — acceptable, the UI reads it only on live ticks).

Shared scoring/log helper + the two completion functions:

```ts
function scoreAndLog(
  s: SessionState, round: RoundState, meta: RoundMeta,
): { gained: number; entry: RoundLogEntry; firstTry: boolean; success: boolean } {
  const success = round.success === true;
  const firstTry = round.sumTries === 0 && round.changeTries === 0;
  const gained = scoreRound({
    success, firstTry,
    usedAsk: success && round.usedAsk,
    usedTrapCall: success && round.usedTrapCall,
    patienceFrac: patienceFrac(s), streakBefore: s.streak,
  });
  return {
    gained, firstTry, success,
    entry: {
      orderText: meta.orderText, ms: meta.ms,
      success, errors: round.errors, scoreGained: gained,
    },
  };
}

export function completeRound(s: SessionState, round: RoundState, meta: RoundMeta): SessionState {
  if (s.finished) return s;
  const { gained, entry, firstTry, success } = scoreAndLog(s, round, meta);
  let next: SessionState = {
    ...s,
    queue: s.queue.slice(1),
    score: s.score + gained,
    streak: success && firstTry ? s.streak + 1 : 0,
    roundsDone: s.roundsDone + 1,
    livesLost: s.livesLost + (success ? 0 : 1),
    till: success ? round.till : s.till,
    roundLog: [...s.roundLog, entry],
  };
  next = checkLost(next);
  if (next.finished === null && next.mode !== 'rush'
      && next.roundsDone >= next.params.ordersPerLevel) {
    next.finished = 'won';
  }
  if (next.finished === null && next.mode === 'daily') {
    // ramp difficulty but keep the caller's fixed order count (DAILY_ORDERS)
    next.params = {
      ...paramsForLevel(dailyLevelFor(next.roundsDone)),
      ordersPerLevel: next.params.ordersPerLevel,
    };
  }
  return next;
}

/** Split payers before the last one: success-only — the customer stays, the
 *  group's round is not counted yet. */
export function completeSubRound(s: SessionState, round: RoundState, meta: RoundMeta): SessionState {
  if (s.finished) return s;
  const { gained, entry, firstTry, success } = scoreAndLog(s, round, meta);
  return {
    ...s,
    score: s.score + gained,
    streak: success && firstTry ? s.streak + 1 : 0,
    till: success ? round.till : s.till,
    roundLog: [...s.roundLog, entry],
  };
}
```

(The won-check's `mode !== 'rush'` covers level, practice, and daily uniformly.)

- [ ] **Step 4: Update the Game.svelte call site (compile fix only)**

In `src/routes/Game.svelte`, `finishRound()` currently calls `completeRound(session, done)`. Change that one line to:

```ts
    session = completeRound(session, done, { orderText, ms });
```

(`orderText` and `ms` are already in scope there.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/core/session.test.ts`
Expected: all pass (8 adjusted + 6 new). Then `npx vitest run` and `npm run check` — green / 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/session.ts src/routes/Game.svelte tests/core/session.test.ts
git commit -m "feat: session modes, round log, sub-rounds, walkout reporting"
```

---

### Task 7: stats — 9 error skills, migration safety, Stats screen, train link

**Files:**
- Modify: `src/stores/stats.ts`, `src/routes/Stats.svelte`, `src/routes/Settings.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`
- Test: `tests/stores/stats.test.ts` (extend)

**Interfaces:**
- Produces: `export const EMPTY: Stats` (now exported); `recordRound` tolerant of legacy persisted objects missing the four new error keys; Stats screen shows 9 bars and a "[Train it]" link (`go('practice')` — the route lands in Task 13; until then the router falls back to Home, which is acceptable mid-plan).

- [ ] **Step 1: Write failing tests**

Append to `tests/stores/stats.test.ts`:

```ts
import { EMPTY } from '../../src/stores/stats';

describe('round-2 stats', () => {
  it('EMPTY is exported and has all 9 error keys at 0', () => {
    expect(Object.keys(EMPTY.errors).sort()).toEqual([
      'change-wrong', 'dispute-wrong', 'parse-wrong', 'shortage-missed',
      'split-wrong', 'sum-wrong', 'tab-wrong', 'timeout', 'trap-missed',
    ]);
  });
  it('recordRound tolerates legacy stats missing new keys', () => {
    const legacy = {
      ...empty,
      errors: { 'sum-wrong': 2, 'change-wrong': 0, 'shortage-missed': 0, 'parse-wrong': 0, timeout: 1 },
    } as unknown as typeof empty;
    const s = recordRound(legacy, ['trap-missed'], 1000, true);
    expect(s.errors['trap-missed']).toBe(1);
    expect(s.errors['sum-wrong']).toBe(2);
  });
});
```

Also update the local `empty` fixture at the top of that test file to include the four new keys at 0.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/stores/stats.test.ts`
Expected: FAIL — EMPTY not exported / keys missing.

- [ ] **Step 3: Implement store changes**

In `src/stores/stats.ts`: export `EMPTY` and extend it:

```ts
export const EMPTY: Stats = {
  errors: {
    'sum-wrong': 0, 'change-wrong': 0, 'shortage-missed': 0, 'parse-wrong': 0, timeout: 0,
    'trap-missed': 0, 'dispute-wrong': 0, 'tab-wrong': 0, 'split-wrong': 0,
  },
  rounds: 0, roundsFailed: 0, totalMs: 0, days: {}, rushHigh: 0,
};
```

In `recordRound`, make the increment migration-safe:

```ts
  for (const err of errors) e[err] = (e[err] ?? 0) + 1;
```

In `src/routes/Settings.svelte`: `import { stats, EMPTY } from '../stores/stats';` and replace the inline reset literal with `stats.set(structuredClone(EMPTY));`.

- [ ] **Step 4: Extend Stats screen + i18n**

In `src/routes/Stats.svelte`: extend `ERROR_KEYS` to all 9 (order: the 5 existing, then `'trap-missed', 'dispute-wrong', 'tab-wrong', 'split-wrong'`), and make every `$stats.errors[k]` read null-safe: `($stats.errors[k] ?? 0)` (three places: `worst` entries, `maxCount`, the bar row). Change the hint block to include a train link:

```svelte
  {#if worst}
    <p class="hint">
      {$t('stats.hint')}: <strong>{$t(`stats.err.${worst}`)}</strong>
      <button class="train" onclick={() => go('practice')}>{$t('stats.train')}</button>
    </p>
  {/if}
```

with style `.train { background: var(--accent); color: var(--ink); margin-left: 0.5rem; min-height: 36px; }`.

Add to `src/i18n/en.ts`:

```ts
  'stats.err.trap-missed': 'Payment traps',
  'stats.err.dispute-wrong': 'Disputes',
  'stats.err.tab-wrong': 'Tabs',
  'stats.err.split-wrong': 'Split bills',
  'stats.train': 'Train it',
```

Add to `src/i18n/de.ts`:

```ts
  'stats.err.trap-missed': 'Zahlungsfallen',
  'stats.err.dispute-wrong': 'Reklamationen',
  'stats.err.tab-wrong': 'Deckel',
  'stats.err.split-wrong': 'Getrennte Rechnung',
  'stats.train': 'Üben',
```

- [ ] **Step 5: Verify + commit**

Run: `npx vitest run` (green), `npm run check` (0 errors), `npm run build` (ok).

```bash
git add src/stores/stats.ts src/routes/Stats.svelte src/routes/Settings.svelte src/i18n tests/stores/stats.test.ts
git commit -m "feat: nine-skill stats with legacy migration and train link"
```

---

### Task 8: sound — synthesized effects replace beep

**Files:**
- Modify: `src/lib/sound.ts`, `src/routes/Game.svelte` (call sites)
- Test: none (browser audio); verified by compile + suite staying green

**Interfaces:**
- Produces: `coinClink(enabled)`, `chaChing(enabled)`, `errorBuzz(enabled)`, `tickTock(enabled)` — all `(enabled: boolean) => void`, silent no-ops when disabled or when AudioContext fails. `beep` is removed.

- [ ] **Step 1: Replace sound.ts**

```ts
// src/lib/sound.ts
let ctx: AudioContext | null = null;

function tone(
  freq: number, durS: number, gain = 0.08,
  type: OscillatorType = 'sine', startOffset = 0,
): void {
  ctx ??= new AudioContext();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = ctx.currentTime + startOffset;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durS);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + durS);
}

export function coinClink(enabled: boolean): void {
  if (!enabled) return;
  try { tone(2400 * (0.9 + Math.random() * 0.2), 0.06, 0.05, 'triangle'); } catch { /* silent */ }
}

export function chaChing(enabled: boolean): void {
  if (!enabled) return;
  try {
    tone(1200, 0.1, 0.07, 'square');
    tone(1800, 0.18, 0.07, 'square', 0.09);
  } catch { /* silent */ }
}

export function errorBuzz(enabled: boolean): void {
  if (!enabled) return;
  try { tone(160, 0.2, 0.09, 'sawtooth'); } catch { /* silent */ }
}

let lastTick = 0;
export function tickTock(enabled: boolean): void {
  if (!enabled) return;
  const now = Date.now();
  if (now - lastTick < 1000) return; // max once per second
  lastTick = now;
  try { tone(880, 0.03, 0.04, 'square'); } catch { /* silent */ }
}
```

- [ ] **Step 2: Swap Game.svelte call sites**

Replace the import `import { beep } from '../lib/sound';` with:

```ts
  import { chaChing, coinClink, errorBuzz } from '../lib/sound';
```

Then: in `finishRound`, replace `beep(!failed, $settings.sound);` with:

```ts
    if (failed) errorBuzz($settings.sound);
    else chaChing($settings.sound);
```

In `onSum`, replace `beep(false, $settings.sound);` with `errorBuzz($settings.sound);`.
In `confirmChange`'s else-branch, replace `beep(false, $settings.sound);` with `errorBuzz($settings.sound);`.
In `take(d)`, add `coinClink($settings.sound);` after the pile push (inside the `if`).

(`tickTock` is wired in Task 15 with the patience UI work.)

- [ ] **Step 3: Verify + commit**

Run: `npm run check` (0 errors), `npm run build` (ok), `npx vitest run` (green).

```bash
git add src/lib/sound.ts src/routes/Game.svelte
git commit -m "feat: synthesized coin, register, and error sounds"
```

---

### Task 9: feel core — RoundDetails, EndOverlay extraction, walkout flash, highscore fix, numpad guard

**Files:**
- Create: `src/lib/RoundDetails.svelte`, `src/lib/EndOverlay.svelte`
- Modify: `src/routes/Game.svelte`, `src/lib/Numpad.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`
- Test: compile gates (`npm run check`, `npm run build`); core suite unchanged

**Interfaces:**
- Consumes: `RoundLogEntry`, `SessionState` from `$core/session`; `starsFor`; i18n `t`; router `go`; `MAX_LEVEL`.
- Produces:
  - `RoundDetails`: `{ log: RoundLogEntry[] }` — collapsed by default, expandable per-round list.
  - `EndOverlay`: `{ session: SessionState; level: number; stars: number; wasNewHigh: boolean; onretry: () => void; onshare?: (() => void) | null; shareLabel?: string }` — renders won/lost titles, stars (level mode), highscore line (rush + wasNewHigh), accuracy line (practice/daily), RoundDetails, and the next/retry/home actions. Task 13 passes `onshare`/`shareLabel`; until then they default off.
  - `Numpad`: OK button disabled while input is empty.
  - Game: `wasNewHigh` state set in `finalize()`; walkout flash from `session.lastWalkouts`.

- [ ] **Step 1: Implement RoundDetails**

```svelte
<!-- src/lib/RoundDetails.svelte -->
<script lang="ts">
  import type { RoundLogEntry } from '../core/session';
  import { t } from '../i18n';

  let { log }: { log: RoundLogEntry[] } = $props();
  let open = $state(false);
</script>

<div class="details">
  <button class="toggle" aria-expanded={open} onclick={() => (open = !open)}>
    {$t('result.details')} {open ? '▴' : '▾'}
  </button>
  {#if open}
    <ol>
      {#each log as e, i (i)}
        <li class:failed={!e.success}>
          <span class="mark">{e.success ? '✓' : '✗'}</span>
          <span class="text">{e.orderText}</span>
          <span class="time">{(e.ms / 1000).toFixed(1)}s</span>
          <span class="pts">+{e.scoreGained}</span>
          {#if e.errors.length}
            <span class="errs">{e.errors.map((err) => $t(`stats.err.${err}`)).join(', ')}</span>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .details { width: 100%; max-width: 360px; }
  .toggle { background: var(--wood-light); color: var(--cream); width: 100%; }
  ol {
    list-style: none; padding: 0.5rem; margin: 0.5rem 0 0;
    max-height: 40dvh; overflow-y: auto;
    background: rgb(0 0 0 / 0.35); border-radius: var(--radius);
    text-align: left; font-size: 0.85rem;
  }
  li {
    display: grid; grid-template-columns: 1.2rem 1fr auto auto;
    gap: 0.4rem; padding: 0.25rem 0; align-items: baseline;
  }
  li.failed .mark { color: var(--danger); }
  .mark { color: var(--ok); font-weight: bold; }
  .time, .pts { font-variant-numeric: tabular-nums; opacity: 0.85; }
  .errs { grid-column: 2 / -1; color: var(--danger); font-size: 0.8rem; }
</style>
```

- [ ] **Step 2: Implement EndOverlay**

```svelte
<!-- src/lib/EndOverlay.svelte -->
<script lang="ts">
  import type { SessionState } from '../core/session';
  import { t } from '../i18n';
  import { go } from './router';
  import { MAX_LEVEL } from '../core/difficulty';
  import RoundDetails from './RoundDetails.svelte';

  let { session, level, stars, wasNewHigh, onretry, onshare = null, shareLabel = '' }: {
    session: SessionState;
    level: number;
    stars: number;
    wasNewHigh: boolean;
    onretry: () => void;
    onshare?: (() => void) | null;
    shareLabel?: string;
  } = $props();

  const served = $derived(session.roundLog.filter((e) => e.success).length);
  const showAccuracy = $derived(session.mode === 'practice' || session.mode === 'daily');
</script>

<div class="overlay">
  <h2>{session.finished === 'won' ? $t('result.won') : $t('result.lost')}</h2>
  {#if session.mode === 'level' && session.finished === 'won'}
    <p class="stars">{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</p>
  {/if}
  <p>{$t('game.score')}: {session.score}</p>
  {#if showAccuracy}
    <p>{$t('result.accuracy')}: {served}/{session.roundLog.length}</p>
  {/if}
  {#if session.mode === 'rush' && wasNewHigh}
    <p>{$t('result.highscore')}</p>
  {/if}

  <RoundDetails log={session.roundLog} />

  <div class="overlay-actions">
    {#if onshare}
      <button onclick={onshare}>{shareLabel}</button>
    {/if}
    {#if session.mode === 'level' && session.finished === 'won' && level < MAX_LEVEL}
      <button onclick={() => go(`game/${level + 1}`)}>{$t('result.next')}</button>
    {/if}
    <button onclick={onretry}>{$t('result.retry')}</button>
    <button onclick={() => go('home')}>{$t('result.home')}</button>
  </div>
</div>

<style>
  .overlay {
    position: fixed; inset: 0; background: rgb(0 0 0 / 0.75);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0.75rem; text-align: center; padding: 1rem;
  }
  .stars { font-size: 2.2rem; color: var(--accent); }
  .overlay-actions { display: flex; flex-direction: column; gap: 0.5rem; width: 240px; }
  .overlay-actions button { background: var(--accent); color: var(--ink); font-size: 1.1rem; }
</style>
```

- [ ] **Step 3: Wire Game.svelte**

Remove the old overlay markup block (`{#if session.finished && finalized} <div class="overlay"> … </div> {/if}`) and its now-unused styles (`.overlay`, `.stars`, `.overlay-actions` rules). Replace the markup block with:

```svelte
  {#if session.finished && finalized}
    <EndOverlay {session} {level} {stars} {wasNewHigh} onretry={restart} />
  {/if}
```

Add imports:

```ts
  import EndOverlay from '../lib/EndOverlay.svelte';
```

Add state `let wasNewHigh = $state(false);` and change `finalize()`'s rush branch to compute it before updating:

```ts
  function finalize() {
    if (finalized) return;
    finalized = true;
    stats.update((s) => {
      let next = recordDay(s, new Date());
      if (session.mode === 'rush' && session.score > next.rushHigh) {
        wasNewHigh = true;
        next = { ...next, rushHigh: session.score };
      }
      return next;
    });
    if (session.mode === 'level' && session.finished === 'won') {
      progress.update((p) => ({
        stars: { ...p.stars, [level]: Math.max(p.stars[level] ?? 0, stars) },
      }));
    }
  }
```

Also reset `wasNewHigh = false;` inside `restart()`.

Walkout flash — in the `onMount` interval, after `session = tickSession(session, dt);` and before the finished checks, add:

```ts
      if (!flash && session.lastWalkouts > 0) {
        flash = $t('game.walkout');
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => {
          flash = null;
          startRound();
        }, 1000);
      }
```

(`session.lastWalkouts` exists since Task 6. The `!flash` guard keeps result flashes on top; the head customer's own timeout never reaches here because `finishRound` runs first and slices them.)

- [ ] **Step 4: Numpad OK guard + i18n keys**

In `src/lib/Numpad.svelte` change the OK button line to:

```svelte
    <button class="ok" disabled={digits === ''} onclick={submit}>OK</button>
```

and add a disabled style: `.ok:disabled { opacity: 0.4; }`.

Add to `src/i18n/en.ts`: `'result.details': 'Details',` and `'result.accuracy': 'Accuracy',`
Add to `src/i18n/de.ts`: `'result.details': 'Details',` and `'result.accuracy': 'Trefferquote',`

- [ ] **Step 5: Verify + commit**

Run: `npm run check` (0 errors), `npm run build` (ok), `npx vitest run` (green).

```bash
git add src/lib/RoundDetails.svelte src/lib/EndOverlay.svelte src/lib/Numpad.svelte src/routes/Game.svelte src/i18n
git commit -m "feat: end overlay with round details, walkout flash, highscore and numpad guards"
```

---

### Task 10: Game — payment traps + disputes UI

**Files:**
- Create: `src/lib/DisputeDialog.svelte`
- Modify: `src/routes/Game.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`
- Test: compile gates; core behavior already covered by Tasks 3-4 tests

**Interfaces:**
- Consumes: `challengePayment` from `$core/round`; `generateUnderPayment` from `$core/order`; `maybeDispute`, `Dispute` from `$core/dispute`; `completeSubRound` not needed here.
- Produces: `DisputeDialog`: `{ claimText: string; question: string; options: { label: string; value: number }[]; onanswer: (value: number) => void }`.

- [ ] **Step 1: Implement DisputeDialog**

```svelte
<!-- src/lib/DisputeDialog.svelte -->
<script lang="ts">
  let { claimText, question, options, onanswer }: {
    claimText: string;
    question: string;
    options: { label: string; value: number }[];
    onanswer: (value: number) => void;
  } = $props();
</script>

<div class="dispute" role="alertdialog" aria-label={question}>
  <p class="claim">“{claimText}”</p>
  <p>{question}</p>
  <div class="choices">
    {#each options as o (o.value)}
      <button onclick={() => onanswer(o.value)}>{o.label}</button>
    {/each}
  </div>
</div>

<style>
  .dispute {
    position: fixed; inset: 0; background: rgb(0 0 0 / 0.75);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0.75rem; text-align: center; padding: 1rem;
  }
  .claim { font-size: 1.3rem; font-style: italic; color: var(--accent); }
  .choices { display: flex; gap: 0.75rem; }
  .choices button {
    background: var(--cream); color: var(--ink);
    font-size: 1.2rem; font-weight: bold; padding: 0.75rem 1.5rem;
  }
</style>
```

- [ ] **Step 2: Wire Game.svelte — underpay generation + Not-enough button**

Imports gain:

```ts
  import { challengePayment } from '../core/round';        // extend the existing round import list
  import { generateUnderPayment } from '../core/order';    // extend the existing order import list
  import { maybeDispute, type Dispute } from '../core/dispute';
  import DisputeDialog from '../lib/DisputeDialog.svelte';
```

In `startRound()`, replace the payment line:

```ts
    const payment = session.rng() < session.params.underpayProb
      ? generateUnderPayment(order.totalCents, session.rng)
      : generatePayment(order.totalCents, session.params.paymentStyle, session.rng);
```

Add a handler next to `onAsk`:

```ts
  function onNotEnough() {
    if (!round) return;
    const wasTrapCall = round.usedTrapCall;
    round = challengePayment(round);
    if (round.phase === 'done') {
      finishRound();
    } else if (!wasTrapCall && round.usedTrapCall) {
      flash = $t('game.trap-good');
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        flash = null;
        startRound(); // no-op while this round is live — timer just clears the flash
      }, 1000);
    } else {
      errorBuzz($settings.sound);
    }
  }
```

In the change-phase actions markup, add the button after the Ask button:

```svelte
        <button class="ask" onclick={onNotEnough}>{$t('game.not-enough')}</button>
```

- [ ] **Step 3: Wire disputes**

Add state:

```ts
  let dispute = $state<Dispute | null>(null);
  let disputeOpts = $state<number[]>([]);           // fixed at dialog-open time; never roll rng in markup
  let disputeVerdict = $state<string | null>(null); // overrides the success flash once
```

In `confirmChange()`, intercept a successful confirm before finishing:

```ts
  function confirmChange() {
    if (!round) return;
    round = submitChange(round, pile);
    if (round.phase === 'done') {
      if (round.success === true) {
        const d = maybeDispute(round.paymentPieces, session.params.disputeProb, session.rng);
        if (d) {
          dispute = d;
          disputeOpts = session.rng() < 0.5
            ? [d.actualNote, d.claimedNote]
            : [d.claimedNote, d.actualNote];
          return; // finishRound happens after the dispute is answered
        }
      }
      finishRound();
    } else {
      pile = [];
      errorBuzz($settings.sound);
    }
  }
```

Add the resolution handler:

```ts
  function resolveDispute(chosen: number) {
    if (!dispute || !round) return;
    const d = dispute;
    dispute = null;
    const correct = chosen === d.actualNote;
    if (correct) {
      disputeVerdict = $t('game.dispute-right');
      session = { ...session, score: session.score + 25 };
    } else {
      round = { ...round, errors: [...round.errors, 'dispute-wrong'] };
      disputeVerdict = `${$t('game.dispute-wrong-msg').replace('{note}', denomLabel(d.actualNote))}`;
    }
    finishRound();
    if (!correct) {
      // penalty: −50, floored at what the round just earned
      const gained = session.roundLog.at(-1)?.scoreGained ?? 0;
      session = { ...session, score: session.score - Math.min(50, gained) };
    }
  }
```

In `finishRound()`, use the verdict as the flash when present — replace the flash assignment with:

```ts
    flash = disputeVerdict !== null
      ? disputeVerdict
      : !failed
        ? $t('game.correct')
        : done.errors.includes('change-wrong')
          ? `${$t('game.change-was')} ${formatEuro(done.changeDue, symbolFirst)}`
          : `${$t('game.wrong')} ${formatEuro(done.order.totalCents, symbolFirst)}`;
    disputeVerdict = null;
```

Add markup (next to the EndOverlay block):

```svelte
  {#if dispute}
    <DisputeDialog
      claimText={$t('game.dispute-claim').replace('{note}', denomLabel(dispute.claimedNote))}
      question={$t('game.dispute-question')}
      options={disputeOpts.map((v) => ({ label: denomLabel(v), value: v }))}
      onanswer={resolveDispute}
    />
  {/if}
```

Also clear `dispute = null; disputeVerdict = null;` in `restart()`, and guard the interval's head-timeout branch so a round cannot time out while the dispute dialog is up (the change was already made): wrap it as `if (!dispute && round && session.queue[0] && ...)`.

- [ ] **Step 4: i18n keys**

`src/i18n/en.ts`:

```ts
  'game.not-enough': "That's not enough!",
  'game.trap-good': 'Right — that was short!',
  'game.dispute-claim': 'I gave you {note}!',
  'game.dispute-question': 'What did they really pay?',
  'game.dispute-right': 'Good memory! +25',
  'game.dispute-wrong-msg': 'It was {note}. −50',
```

`src/i18n/de.ts`:

```ts
  'game.not-enough': 'Das ist zu wenig!',
  'game.trap-good': 'Richtig — das war zu wenig!',
  'game.dispute-claim': 'Ich habe Ihnen {note} gegeben!',
  'game.dispute-question': 'Was wurde wirklich gezahlt?',
  'game.dispute-right': 'Gutes Gedächtnis! +25',
  'game.dispute-wrong-msg': 'Es waren {note}. −50',
```

- [ ] **Step 5: Verify + commit**

Run: `npm run check` (0 errors), `npm run build` (ok), `npx vitest run` (green).

```bash
git add src/lib/DisputeDialog.svelte src/routes/Game.svelte src/i18n
git commit -m "feat: underpay traps and payment-memory disputes in the game screen"
```

---

### Task 11: Game — running tabs + split bills UI

**Files:**
- Modify: `src/routes/Game.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`
- Test: compile gates; core behavior covered by Tasks 2/4/6 tests

**Interfaces:**
- Consumes: `generateTab`, `splitOrder`, `orderTotal` from `$core/order`; `renderWave`, `renderPayer` from `$core/text-order`; `completeSubRound` from `$core/session`; `RoundKind` via `createRound`'s fourth arg.

Behavior to implement (binding):
- Kind roll at round start: `tab` when `roll < tabProb`; else `split` when `roll < tabProb + splitProb` AND the generated order has ≥ 2 lines; else normal. At most one special kind per customer. Mid-order amendments roll only for `normal` rounds. Underpay/dispute rolls stay active for all kinds.
- Tab: round is created immediately on the MERGED order (`kind: 'tab'`) so patience/trap logic runs, but the numpad is locked and only wave 1's text shows; each later wave appends its sentence after 3.5 s; the numpad unlocks when the last wave has arrived. While locked, show `game.tab-wait`.
- Split: payers are served sequentially against the SAME customer. Payer i's round is `createRound(subOrder, payment, till, 'split')` where `subOrder` is that payer's lines. Intermediate successful payers go through `completeSubRound` (customer stays, no round count); the LAST payer — or the FIRST failure — goes through the normal `finishRound` path (`completeRound`).

- [ ] **Step 1: Add state + imports**

Imports gain: `generateTab, splitOrder, orderTotal` (order), `renderWave, renderPayer` (text-order), `completeSubRound` (session).

New state:

```ts
  let numpadLocked = $state(false);
  let waveTimer: ReturnType<typeof setTimeout> | undefined;
  let splitGroups = $state<import('../core/order').OrderLine[][] | null>(null);
  let payerIndex = $state(0);
```

Add `clearTimeout(waveTimer);` wherever `amendTimer` is cleared (`startRound` top, `finishRound`, `restart`, unmount cleanup).

- [ ] **Step 2: Rework startRound's order/payment section**

Replace the body of `startRound()` between the queue-spawn block and the menu-visibility block with:

```ts
    numpadLocked = false;
    splitGroups = null;
    payerIndex = 0;
    amendText = null;
    pile = [];
    askOpen = false;

    const roll = session.rng();
    const makePayment = (cents: number) =>
      session.rng() < session.params.underpayProb
        ? generateUnderPayment(cents, session.rng)
        : generatePayment(cents, session.params.paymentStyle, session.rng);

    if (roll < session.params.tabProb) {
      // running tab: merged order drives the round; waves reveal over time
      const tab = generateTab(session.menu, session.params, session.rng);
      round = createRound(tab.merged, makePayment(tab.merged.totalCents), session.till, 'tab');
      orderText = renderOrder(tab.waves[0], $settings.locale);
      numpadLocked = true;
      let waveIdx = 1;
      const revealNext = () => {
        if (!round || round.phase !== 'sum') return;
        orderText += ' ' + renderWave(tab.waves[waveIdx], $settings.locale);
        waveIdx += 1;
        if (waveIdx < tab.waves.length) waveTimer = setTimeout(revealNext, 3500);
        else numpadLocked = false;
      };
      waveTimer = setTimeout(revealNext, 3500);
    } else {
      const order = generateOrder(session.menu, session.params, session.rng);
      const groups = roll < session.params.tabProb + session.params.splitProb
        ? splitOrder(order, session.rng)
        : null;
      if (groups && groups.length >= 2) {
        // split bill: full order shown, first payer starts
        splitGroups = groups;
        const sub = { lines: groups[0], totalCents: orderTotal(groups[0]) };
        round = createRound(sub, makePayment(sub.totalCents), session.till, 'split');
        orderText = `${renderOrder(order, $settings.locale)} ${renderPayer(groups[0], $settings.locale)}`;
      } else {
        round = createRound(order, makePayment(order.totalCents), session.till);
        orderText = renderOrder(order, $settings.locale);
        if (session.rng() < session.params.midOrderChangeProb) {
          const amended = amendOrder(order, session.rng);
          amendTimer = setTimeout(() => {
            if (round && round.phase === 'sum' && round.kind === 'normal') {
              const pieces = generatePayment(
                amended.order.totalCents, session.params.paymentStyle, session.rng,
              );
              round = {
                ...round, order: amended.order,
                paymentPieces: pieces, paymentCents: piecesTotal(pieces),
              };
              amendText = renderAmendment(amended.amendedLine, $settings.locale);
            }
          }, 2500);
        }
      }
    }
    roundStartedAt = performance.now();
```

(The original single-order path moves into the final else-branch; `roundStartedAt` stays at the end.)

- [ ] **Step 3: Split-aware finishRound + next payer**

Add a helper ABOVE `finishRound`:

```ts
  function nextPayer() {
    if (!round || !splitGroups) return;
    const done = round;
    const ms = performance.now() - roundStartedAt;
    stats.update((s) => recordRound(s, done.errors, ms, false));
    session = completeSubRound(session, done, {
      orderText: renderPayer(splitGroups[payerIndex], $settings.locale), ms,
    });
    chaChing($settings.sound);
    payerIndex += 1;
    const group = splitGroups[payerIndex];
    const sub = { lines: group, totalCents: orderTotal(group) };
    const payment = session.rng() < session.params.underpayProb
      ? generateUnderPayment(sub.totalCents, session.rng)
      : generatePayment(sub.totalCents, session.params.paymentStyle, session.rng);
    round = createRound(sub, payment, session.till, 'split');
    orderText = orderText.replace(/ [^.]*\.$/, '') + ' ' + renderPayer(group, $settings.locale);
    pile = [];
    askOpen = false;
    roundStartedAt = performance.now();
  }
```

At the very top of `finishRound()`, route intermediate successful payers:

```ts
  function finishRound() {
    if (!round) return;
    if (splitGroups && round.success === true && payerIndex < splitGroups.length - 1) {
      nextPayer();
      return;
    }
    const done = round;
    // ... (rest unchanged; meta.orderText for the completing call uses the
    //      current orderText, which is correct for both normal and last-payer rounds)
```

Also: when the group's LAST payer (or a failure) completes, `splitGroups` must reset — add `splitGroups = null;` right after `round = null; pile = [];` in `finishRound`, and in `restart()`.

Note the dispute intercept from Task 10 sits in `confirmChange` and calls `finishRound()` via `resolveDispute` — intermediate split payers can dispute too; `finishRound`'s top routing sends them through `nextPayer()` after resolution, which is correct (the dispute verdict flash is skipped for intermediate payers; acceptable).

- [ ] **Step 4: Lock the numpad during waves**

In the sum-phase markup, replace the Numpad block:

```svelte
    {#if round.phase === 'sum'}
      {#if numpadLocked}
        <p class="prompt">{$t('game.tab-wait')}</p>
      {:else}
        <p class="prompt">{$t('game.sum-prompt')}</p>
        <Numpad onsubmit={onSum} {symbolFirst} />
      {/if}
    {:else if round.phase === 'change'}
```

- [ ] **Step 5: i18n + verify + commit**

`src/i18n/en.ts`: `'game.tab-wait': 'Still ordering…',`
`src/i18n/de.ts`: `'game.tab-wait': 'Bestellt noch…',`

Run: `npm run check` (0 errors), `npm run build` (ok), `npx vitest run` (green).

```bash
git add src/routes/Game.svelte src/i18n
git commit -m "feat: running tabs and split bills in the game screen"
```

---

### Task 12: practice mode — picker route, Game wiring

**Files:**
- Create: `src/routes/Practice.svelte`
- Modify: `src/routes/Game.svelte`, `src/routes/Home.svelte`, `src/App.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`
- Test: compile gates; `practiceParams`/session behavior covered by Tasks 1/6 tests

**Interfaces:**
- Consumes: `Skill`, `SKILL_ERROR`, `practiceParams` from `$core/difficulty`; `SessionMode` from `$core/session`; stats store.
- Produces: routes `practice` (picker) and `practice/<skill>` (drill); Game props widen to `{ mode: SessionMode; level?: number; skill?: Skill }`.

- [ ] **Step 1: Implement Practice picker**

```svelte
<!-- src/routes/Practice.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import { stats } from '../stores/stats';
  import { SKILL_ERROR, type Skill } from '../core/difficulty';

  const SKILLS = Object.keys(SKILL_ERROR) as Skill[];
  const worst = $derived.by(() => {
    let best: Skill | null = null;
    let max = 0;
    for (const s of SKILLS) {
      const c = $stats.errors[SKILL_ERROR[s]] ?? 0;
      if (c > max) { max = c; best = s; }
    }
    return best;
  });
</script>

<main class="practice">
  <h2>
    <button class="back" aria-label={$t('nav.back')} onclick={() => go('home')}>←</button>
    {$t('practice.title')}
  </h2>
  <div class="grid">
    {#each SKILLS as s (s)}
      <button class="tile" class:worst={s === worst} onclick={() => go(`practice/${s}`)}>
        <span>{$t(`stats.err.${SKILL_ERROR[s]}`)}</span>
        {#if s === worst}<span class="badge">{$t('practice.weakest')}</span>{/if}
      </button>
    {/each}
  </div>
</main>

<style>
  .practice { max-width: 480px; margin: 0 auto; padding: 0.75rem; }
  h2 { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
  .back { background: none; color: var(--cream); font-size: 1.4rem; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.6rem; }
  .tile {
    display: flex; flex-direction: column; gap: 0.25rem; padding: 1rem 0.5rem;
    background: var(--wood-light); color: var(--cream);
  }
  .tile.worst { outline: 2px solid var(--accent); }
  .badge { color: var(--accent); font-size: 0.75rem; }
</style>
```

- [ ] **Step 2: Widen Game props + session factory**

In `src/routes/Game.svelte`:

```ts
  import { practiceParams, type Skill } from '../core/difficulty';   // extend existing difficulty import
  import type { SessionMode } from '../core/session';                 // extend existing session import

  let { mode, level = 1, skill = 'sums' }: {
    mode: SessionMode; level?: number; skill?: Skill;
  } = $props();

  function newSession() {
    const override = mode === 'practice' ? practiceParams(skill) : undefined;
    return createSession(
      mode, level, get(activeMenu), get(settings).useCustomMenu,
      Date.now() % 2 ** 31, override,
    );
  }
  let session = $state(newSession());
```

and in `restart()` replace the inline `createSession(...)` call with `session = newSession();`.

Header title line becomes mode-aware:

```svelte
    <span>{mode === 'level' ? `${$t('game.level')} ${level}`
      : mode === 'rush' ? `${$t('game.rush')} · ${session.level}`
      : mode === 'practice' ? $t('practice.title')
      : $t('daily.title')}</span>
```

(`daily.title` lands in i18n now; the daily route itself is Task 13.)

- [ ] **Step 3: Routes + Home button**

In `src/App.svelte`:

```ts
  import Practice from './routes/Practice.svelte';
  import { SKILL_ERROR, type Skill } from './core/difficulty';

  const practiceSkill = $derived.by(() => {
    const m = $route.match(/^practice\/([a-z]+)$/);
    return m && m[1] in SKILL_ERROR ? (m[1] as Skill) : null;
  });
```

and in the route markup, before the Home fallback:

```svelte
  {:else if practiceSkill !== null}
    <Game mode="practice" skill={practiceSkill} />
  {:else if $route === 'practice'}
    <Practice />
```

In `src/routes/Home.svelte`, add after the Rush button:

```svelte
  <button onclick={() => go('practice')}>{$t('home.practice')}</button>
```

- [ ] **Step 4: i18n + verify + commit**

`src/i18n/en.ts`:

```ts
  'home.practice': 'Practice',
  'practice.title': 'Practice',
  'practice.weakest': 'weakest skill',
  'daily.title': 'Daily challenge',
```

`src/i18n/de.ts`:

```ts
  'home.practice': 'Training',
  'practice.title': 'Training',
  'practice.weakest': 'schwächste Fähigkeit',
  'daily.title': 'Tages-Challenge',
```

Run: `npm run check` (0), `npm run build` (ok), `npx vitest run` (green).

```bash
git add src/routes/Practice.svelte src/routes/Game.svelte src/routes/Home.svelte src/App.svelte src/i18n
git commit -m "feat: practice mode with skill picker and drills"
```

---

### Task 13: daily challenge — route, ranked record, share

**Files:**
- Modify: `src/routes/Game.svelte`, `src/lib/EndOverlay.svelte`, `src/routes/Home.svelte`, `src/App.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`
- Test: compile gates; daily core covered by Task 5 tests

**Interfaces:**
- Consumes: `dailySeed`, `dailyKey`, `dailyLevelFor`, `DAILY_ORDERS`, `isRanked`, `nextDailyRecord`, `shareText` from `$core/daily`; `daily` store; `paramsForLevel`.
- Produces: route `daily`; EndOverlay gains optional `note?: string | null` prop.

- [ ] **Step 1: EndOverlay note prop**

In `src/lib/EndOverlay.svelte` add `note = null` to the props destructuring (type `note?: string | null;`) and render it after the accuracy line:

```svelte
  {#if note}<p class="note">{note}</p>{/if}
```

with style `.note { color: var(--accent); font-size: 0.9rem; }`.

- [ ] **Step 2: Game daily wiring**

Imports gain:

```ts
  import {
    dailySeed, dailyLevelFor, DAILY_ORDERS, isRanked, nextDailyRecord, shareText,
  } from '../core/daily';
  import { daily } from '../stores/daily';
```

Extend `newSession()`:

```ts
  function newSession() {
    const override = mode === 'practice'
      ? practiceParams(skill)
      : mode === 'daily'
        ? { ...paramsForLevel(dailyLevelFor(0)), ordersPerLevel: DAILY_ORDERS }
        : undefined;
    const seed = mode === 'daily' ? dailySeed(new Date()) : Date.now() % 2 ** 31;
    rankedRun = mode === 'daily' ? isRanked(get(daily), new Date()) : false;
    return createSession(
      mode, level, get(activeMenu), get(settings).useCustomMenu, seed, override,
    );
  }
```

(`paramsForLevel` joins the existing difficulty import list; add state `let rankedRun = $state(false);` and `let shareCopied = $state(false);` — reset `shareCopied = false;` in `restart()`.)

Extend `finalize()` with a daily branch (after the level branch):

```ts
    if (session.mode === 'daily') {
      const perfect = session.roundLog.length >= DAILY_ORDERS
        && session.roundLog.every((e) => e.success);
      daily.update((prev) => nextDailyRecord(prev, new Date(), session.score, perfect));
    }
```

Add the share handler:

```ts
  function doShare() {
    const served = session.roundLog.filter((e) => e.success).length;
    const text = shareText(
      new Date(), session.score, served, DAILY_ORDERS, get(daily)?.streak ?? 1,
    );
    navigator.clipboard?.writeText(text).then(() => (shareCopied = true)).catch(() => {});
  }
```

And pass the daily props to the overlay:

```svelte
  {#if session.finished && finalized}
    <EndOverlay
      {session} {level} {stars} {wasNewHigh} onretry={restart}
      onshare={mode === 'daily' ? doShare : null}
      shareLabel={shareCopied ? $t('daily.copied') : $t('daily.share')}
      note={mode === 'daily' && !rankedRun ? $t('daily.unranked') : null}
    />
  {/if}
```

- [ ] **Step 3: Route + Home button**

`src/App.svelte` route markup gains, before the Home fallback:

```svelte
  {:else if $route === 'daily'}
    <Game mode="daily" />
```

`src/routes/Home.svelte`:

```ts
  import { daily } from '../stores/daily';
  import { dailyKey } from '../core/daily';
  const doneToday = $derived($daily?.date === dailyKey(new Date()));
```

```svelte
  <button onclick={() => go('daily')}>{$t('home.daily')}{doneToday ? ' ✓' : ''}</button>
```

(placed after the Practice button).

- [ ] **Step 4: i18n + verify + commit**

`src/i18n/en.ts`:

```ts
  'home.daily': 'Daily challenge',
  'daily.share': 'Share result',
  'daily.copied': 'Copied!',
  'daily.unranked': 'Unranked replay — today already counted',
```

`src/i18n/de.ts`:

```ts
  'home.daily': 'Tages-Challenge',
  'daily.share': 'Ergebnis teilen',
  'daily.copied': 'Kopiert!',
  'daily.unranked': 'Ohne Wertung — heute zählt schon',
```

Run: `npm run check` (0), `npm run build` (ok), `npx vitest run` (green).

```bash
git add src/routes/Game.svelte src/lib/EndOverlay.svelte src/routes/Home.svelte src/App.svelte src/i18n
git commit -m "feat: seeded daily challenge with ranked record and share text"
```

---

### Task 14: animation pass — pops, slides, faces, heart pulse, tick sound

**Files:**
- Modify: `src/app.css`, `src/lib/Money.svelte`, `src/routes/Game.svelte`
- Test: compile gates; manual visual check via `npm run dev` is optional, not required for completion

- [ ] **Step 1: Keyframes + reduced motion in app.css**

Append to `src/app.css`:

```css
@keyframes op-pop {
  from { transform: scale(0.4); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes op-slide-up {
  from { transform: translateY(12px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes op-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.25); }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 2: Component hooks**

`src/lib/Money.svelte` — add to the button style block:

```css
  button { animation: op-pop 0.15s ease-out; }
```

`src/routes/Game.svelte` styles:

```css
  .flash { animation: op-slide-up 0.2s ease-out; }
  .amend { animation: op-slide-up 0.3s ease-out; }
  .lives.pulse { animation: op-pulse 0.5s ease-in-out; }
```

- [ ] **Step 3: Patience faces + heart pulse + tick**

In Game.svelte queue markup, replace the static face:

```svelte
        {@const frac = c.patienceMs / c.maxPatienceMs}
        <span class="face">{frac > 0.5 ? '😀' : frac > 0.25 ? '😐' : '😠'}</span>
        <PatienceBar {frac} />
```

Heart pulse: add state `let heartPulse = $state(false);` and a helper:

```ts
  function pulseHearts() {
    heartPulse = false;
    requestAnimationFrame(() => (heartPulse = true));
    setTimeout(() => (heartPulse = false), 600);
  }
```

Call `pulseHearts()` in two places: inside the walkout-flash branch (Task 9's block in the interval), and in `finishRound()` when `failed` is true. Bind it in the header:

```svelte
    <span class="lives" class:pulse={heartPulse}>{'♥'.repeat(Math.max(0, MAX_LIVES - session.livesLost))}</span>
```

Tick sound: import `tickTock` alongside the other sound imports, and in the interval (before the finished checks) add:

```ts
      if (round && session.queue[0]
          && session.queue[0].patienceMs < session.queue[0].maxPatienceMs * 0.25) {
        tickTock($settings.sound);
      }
```

- [ ] **Step 4: Verify + commit**

Run: `npm run check` (0), `npm run build` (ok), `npx vitest run` (green).

```bash
git add src/app.css src/lib/Money.svelte src/routes/Game.svelte
git commit -m "feat: animation pass with patience faces and low-time tick"
```

---

### Task 15: polish + final verification

**Files:**
- Modify: `src/routes/Game.svelte`, `src/App.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`, `README.md`

- [ ] **Step 1: Day streak counts the first served order**

In Game.svelte `finishRound()`, fold `recordDay` into the stats update:

```ts
    stats.update((s) => recordDay(recordRound(s, done.errors, ms, failed), new Date()));
```

(`recordDay` import already exists. Leave the `recordDay` call in `finalize()` — it is idempotent.)

- [ ] **Step 2: URL level clamp**

In `src/App.svelte`:

```ts
  import { progress, unlockedLevel } from './stores/progress';
```

and change the game-route branch to render the Levels map for locked levels (decision: rendering beats redirecting here — a `go()` inside render risks effect loops; the wrong-hash cosmetic is acceptable):

```svelte
  {#if gameLevel !== null && gameLevel <= unlockedLevel($progress)}
    <Game mode="level" level={gameLevel} />
  {:else if gameLevel !== null}
    <Levels />
```

- [ ] **Step 3: html lang + rush badge**

In `src/App.svelte` script:

```ts
  import { settings } from './stores/settings';

  $effect(() => {
    document.documentElement.lang = $settings.locale;
  });
```

In Game.svelte's header title, change the rush branch to cap the badge:

```svelte
      : mode === 'rush' ? `${$t('game.rush')} · ${session.level >= MAX_LEVEL ? '30+' : session.level}`
```

- [ ] **Step 4: Remove dead i18n keys**

Delete from BOTH `src/i18n/en.ts` and `src/i18n/de.ts`: `'game.change-prompt'`, `'menu.price'`, `'menu.save'`, `'menu.delete'`. Then `grep -rn "change-prompt\|menu.price\|menu.save\|menu.delete" src/` must return nothing.

- [ ] **Step 5: README update**

In `README.md`, extend the feature list with three bullets:

```markdown
- **Practice**: nine skill drills (sums, parsing, change, shortages, speed,
  payment traps, disputes, tabs, split bills) — the stats screen points you
  at your weakest one.
- **Daily challenge**: the same seeded 10-order gauntlet for everyone each
  day, with a copyable share line and its own streak.
- **Bar reality**: customers underpay, dispute what they handed you, order
  in waves on a tab, and split the bill.
```

- [ ] **Step 6: Full verification + commit**

Run: `npx vitest run` — all green (~110 tests).
Run: `npm run check` — 0 errors.
Run: `npm run build` — clean; `dist/` intact.

```bash
git add src/routes/Game.svelte src/App.svelte src/i18n README.md
git commit -m "feat: round-2 polish — streak timing, level clamp, lang sync, docs"
```

---

## Verification checklist (whole plan)

- `npx vitest run` — all suites green (~110 tests; core covers traps, disputes, tabs, splits, practice presets, daily determinism, round log, walkout reporting, stats migration).
- `npm run check` — 0 errors; `npm run build` — clean.
- Manual play passes: level 20+ with traps/tabs firing; a dispute answered right and wrong; practice drill from the stats train link; daily run + share copy + unranked replay note; DE locale spot-check of every new screen.
