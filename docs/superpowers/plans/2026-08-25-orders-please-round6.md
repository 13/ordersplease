# Orders, Please — Round 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement round 6 per `docs/superpowers/specs/2026-08-25-orders-please-round6-design.md`: happy hour, tip jar, and rowdy-customer mechanics; per-day stats history with an SVG chart; a coached "First Day" tutorial (level 0); and TWA/Play-Store packaging files.

**Architecture:** Pure core first (params, price/tip math, tutorial script, history helpers — all TDD), then Game.svelte wiring for the three mechanics, then the standalone Tutorial route reusing the round-5 SumPhase/ChangePhase components, then packaging docs/config. No new runtime dependencies; charts are hand-written SVG.

**Tech Stack:** unchanged — Svelte 5 (runes), Vite, TypeScript, Vitest, vite-plugin-pwa.

## Global Constraints

- All prior constraints hold: integer cents, core purity (src/core/ never imports Svelte/DOM), EN+DE via `t()` for every UI string, svelte-check 0 errors 0 warnings, build clean, suite green, no z-index (DOM-order stacking), persisted stores tolerate legacy payloads missing new fields.
- Determinism: every `session.rng` consumption happens unconditionally at a fixed point (roll first, decide after); cosmetic randomness uses `Math.random`. The happy-hour roll consumes exactly 2 rng calls in `createSession` regardless of outcome; the rowdy roll consumes exactly 1 rng call per `startRound` regardless of outcome.
- Mechanics gates: happy hour level ≥ 12 (anchors L14 0.3, L22 0.4, L30 0.5), rowdy level ≥ 16 (anchors L22 0.1, L30 0.15). Exact 0 strictly below the gate. Practice mode: both 0.
- Happy hour: rolled once at session start from starting params; active for 3 consecutive rounds; `happyHourPrice(c) = max(10, round(c*0.8/10)*10)`.
- Tip: `tipFor(total) = max(10, ceil(total*0.1/10)*10)`; earned on success && firstTry && no hints && patienceFrac ≥ 0.5; modes level/rush/daily only; split groups pay on the final payer using the whole-group total. Tipp button costs 50c from the jar when jar ≥ 50c, else the existing 25-point debt.
- Rowdy: plain normal rounds only (not underpaid, not tab/split); suppresses disputes that round; patience ×0.5 (floor 5000ms); score ×2 on success (roundLog entry patched too).
- Tutorial: fixed script, no rng, no timers, no score; completion marks `tutorial` in op.seen; every coach string EN+DE under `tutorial.*`.
- History: `op.history`, per-local-day `{rounds, correct, ms, tips}` (full rounds only, sub-rounds excluded), pruned to 60 days at write time.
- Every commit message ends with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01BFFLt2muz8HfETCzn4N1ok`

---

### Task 1: core happy hour — params, price math, session roll

**Files:**
- Create: `src/core/happy-hour.ts`
- Modify: `src/core/difficulty.ts`, `src/core/session.ts`
- Test: `tests/core/happy-hour.test.ts`, `tests/core/difficulty.test.ts` (extend), `tests/core/session.test.ts` (extend)

**Interfaces:**
- Produces:

```ts
// difficulty.ts — DifficultyParams gains:
happyHourProb: number;   // anchors: L1 0, L6 0, L14 0.3, L22 0.4, L30 0.5; gate 12
rowdyProb: number;       // anchors: L1 0, L6 0, L14 0, L22 0.1, L30 0.15; gate 16 (used by Task 2/4)

// happy-hour.ts
export const HAPPY_HOUR_ROUNDS = 3;
export function happyHourPrice(cents: number): number;           // max(10, round(c*0.8/10)*10)
export function discountMenu(menu: MenuItem[]): MenuItem[];       // maps priceCents through happyHourPrice
export function rollHappyHourStart(params: DifficultyParams, rng: () => number): number | null;
// ALWAYS consumes exactly 2 rng calls; null unless roll < happyHourProb;
// start index in [2, max(2, ordersPerLevel - 3)]
export function happyHourActive(s: SessionState): boolean;
// s.happyHourStart !== null && s.roundsDone >= start && s.roundsDone < start + HAPPY_HOUR_ROUNDS

// session.ts — SessionState gains:
happyHourStart: number | null;
```

- [ ] **Step 1: Failing tests**

`tests/core/happy-hour.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  happyHourPrice, discountMenu, rollHappyHourStart, HAPPY_HOUR_ROUNDS,
} from '../../src/core/happy-hour';
import { paramsForLevel } from '../../src/core/difficulty';

describe('happyHourPrice', () => {
  it('discounts 20% on the 10c grid with a 10c floor', () => {
    expect(happyHourPrice(400)).toBe(320);  // 4,00 → 3,20
    expect(happyHourPrice(450)).toBe(360);  // 4,50 → 3,60
    expect(happyHourPrice(250)).toBe(200);
    expect(happyHourPrice(1050)).toBe(840);
    expect(happyHourPrice(10)).toBe(10);    // floor
    expect(happyHourPrice(30)).toBe(20);    // 24 → 20
  });
});

describe('rollHappyHourStart', () => {
  it('consumes exactly 2 rng calls whether or not it fires', () => {
    let calls = 0;
    const rng = () => { calls += 1; return 0.99; };
    expect(rollHappyHourStart(paramsForLevel(20), rng)).toBe(null);
    expect(calls).toBe(2);
    calls = 0;
    const rngHit = () => { calls += 1; return 0.01; };
    const start = rollHappyHourStart(paramsForLevel(20), rngHit);
    expect(calls).toBe(2);
    expect(start).not.toBe(null);
  });
  it('places the start inside [2, ordersPerLevel-3]', () => {
    const p = paramsForLevel(22); // ordersPerLevel 12
    for (const r of [0, 0.4999, 0.9999]) {
      const start = rollHappyHourStart(p, mkRng([0, r]));
      expect(start).toBeGreaterThanOrEqual(2);
      expect(start).toBeLessThanOrEqual(9);
    }
  });
  it('never fires below the gate', () => {
    expect(rollHappyHourStart(paramsForLevel(11), mkRng([0, 0]))).toBe(null);
  });
});

function mkRng(vals: number[]): () => number {
  let i = 0;
  return () => vals[Math.min(i++, vals.length - 1)];
}
```

`tests/core/difficulty.test.ts` — append:

```ts
describe('round-6 mechanic params', () => {
  it('happy hour gates at 12', () => {
    expect(paramsForLevel(11).happyHourProb).toBe(0);
    expect(paramsForLevel(12).happyHourProb).toBeGreaterThan(0);
    expect(paramsForLevel(14).happyHourProb).toBeCloseTo(0.3);
    expect(paramsForLevel(30).happyHourProb).toBeCloseTo(0.5);
  });
  it('rowdy gates at 16', () => {
    expect(paramsForLevel(15).rowdyProb).toBe(0);
    expect(paramsForLevel(16).rowdyProb).toBeGreaterThan(0);
    expect(paramsForLevel(22).rowdyProb).toBeCloseTo(0.1);
    expect(paramsForLevel(30).rowdyProb).toBeCloseTo(0.15);
  });
  it('practice zeroes both', () => {
    for (const s of ['sums', 'traps', 'disputes'] as const) {
      expect(practiceParams(s).happyHourProb).toBe(0);
      expect(practiceParams(s).rowdyProb).toBe(0);
    }
  });
});
```

`tests/core/session.test.ts` — append:

```ts
describe('happy hour session roll', () => {
  it('is deterministic for a fixed seed', () => {
    const mk = () => createSession('level', 20, DEFAULT_MENU, false, 12345);
    const a = mk(); const b = mk();
    expect(a.happyHourStart).toEqual(b.happyHourStart);
    expect(a.rng()).toBe(b.rng());
  });
  it('is null when the level is below the gate', () => {
    expect(createSession('level', 5, DEFAULT_MENU, false, 1).happyHourStart).toBe(null);
  });
});
```

(Use the existing imports at the top of each test file; `DEFAULT_MENU` comes from `../../src/core/menu`.) Run: expect FAIL (missing fields/module).

- [ ] **Step 2: Implement**

`src/core/difficulty.ts`: add `happyHourProb: number; rowdyProb: number;` to `DifficultyParams`; add to every anchor (`happyHourProb`: 0, 0, 0.3, 0.4, 0.5 and `rowdyProb`: 0, 0, 0, 0.1, 0.15 for L1/L6/L14/L22/L30); in `paramsForLevel` init both to 0 in `result`, then after the existing gated lines:

```ts
  result.happyHourProb = gated(lerp(lo.happyHourProb, hi.happyHourProb, t), 12);
  result.rowdyProb = gated(lerp(lo.rowdyProb, hi.rowdyProb, t), 16);
```

In `practiceParams`, add `happyHourProb: 0, rowdyProb: 0,` to the base overrides.

`src/core/happy-hour.ts`:

```ts
import type { MenuItem } from './menu';
import type { DifficultyParams } from './difficulty';
import type { SessionState } from './session';

export const HAPPY_HOUR_ROUNDS = 3;

/** 20% off, rounded to the 10c grid, never below 10c. */
export function happyHourPrice(cents: number): number {
  return Math.max(10, Math.round((cents * 0.8) / 10) * 10);
}

export function discountMenu(menu: MenuItem[]): MenuItem[] {
  return menu.map((m) => ({ ...m, priceCents: happyHourPrice(m.priceCents) }));
}

/** Rolled once at session start. Always consumes exactly 2 rng calls. */
export function rollHappyHourStart(
  params: DifficultyParams, rng: () => number,
): number | null {
  const roll = rng();
  const pos = rng();
  if (params.happyHourProb <= 0 || roll >= params.happyHourProb) return null;
  const lo = 2;
  const hi = Math.max(lo, params.ordersPerLevel - 3);
  return lo + Math.floor(pos * (hi - lo + 1));
}

export function happyHourActive(s: SessionState): boolean {
  return s.happyHourStart !== null
    && s.roundsDone >= s.happyHourStart
    && s.roundsDone < s.happyHourStart + HAPPY_HOUR_ROUNDS;
}
```

`src/core/session.ts`: add `happyHourStart: number | null;` to `SessionState`; in `createSession`, after the `menu` line and before building `s`:

```ts
  const happyHourStart = rollHappyHourStart(params, rng);
```

and include `happyHourStart,` in the state literal (import `rollHappyHourStart` from './happy-hour').

- [ ] **Step 3: Run to PASS, then full suite + check + build**

Run: `npx vitest run` (all green; existing difficulty/session tests may need the two new fields in any hand-built params literals — update those literals, do NOT weaken assertions), `npm run check` 0/0, `npm run build` clean.

- [ ] **Step 4: Commit**

```bash
git add src/core/happy-hour.ts src/core/difficulty.ts src/core/session.ts tests/core
git commit -m "feat: happy hour core — params, price math, session roll"
```

---

### Task 2: core tips — tipFor + lifetime stats

**Files:**
- Create: `src/core/tips.ts`
- Modify: `src/stores/stats.ts`
- Test: `tests/core/tips.test.ts`

**Interfaces:**
- Produces:

```ts
// core/tips.ts
export function tipFor(totalCents: number): number; // max(10, ceil(total*0.1/10)*10)
export function tipEligible(i: {
  success: boolean; firstTry: boolean; usedHint: boolean; patienceFrac: number;
}): boolean; // success && firstTry && !usedHint && patienceFrac >= 0.5

// stores/stats.ts — Stats gains:
tipsEarnedCents?: number; // optional: legacy payloads lack it
export function recordTips(s: Stats, cents: number): Stats;
```

- [ ] **Step 1: Failing tests**

```ts
// tests/core/tips.test.ts
import { describe, it, expect } from 'vitest';
import { tipFor, tipEligible } from '../../src/core/tips';

describe('tipFor', () => {
  it('is 10% rounded UP to the 10c grid, min 10c', () => {
    expect(tipFor(400)).toBe(40);
    expect(tipFor(450)).toBe(50);   // 45 → 50
    expect(tipFor(1010)).toBe(110); // 101 → 110
    expect(tipFor(50)).toBe(10);    // 5 → min 10
  });
});

describe('tipEligible', () => {
  const base = { success: true, firstTry: true, usedHint: false, patienceFrac: 0.6 };
  it('requires all four conditions', () => {
    expect(tipEligible(base)).toBe(true);
    expect(tipEligible({ ...base, success: false })).toBe(false);
    expect(tipEligible({ ...base, firstTry: false })).toBe(false);
    expect(tipEligible({ ...base, usedHint: true })).toBe(false);
    expect(tipEligible({ ...base, patienceFrac: 0.49 })).toBe(false);
    expect(tipEligible({ ...base, patienceFrac: 0.5 })).toBe(true);
  });
});
```

Run FAIL.

- [ ] **Step 2: Implement**

```ts
// src/core/tips.ts
/** 10% of the order total, rounded up to the 10c grid, never below 10c. */
export function tipFor(totalCents: number): number {
  return Math.max(10, Math.ceil((totalCents * 0.1) / 10) * 10);
}

export function tipEligible(i: {
  success: boolean; firstTry: boolean; usedHint: boolean; patienceFrac: number;
}): boolean {
  return i.success && i.firstTry && !i.usedHint && i.patienceFrac >= 0.5;
}
```

`src/stores/stats.ts`: add `tipsEarnedCents?: number;` to `Stats` (leave `EMPTY` without it OR add `tipsEarnedCents: 0` to EMPTY — add it to EMPTY, the optional type covers legacy stored payloads), and:

```ts
export function recordTips(s: Stats, cents: number): Stats {
  return { ...s, tipsEarnedCents: (s.tipsEarnedCents ?? 0) + cents };
}
```

- [ ] **Step 3: PASS + suite + check + build; commit**

```bash
git add src/core/tips.ts src/stores/stats.ts tests/core/tips.test.ts
git commit -m "feat: tip math and lifetime tip stats"
```

---

### Task 3: history store — per-day aggregates

**Files:**
- Create: `src/stores/history.ts`
- Modify: `src/routes/Settings.svelte` (resetAll clears history)
- Test: `tests/stores/history.test.ts`

**Interfaces:**
- Produces:

```ts
// stores/history.ts
export interface DayEntry { rounds: number; correct: number; ms: number; tips: number }
export type History = Record<string, DayEntry>; // key: yyyy-mm-dd LOCAL
export const history: Writable<History>;        // persisted 'op.history', default {}
export function localDayKey(d: Date): string;
export function recordDayEntry(h: History, key: string, delta: DayEntry): History; // accumulates
export function pruneHistory(h: History, todayKey: string, keepDays?: number): History; // default 60
```

- [ ] **Step 1: Failing tests**

```ts
// tests/stores/history.test.ts
import { describe, it, expect } from 'vitest';
import {
  localDayKey, recordDayEntry, pruneHistory, type History,
} from '../../src/stores/history';

describe('history', () => {
  it('localDayKey formats local yyyy-mm-dd', () => {
    expect(localDayKey(new Date(2026, 7, 25))).toBe('2026-08-25');
    expect(localDayKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
  it('recordDayEntry accumulates into the day', () => {
    let h: History = {};
    h = recordDayEntry(h, '2026-08-25', { rounds: 6, correct: 5, ms: 60000, tips: 40 });
    h = recordDayEntry(h, '2026-08-25', { rounds: 4, correct: 4, ms: 30000, tips: 0 });
    expect(h['2026-08-25']).toEqual({ rounds: 10, correct: 9, ms: 90000, tips: 40 });
  });
  it('pruneHistory drops entries older than keepDays', () => {
    const h: History = {
      '2026-08-25': { rounds: 1, correct: 1, ms: 1, tips: 0 },
      '2026-06-01': { rounds: 1, correct: 1, ms: 1, tips: 0 }, // 85 days before
      '2026-07-01': { rounds: 1, correct: 1, ms: 1, tips: 0 }, // 55 days before
    };
    const pruned = pruneHistory(h, '2026-08-25', 60);
    expect(pruned['2026-06-01']).toBeUndefined();
    expect(pruned['2026-07-01']).toBeDefined();
    expect(pruned['2026-08-25']).toBeDefined();
    expect(pruneHistory(pruned, '2026-08-25', 60)).toEqual(pruned); // idempotent
  });
});
```

Run FAIL.

- [ ] **Step 2: Implement**

```ts
// src/stores/history.ts
import { persisted } from './persisted';

export interface DayEntry { rounds: number; correct: number; ms: number; tips: number }
export type History = Record<string, DayEntry>;

export const history = persisted<History>('op.history', {});

export function localDayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function recordDayEntry(h: History, key: string, delta: DayEntry): History {
  const prev = h[key] ?? { rounds: 0, correct: 0, ms: 0, tips: 0 };
  return {
    ...h,
    [key]: {
      rounds: prev.rounds + delta.rounds,
      correct: prev.correct + delta.correct,
      ms: prev.ms + delta.ms,
      tips: prev.tips + delta.tips,
    },
  };
}

/** Day keys sort lexicographically, so a string cutoff comparison is exact. */
export function pruneHistory(h: History, todayKey: string, keepDays = 60): History {
  const [y, m, d] = todayKey.split('-').map(Number);
  const cutoff = new Date(y, m - 1, d);
  cutoff.setDate(cutoff.getDate() - keepDays);
  const cutoffKey = localDayKey(cutoff);
  const out: History = {};
  for (const [k, v] of Object.entries(h)) if (k >= cutoffKey) out[k] = v;
  return out;
}
```

`src/routes/Settings.svelte` `resetAll()`: add `history.set({});` (import `history` from '../stores/history').

- [ ] **Step 3: PASS + suite + check + build; commit**

```bash
git add src/stores/history.ts src/routes/Settings.svelte tests/stores/history.test.ts
git commit -m "feat: per-day history store with 60-day pruning"
```

---

### Task 4: Game wiring — happy hour, rowdy, tip jar

**Files:**
- Modify: `src/routes/Game.svelte`, `src/lib/SumPhase.svelte`, `src/lib/ChangePhase.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`

This task wires all three mechanics into the current Game.svelte (post-round-5, ~749 lines). Anchor names below are from the current file — read it first.

- [ ] **Step 1: Happy hour**

Imports: `import { happyHourActive, discountMenu } from '../core/happy-hour';`

Derived (after `visibleMenu`):

```ts
  const happyHour = $derived(happyHourActive(session));
  const pricedMenu = $derived(happyHour ? discountMenu(visibleMenu) : visibleMenu);
```

In `startRound()`, replace both generation uses of `visibleMenu` with `pricedMenu` (`generateTab(pricedMenu, ...)` and `generateOrder(pricedMenu, ...)`). Change the MenuCard usage to `menu={pricedMenu}`.

Banner: directly under the `<header>` element add

```svelte
  {#if happyHour || rowdy}
    <div class="chips">
      {#if happyHour}<span class="chip">🍻 {$t('game.happy-hour')}</span>{/if}
      {#if rowdy}<span class="chip">⏱ {$t('game.rowdy')}</span>{/if}
    </div>
  {/if}
```

with styles:

```css
  .chips { display: flex; gap: 0.4rem; }
  .chip {
    background: var(--accent); color: var(--ink);
    border-radius: 999px; padding: 0.1rem 0.6rem;
    font-size: 0.8rem; font-weight: bold;
    animation: op-slide-up 0.2s ease-out;
  }
```

- [ ] **Step 2: Rowdy customer**

State: `let rowdy = $state(false);`

In `startRound()`, immediately after `disputeOptRoll = session.rng();` add the unconditional roll and application:

```ts
    const rowdyRoll = session.rng();
    rowdy = round !== null
      && rowdyRoll < session.params.rowdyProb
      && round.kind === 'normal'
      && round.paymentCents >= round.order.totalCents
      && !splitGroups;
    if (rowdy && session.queue[0]) {
      const head = session.queue[0];
      const capped = Math.max(5000, Math.floor(head.maxPatienceMs * 0.5));
      session = {
        ...session,
        queue: [
          { ...head, patienceMs: Math.min(head.patienceMs, capped), maxPatienceMs: capped },
          ...session.queue.slice(1),
        ],
      };
    }
```

Dispute suppression: in `confirmChange()`, wrap the dispute check: `const d = rowdy ? null : maybeDispute(...)` (keep the call shape otherwise; `disputeRoll` is still consumed at its usual fixed point in startRound — only the decision is suppressed).

Score doubling + cleanup in `finishRound()`: after `session = completeRound(session, done, { orderText, ms });` and the `maxStreak` line, insert:

```ts
    if (rowdy && done.success === true) {
      const gained = session.roundLog.at(-1)?.scoreGained ?? 0;
      session = {
        ...session,
        score: session.score + gained,
        roundLog: session.roundLog.map((e, i, arr) =>
          i === arr.length - 1 ? { ...e, scoreGained: e.scoreGained * 2 } : e),
      };
    }
    rowdy = false;
```

(The hint-debt settlement that follows keeps working on the doubled entry.) Reset `rowdy = false;` also in `restart()`.

- [ ] **Step 3: Tip jar**

State: `let tipJar = $state(0);` and `let tipsEarnedSession = 0;`

Imports: `tipFor, tipEligible` from '../core/tips'; `recordTips` from '../stores/stats'.

Earn — in `finishRound()`, immediately BEFORE `session = completeRound(...)` capture eligibility inputs (`frac` already exists; `done` is the round):

```ts
    const groupTotal = splitGroups
      ? splitGroups.reduce((s, g) => s + orderTotal(g), 0)
      : done.order.totalCents;
    const earnsTip = (mode === 'level' || mode === 'rush' || mode === 'daily')
      && tipEligible({
        success: done.success === true,
        firstTry: done.sumTries === 0 && done.changeTries === 0,
        usedHint: done.usedHint,
        patienceFrac: frac,
      });
```

then AFTER the rowdy block from Step 2:

```ts
    if (earnsTip) {
      const tip = tipFor(groupTotal);
      tipJar += tip;
      tipsEarnedSession += tip;
      stats.update((s) => recordTips(s, tip));
    }
```

NOTE: `frac` is currently computed just above `completeRound` — keep using that existing `const frac`.

Spend — `onTipp()` becomes:

```ts
  function onTipp() {
    if (!round || dispute || paused || round.phase === 'done') return;
    round = markHint(round);
    hintText = hintFor(round, hintIndex, $settings.locale);
    hintIndex += 1;
    if (tipJar >= 50) tipJar -= 50;
    else hintDebt += 25;
  }
```

Header display, after the flame span:

```svelte
    {#if tipJar > 0}<span class="jar">🫙 {formatEuro(tipJar, symbolFirst)}</span>{/if}
```

with style `.jar { font-size: 0.9rem; }`.

Tipp button label: `SumPhase.svelte` and `ChangePhase.svelte` each gain an optional prop `tippHint: string` (default `''`); in both components the existing Tipp button markup becomes `{$t('game.tipp')}{tippHint}`. Game passes to both:

```svelte
  tippHint={tipJar >= 50 ? ` (${formatEuro(50, symbolFirst)})` : ' (−25)'}
```

Resets: `restart()` gains `tipJar = 0; tipsEarnedSession = 0;`.

- [ ] **Step 4: History recording in finalize**

Imports: `history, recordDayEntry, pruneHistory, localDayKey` from '../stores/history'.

At the end of `finalize()` (after the badge block):

```ts
    const key = localDayKey(new Date());
    history.update((h) => pruneHistory(
      recordDayEntry(h, key, {
        rounds: fullRounds.length,
        correct: fullRounds.filter((e) => e.success).length,
        ms: fullRounds.reduce((s, e) => s + e.ms, 0),
        tips: tipsEarnedSession,
      }),
      key,
    ));
```

(`fullRounds` already exists in `finalize`.)

- [ ] **Step 5: i18n**

en: `'game.happy-hour': 'Happy hour!', 'game.rowdy': 'In a hurry!',`
de: `'game.happy-hour': 'Happy Hour!', 'game.rowdy': 'In Eile!',`

- [ ] **Step 6: Verify + commit**

Run: `npx vitest run` green; `npm run check` 0/0; `npm run build` clean.

```bash
git add src/routes/Game.svelte src/lib/SumPhase.svelte src/lib/ChangePhase.svelte src/i18n
git commit -m "feat: happy hour, rowdy customers, and a tip jar in play"
```

---

### Task 5: Stats — 14-day SVG chart + lifetime tips

**Files:**
- Modify: `src/routes/Stats.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`

Design deviation (deliberate, YAGNI): the spec's "most common error of the last 7 days" line is dropped — history does not store per-day error types, and the existing lifetime "worst error + train" hint on this screen already covers the guidance. Note this in the task report.

- [ ] **Step 1: Chart**

In `Stats.svelte` script:

```ts
  import { history, localDayKey, type DayEntry } from '../stores/history';
  import { formatEuro } from '../core/money';

  const days = $derived.by(() => {
    const out: { key: string; entry: DayEntry | null }[] = [];
    const d = new Date();
    d.setDate(d.getDate() - 13);
    for (let i = 0; i < 14; i++) {
      const key = localDayKey(d);
      out.push({ key, entry: $history[key] ?? null });
      d.setDate(d.getDate() + 1);
    }
    return out;
  });
  const maxRounds = $derived(Math.max(1, ...days.map((x) => x.entry?.rounds ?? 0)));
  const hasHistory = $derived(days.some((x) => x.entry));
```

Markup after the `<dl>` block:

```svelte
  {#if hasHistory}
    <h3>{$t('stats.history')}</h3>
    <svg class="chart" viewBox="0 0 280 84" role="img" aria-label={$t('stats.history')}>
      {#each days as { key, entry }, i (key)}
        {#if entry}
          {@const h = (entry.rounds / maxRounds) * 60}
          <rect x={i * 20 + 3} y={70 - h} width="14" height={h} rx="2" class="bar-r" />
          {@const acc = entry.rounds > 0 ? entry.correct / entry.rounds : 0}
          <circle cx={i * 20 + 10} cy={70 - acc * 60} r="2.5" class="dot" />
        {/if}
        <text x={i * 20 + 10} y="80" class="lbl">{key.slice(8)}</text>
      {/each}
    </svg>
  {/if}
```

with styles:

```css
  .chart { width: 100%; height: auto; background: var(--wood-light); border-radius: var(--radius); }
  .bar-r { fill: var(--accent); opacity: 0.55; }
  .dot { fill: var(--cream); }
  .lbl { fill: var(--cream); opacity: 0.6; font-size: 6px; text-anchor: middle; }
```

- [ ] **Step 2: Lifetime tips card**

Add to the `<dl>` grid:

```svelte
    <div><dt>{$t('stats.tips')}</dt><dd>{formatEuro($stats.tipsEarnedCents ?? 0, $settings.symbolFirst)}</dd></div>
```

(import `settings` from '../stores/settings').

- [ ] **Step 3: i18n**

en: `'stats.history': 'Last 14 days', 'stats.tips': 'Tips earned',`
de: `'stats.history': 'Letzte 14 Tage', 'stats.tips': 'Trinkgeld verdient',`

- [ ] **Step 4: Verify + commit**

Run: suite green; check 0/0; build clean.

```bash
git add src/routes/Stats.svelte src/i18n
git commit -m "feat: 14-day history chart and lifetime tips on Stats"
```

---

### Task 6: core tutorial script

**Files:**
- Create: `src/core/tutorial.ts`
- Test: `tests/core/tutorial.test.ts`

**Interfaces:**
- Produces:

```ts
// core/tutorial.ts
import type { Denom, Till } from './till';
export interface TutorialStep {
  lines: { id: string; qty: number }[];
  totalCents: number;
  paymentPieces: Denom[];
  changeDue: number;       // after any ask
  needsAsk: boolean;
  askDenom: Denom | null;  // 50 for step 3
}
export const TUTORIAL_STEPS: TutorialStep[]; // exactly 3
export function tutorialTill(step: number): Till;
// steps 0/1: fullTill(); step 2: fullTill() with 50c, 20c and 10c counts set to 0
```

Script facts (prices from DEFAULT_MENU): step 1 Beer 4,00 paid [200, 200] exact (changeDue 0, Finish flow); step 2 Water 2,50 + Cola 3,00 = 5,50 paid [1000] (changeDue 4,50); step 3 Wine 4,50 paid [500] — till cannot make 50c, ask for 50c, payment becomes 5,50, changeDue 100.

- [ ] **Step 1: Failing tests**

```ts
// tests/core/tutorial.test.ts
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
```

Run FAIL.

- [ ] **Step 2: Implement**

```ts
// src/core/tutorial.ts
import { fullTill, type Denom, type Till } from './till';

export interface TutorialStep {
  lines: { id: string; qty: number }[];
  totalCents: number;
  paymentPieces: Denom[];
  changeDue: number;
  needsAsk: boolean;
  askDenom: Denom | null;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { lines: [{ id: 'beer', qty: 1 }], totalCents: 400,
    paymentPieces: [200, 200], changeDue: 0, needsAsk: false, askDenom: null },
  { lines: [{ id: 'water', qty: 1 }, { id: 'cola', qty: 1 }], totalCents: 550,
    paymentPieces: [1000], changeDue: 450, needsAsk: false, askDenom: null },
  { lines: [{ id: 'wine', qty: 1 }], totalCents: 450,
    paymentPieces: [500], changeDue: 100, needsAsk: true, askDenom: 50 },
];

export function tutorialTill(step: number): Till {
  const t = fullTill();
  if (step === 2) { t[50] = 0; t[20] = 0; t[10] = 0; }
  return t;
}
```

- [ ] **Step 3: PASS + suite + check + build; commit**

```bash
git add src/core/tutorial.ts tests/core/tutorial.test.ts
git commit -m "feat: fixed tutorial script for First Day"
```

---

### Task 7: Tutorial route

**Files:**
- Create: `src/routes/Tutorial.svelte`
- Modify: `src/App.svelte`, `src/lib/SumPhase.svelte`, `src/lib/ChangePhase.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`

- [ ] **Step 1: Component prop for extras**

`SumPhase.svelte`: add optional prop `showTipp: boolean` default `true`; wrap the Tipp button in `{#if showTipp}`. `ChangePhase.svelte`: add optional prop `showExtras: boolean` default `true`; wrap the Tipp AND Not-enough buttons each in `{#if showExtras}` (Ask button stays — the tutorial teaches it). Existing Game usage passes nothing → defaults keep behavior.

- [ ] **Step 2: Tutorial.svelte**

```svelte
<!-- src/routes/Tutorial.svelte -->
<script lang="ts">
  import { get } from 'svelte/store';
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import { settings } from '../stores/settings';
  import { markSeen } from '../stores/seen';
  import { TUTORIAL_STEPS, tutorialTill } from '../core/tutorial';
  import { localizedDefaultMenu } from '../core/menu';
  import { createRound, submitSum, submitChange, askCustomer, type RoundState } from '../core/round';
  import { orderTotal, piecesTotal, type OrderLine } from '../core/order';
  import { renderOrder } from '../core/text-order';
  import { formatEuro } from '../core/money';
  import type { Denom } from '../core/till';
  import { chaChing, coinClink, errorBuzz } from '../lib/sound';
  import MenuCard from '../lib/MenuCard.svelte';
  import SumPhase from '../lib/SumPhase.svelte';
  import ChangePhase from '../lib/ChangePhase.svelte';

  const menu = $derived(localizedDefaultMenu($settings.locale));
  let step = $state(0);
  let round = $state<RoundState | null>(null);
  let pile = $state<Denom[]>([]);
  let askOpen = $state(false);
  let coach = $state('');
  let finished = $state(false);

  const tillView = $derived.by(() => {
    if (!round) return tutorialTill(step);
    const view = { ...round.till };
    for (const p of pile) view[p] -= 1;
    return view;
  });

  function linesFor(stepIdx: number): OrderLine[] {
    return TUTORIAL_STEPS[stepIdx].lines.map((l) => ({
      item: menu.find((m) => m.id === l.id)!, qty: l.qty,
    }));
  }
  const orderText = $derived.by(() => {
    if (!round) return '';
    return renderOrder(round.order, $settings.locale);
  });

  function startStep(i: number) {
    step = i;
    const s = TUTORIAL_STEPS[i];
    const lines = linesFor(i);
    round = createRound(
      { lines, totalCents: orderTotal(lines) }, s.paymentPieces, tutorialTill(i),
    );
    pile = [];
    askOpen = false;
    coach = get(t)(`tutorial.s${i + 1}.sum`);
  }

  function onSum(cents: number) {
    if (!round) return;
    if (cents !== round.order.totalCents) {
      errorBuzz($settings.sound);
      coach = get(t)('tutorial.wrong-sum').replace(
        '{total}', formatEuro(round.order.totalCents, $settings.symbolFirst));
      return;
    }
    round = submitSum(round, cents);
    coach = get(t)(`tutorial.s${step + 1}.change`);
  }

  function take(d: Denom) {
    if ((tillView[d] ?? 0) > 0) { pile = [...pile, d]; coinClink($settings.sound); }
  }
  function ret(i: number) { pile = pile.toSpliced(i, 1); }

  function confirm() {
    if (!round) return;
    if (piecesTotal(pile) !== round.changeDue) {
      errorBuzz($settings.sound);
      coach = get(t)('tutorial.wrong-change').replace(
        '{change}', formatEuro(round.changeDue, $settings.symbolFirst));
      pile = [];
      return;
    }
    round = submitChange(round, pile);
    chaChing($settings.sound);
    if (step + 1 < TUTORIAL_STEPS.length) startStep(step + 1);
    else {
      finished = true;
      round = null;
      markSeen('tutorial');
    }
  }

  function onAsk(d: Denom) {
    if (!round) return;
    askOpen = false;
    const s = TUTORIAL_STEPS[step];
    if (!s.needsAsk || d !== s.askDenom) {
      errorBuzz($settings.sound);
      coach = get(t)('tutorial.ask-hint');
      return;
    }
    round = askCustomer(round, d);
    coach = get(t)('tutorial.s3.after-ask');
  }

  function onNotEnough() { /* hidden via showExtras */ }

  startStep(0);
</script>

<main class="tutorial">
  <header>
    <button class="back" onclick={() => go('home')} aria-label={$t('nav.back')}>←</button>
    <span>0 · {$t('tutorial.name')}</span>
    <button class="skip" onclick={() => { markSeen('tutorial'); go('home'); }}>{$t('tutorial.skip')}</button>
  </header>

  <p class="coach">{coach}</p>

  {#if round}
    <p class="order">“{orderText}”</p>
    <MenuCard {menu} pricesHidden={false} symbolFirst={$settings.symbolFirst} />
    {#key round.phase}
      <div class="phase">
        {#if round.phase === 'sum'}
          <SumPhase
            locked={false} symbolFirst={$settings.symbolFirst}
            onsum={onSum} ontipp={() => {}} showTipp={false}
            bindApi={() => {}}
          />
        {:else if round.phase === 'change'}
          <ChangePhase
            paymentPieces={round.paymentPieces}
            {tillView} {pile}
            showPileTotal={true} showKeys={true}
            finishMode={round.changeDue === 0}
            {askOpen} showExtras={false}
            ontake={take} onreturn={ret} onconfirm={confirm}
            ontoggleask={() => (askOpen = !askOpen)}
            onask={onAsk} onnotenough={onNotEnough} ontipp={() => {}}
          />
        {/if}
      </div>
    {/key}
  {/if}

  {#if finished}
    <div class="done">
      <h2>{$t('tutorial.done-title')}</h2>
      <p>{$t('tutorial.done-body')}</p>
      <button class="go" onclick={() => go('game/1')}>{$t('tutorial.done-cta')}</button>
    </div>
  {/if}
</main>

<style>
  .tutorial {
    display: flex; flex-direction: column; gap: 0.75rem;
    max-width: 480px; margin: 0 auto; padding: 0.75rem; min-height: 100dvh;
  }
  header { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
  .back { background: none; color: var(--cream); font-size: 1.4rem; }
  .skip { background: var(--wood-light); color: var(--cream); font-size: 0.85rem; }
  .coach {
    background: var(--accent); color: var(--ink);
    border-radius: var(--radius); padding: 0.6rem 0.8rem; font-weight: bold;
    animation: op-slide-up 0.2s ease-out;
  }
  .order { font-size: 1.15rem; font-style: italic; }
  .phase { display: flex; flex-direction: column; gap: 0.75rem; }
  .done { display: flex; flex-direction: column; gap: 0.6rem; align-items: center; text-align: center; padding: 1.5rem 0; }
  .go { background: var(--ok); color: var(--cream); font-size: 1.1rem; padding: 0.6rem 1.4rem; }
</style>
```

Keyboard: the existing App-level route focus plus SumPhase's Numpad and ChangePhase's buttons make it tabbable; no custom onKey handler in the tutorial (Numpad digits work by click/tab — acceptable; the game itself teaches the shortcuts).

- [ ] **Step 3: Route in App.svelte**

Add `import Tutorial from './routes/Tutorial.svelte';` and a branch `{:else if $route === 'tutorial'}<Tutorial />` alongside the other routes. Note `onGameRoute` stays false for the tutorial, so App's global Escape-to-home works there — intended.

- [ ] **Step 4: i18n (both languages)**

en:

```ts
  'tutorial.name': 'First Day',
  'tutorial.skip': 'Skip',
  'tutorial.s1.sum': 'Your first customer! Read the order, add up the prices on the menu, and type the total.',
  'tutorial.s1.change': 'They paid exactly the total — nothing to give back. Press Finish.',
  'tutorial.s2.sum': 'Two items this time. Add both prices and type the total.',
  'tutorial.s2.change': 'They paid more than the total. Click coins and notes from the till until the pile matches the change, then Confirm.',
  'tutorial.s3.sum': 'One more. Type the total.',
  'tutorial.s3.change': 'You owe 50 cents — but the till has no small coins! Press Ask and ask for 50 cents.',
  'tutorial.s3.after-ask': 'They gave you 50 cents more, so now you owe a full euro. Give 1 € and Confirm.',
  'tutorial.wrong-sum': 'Not quite — check the menu prices again. The total is {total}.',
  'tutorial.wrong-change': 'That pile is not right — the change due is {change}. Try again.',
  'tutorial.ask-hint': 'Ask for the coin that would make the change work: 50 cents.',
  'tutorial.done-title': 'Ready for your first shift!',
  'tutorial.done-body': 'You can sum orders, give change, and handle a coin shortage. The real bar also has timers, tips and trickier customers.',
  'tutorial.done-cta': 'Start level 1',
```

de:

```ts
  'tutorial.name': 'Erster Tag',
  'tutorial.skip': 'Überspringen',
  'tutorial.s1.sum': 'Dein erster Gast! Lies die Bestellung, addiere die Preise von der Karte und tippe die Summe ein.',
  'tutorial.s1.change': 'Passend bezahlt — nichts zurückzugeben. Drück auf Fertig.',
  'tutorial.s2.sum': 'Diesmal zwei Sachen. Addiere beide Preise und tippe die Summe ein.',
  'tutorial.s2.change': 'Es wurde mehr bezahlt. Klicke Münzen und Scheine aus der Kasse, bis der Stapel dem Rückgeld entspricht, dann Bestätigen.',
  'tutorial.s3.sum': 'Noch einer. Tippe die Summe ein.',
  'tutorial.s3.change': 'Du schuldest 50 Cent — aber die Kasse hat kein Kleingeld! Drück auf Fragen und bitte um 50 Cent.',
  'tutorial.s3.after-ask': 'Du hast 50 Cent extra bekommen, jetzt schuldest du einen ganzen Euro. Gib 1 € und Bestätigen.',
  'tutorial.wrong-sum': 'Nicht ganz — schau nochmal auf die Karte. Die Summe ist {total}.',
  'tutorial.wrong-change': 'Der Stapel stimmt nicht — das Rückgeld ist {change}. Versuch es nochmal.',
  'tutorial.ask-hint': 'Bitte um die Münze, mit der das Rückgeld klappt: 50 Cent.',
  'tutorial.done-title': 'Bereit für die erste Schicht!',
  'tutorial.done-body': 'Du kannst Bestellungen addieren, Rückgeld geben und mit Münzmangel umgehen. In der echten Bar gibt es dazu Zeitdruck, Trinkgeld und kniffligere Gäste.',
  'tutorial.done-cta': 'Level 1 starten',
```

- [ ] **Step 5: Verify + commit**

Run: suite green; check 0/0; build clean.

```bash
git add src/routes/Tutorial.svelte src/App.svelte src/lib/SumPhase.svelte src/lib/ChangePhase.svelte src/i18n
git commit -m "feat: coached First Day tutorial"
```

---

### Task 8: tutorial entry points

**Files:**
- Modify: `src/routes/Levels.svelte`, `src/routes/Home.svelte`, `src/routes/Settings.svelte`, `src/stores/seen.ts` (only if the store itself is not exported), `src/i18n/en.ts`, `src/i18n/de.ts`

- [ ] **Step 1: seen store export**

Check `src/stores/seen.ts`: it must export the underlying persisted store (e.g. `export const seen = persisted<string[]>('op.seen', [])`). If `markSeen` is the only export, add the store export without changing `markSeen`.

- [ ] **Step 2: Levels tile**

In `Levels.svelte`, before the `{#each levels ...}` block inside the same `.grid`:

```svelte
    <button class="level tut" onclick={() => go('tutorial')}>
      <span class="num">0</span>
      <span class="stars">{$seen.includes('tutorial') ? '✓' : ''}</span>
      <span class="lname">{$t('tutorial.name')}</span>
    </button>
```

(import `seen` from '../stores/seen'; style `.tut { border: 1px dashed var(--accent); }`). Grid geometry: keynav cols stay 5; the extra tile shifts the grid by one — acceptable (nextIndex works on the full list).

- [ ] **Step 3: Home first-launch suggestion**

In `Home.svelte`: import `seen`; add

```ts
  const suggestTutorial = $derived(level === 1 && !$seen.includes('tutorial'));
```

and change the Play button:

```svelte
  <button class="play" onclick={() => go(suggestTutorial ? 'tutorial' : `game/${level}`)}>
    <strong>{suggestTutorial ? $t('tutorial.name') : $t('home.play')}</strong>
    <span>{suggestTutorial ? $t('home.tutorial-sub') : $t('home.continue').replace('{n}', String(level))}</span>
  </button>
```

(Dismissable: the tutorial's Skip button marks it seen, so Play reverts to normal.)

- [ ] **Step 4: Settings replay**

In `Settings.svelte`, above the reset button:

```svelte
  <button class="replay" onclick={() => go('tutorial')}>{$t('settings.replay-tutorial')}</button>
```

with style `.replay { background: var(--wood-light); color: var(--cream); }`.

- [ ] **Step 5: i18n**

en: `'home.tutorial-sub': 'Learn the bar in three orders', 'settings.replay-tutorial': 'Replay tutorial',`
de: `'home.tutorial-sub': 'Lerne die Bar in drei Bestellungen', 'settings.replay-tutorial': 'Tutorial wiederholen',`

- [ ] **Step 6: Verify + commit**

Run: suite green; check 0/0; build clean.

```bash
git add src/routes/Levels.svelte src/routes/Home.svelte src/routes/Settings.svelte src/stores/seen.ts src/i18n
git commit -m "feat: tutorial entry points on map, home and settings"
```

---

### Task 9: TWA packaging files

**Files:**
- Create: `twa-manifest.json`, `public/.well-known/assetlinks.json`
- Modify: `docs/twa.md`, `README.md`

- [ ] **Step 1: twa-manifest.json** (repo root)

```json
{
  "packageId": "de.egger.ordersplease",
  "host": "13.github.io",
  "name": "Orders, Please",
  "launcherName": "Orders",
  "display": "standalone",
  "themeColor": "#2b1d12",
  "backgroundColor": "#2b1d12",
  "startUrl": "/ordersplease/",
  "iconUrl": "https://13.github.io/ordersplease/pwa-512.png",
  "maskableIconUrl": "https://13.github.io/ordersplease/pwa-maskable-512.png",
  "orientation": "portrait",
  "webManifestUrl": "https://13.github.io/ordersplease/manifest.webmanifest",
  "fallbackType": "customtabs",
  "enableNotifications": false
}
```

- [ ] **Step 2: assetlinks.json**

`public/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "de.egger.ordersplease",
    "sha256_cert_fingerprints": ["REPLACE_WITH_SHA256_FINGERPRINT"]
  }
}]
```

Verify it ships: run `npm run build` and check `dist/.well-known/assetlinks.json` exists (Vite copies `public/` verbatim).

- [ ] **Step 3: docs/twa.md walkthrough**

Rewrite `docs/twa.md` as a complete numbered walkthrough (keep any still-valid content): 1. prerequisites (Node, JDK 17, Android SDK via Bubblewrap's own prompt); 2. `npm i -g @bubblewrap/cli`; 3. `bubblewrap init --manifest https://13.github.io/ordersplease/manifest.webmanifest` (or point at the checked-in `twa-manifest.json`); 4. keystore: Bubblewrap generates one — back it up; 5. fingerprint: `keytool -list -v -keystore android.keystore -alias android` → copy SHA256; 6. replace `REPLACE_WITH_SHA256_FINGERPRINT` in `public/.well-known/assetlinks.json`, commit, push, wait for the Pages deploy; 7. `bubblewrap build` → `app-release-signed.apk` / `.aab`; 8. test on-device (`adb install`), confirm no browser chrome (asset links verified); 9. Play Console: create app, upload the `.aab`, complete listing. Note: the fingerprint swap must be deployed BEFORE testing, or the TWA shows browser UI.

- [ ] **Step 4: README line**

Under the play link line add:

```markdown
<p align="center"><sub>Installable as an app — see <a href="docs/twa.md">docs/twa.md</a> for the Play Store (TWA) walkthrough.</sub></p>
```

- [ ] **Step 5: Verify + commit**

Run: `npm run build` clean + assetlinks in dist; `OP_BASE=/ordersplease/ npm run build` clean; suite green; check 0/0.

```bash
git add twa-manifest.json public/.well-known/assetlinks.json docs/twa.md README.md
git commit -m "feat: TWA packaging config and Play Store walkthrough"
```

---

### Task 10: final verification

**Files:** none new — verification only (fix nothing silently; report anything red).

- [ ] **Step 1:** `npx vitest run` all green (~180); `npm run check` 0 errors 0 warnings; `npm run build` clean; `OP_BASE=/ordersplease/ npm run build` clean.
- [ ] **Step 2:** grep gates: `grep -rn "session.rng" src/routes src/lib` → only pre-existing fixed-point call sites in Game.svelte (startRound/nextPayer); `grep -rn "z-index" src/` → empty; `grep -c "tutorial\." src/i18n/en.ts src/i18n/de.ts` → equal counts; `grep -rn "Math.random" src/core` → empty (the core rng is seeded mulberry32).
- [ ] **Step 3:** Report results. No commit unless something needed fixing (then report what).

---

## Verification checklist (whole plan)

- Suite green; svelte-check 0/0; both base-path builds clean; assetlinks.json present in dist.
- Manual pass: tutorial completes keyboard+mouse; level ≥ 12 shows a happy hour with visibly cheaper menu and matching totals; level ≥ 16 eventually shows a rushed customer with halved fuse and doubled points; a perfect fast round pops the tip jar; Tipp shows its price and drains the jar first; Stats shows the 14-day chart after a session.
- Determinism: two daily runs on the same seed behave identically.
