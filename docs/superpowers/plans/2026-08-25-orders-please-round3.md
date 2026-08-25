# Orders, Please — Round 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement round 3 per `docs/superpowers/specs/2026-08-25-orders-please-round3-design.md`: rush-continuation and German-menu bug fixes, euros-first entry + full keyboard play, pause/Esc-menu/keyboard navigation, steeper difficulty curve, Tipp hints, praise messages, new logo, UX modernization.

**Architecture:** Core-first as always: session spawn cap, `localizedDefaultMenu`, `parseEntry`, rebalanced difficulty anchors, `hints.ts`, `usedHint` round flag — all TDD. UI layer: reworked Numpad with an imperative api for keyboard input, a `PausableTimer` helper replacing the four raw Game timers, `PauseOverlay` + global key handler, `keynav.ts` roving-tabindex action, praise helper, new logo assets, Home/Game/overlay restyle on shared tokens.

**Tech Stack:** unchanged — Svelte 5 (runes), Vite, TypeScript, Vitest (fake timers for PausableTimer), vite-plugin-pwa. No new runtime dependencies.

## Global Constraints

- All prior constraints hold: integer cents, `src/core/` never imports Svelte/DOM, EN+DE for every UI string via `t()`, svelte-check 0 errors 0 warnings, build clean, `npx vitest run` green.
- Rush spawn cap: on round completion in rush with an empty queue, `spawnCooldownMs = Math.min(spawnCooldownMs, 1500)`.
- Default-menu names localize (DE: Bier, Veneziano, Wasser, Cola, Wein, Kaffee); custom menu names never touched; item ids and prices identical across locales (seed-neutral).
- Entry: typing `5` → 500 cents; `4,5` → 450; at most one comma, ≤2 decimals, ≤4 euro digits; empty keeps OK disabled.
- Keyboard map (Game only, never when an input element has focus): digits/comma/Backspace/Enter in sum phase; `1`–`0` = DENOMS order (1 = 50 €, …, 0 = 5c), Enter = Confirm/Finish, `A` = Ask, `N` = Not enough, `T` = Tipp in change phase; Space = pause toggle; Esc = game menu.
- New difficulty anchors at levels 1/8/18/30 exactly per the spec table; mechanic entry gates underpay 8, tab 10, dispute 12, split 15 (exact 0 strictly below); practice base rebases to L14.
- Tipp: −25 points per press, session score floors at its pre-round value; round loses first-try bonus via `usedHint`; error stats untouched; no hint during disputes.
- Praise pool picked with `Math.random`, NEVER `session.rng` (daily determinism).
- Pause freezes `tickSession` AND all round timers (remaining-time preserved); order text hidden while paused.
- All new motion behind the existing `prefers-reduced-motion` kill switch.
- Every commit message ends with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01BFFLt2muz8HfETCzn4N1ok`

---

### Task 1: rush fast-spawn cap

**Files:**
- Modify: `src/core/session.ts` (completeRound), `tests/core/session.test.ts`

**Interfaces:**
- Produces: unchanged signatures; new behavior only — after `completeRound` in rush mode with an empty queue, `spawnCooldownMs <= 1500`.

- [ ] **Step 1: Write failing test**

Append to `tests/core/session.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/session.test.ts`
Expected: first new test FAILS (cooldown still ~28000).

- [ ] **Step 3: Implement**

In `src/core/session.ts`, in `completeRound`, after the `next` object is built and BEFORE `next = checkLost(next)`, add:

```ts
  // rush: never leave the bar dead — if the queue just emptied, hurry the next customer
  if (next.mode === 'rush' && next.queue.length === 0) {
    next.spawnCooldownMs = Math.min(next.spawnCooldownMs, 1500);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/session.test.ts` — all pass. Then `npx vitest run` — full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/core/session.ts tests/core/session.test.ts
git commit -m "fix: rush spawns the next customer promptly when the queue empties"
```

---

### Task 2: localized default menu

**Files:**
- Modify: `src/core/menu.ts`, `src/stores/menu.ts`, `src/routes/Game.svelte` (daily path), `tests/core/menu.test.ts`

**Interfaces:**
- Produces: `localizedDefaultMenu(locale: 'en' | 'de'): MenuItem[]` — same ids/prices/order as `DEFAULT_MENU`, names localized. `activeMenu` store becomes locale-aware. Custom menus untouched.

- [ ] **Step 1: Write failing tests**

Append to `tests/core/menu.test.ts`:

```ts
import { localizedDefaultMenu } from '$core/menu';

describe('localizedDefaultMenu', () => {
  it('DE names are translated, ids and prices identical', () => {
    const de = localizedDefaultMenu('de');
    const en = localizedDefaultMenu('en');
    expect(de.map((m) => m.name)).toEqual(['Bier', 'Veneziano', 'Wasser', 'Cola', 'Wein', 'Kaffee']);
    expect(de.map((m) => m.id)).toEqual(en.map((m) => m.id));
    expect(de.map((m) => m.priceCents)).toEqual(en.map((m) => m.priceCents));
  });
  it('EN equals DEFAULT_MENU', () => {
    expect(localizedDefaultMenu('en')).toEqual(DEFAULT_MENU);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/menu.test.ts` — FAIL: not exported.

- [ ] **Step 3: Implement core helper**

Append to `src/core/menu.ts`:

```ts
const DE_NAMES: Record<string, string> = {
  beer: 'Bier', veneziano: 'Veneziano', water: 'Wasser',
  cola: 'Cola', wine: 'Wein', coffee: 'Kaffee',
};

/** Default menu with localized display names; ids, prices, and order are
 *  identical across locales so seeded generation stays deterministic. */
export function localizedDefaultMenu(locale: 'en' | 'de'): MenuItem[] {
  if (locale === 'en') return DEFAULT_MENU.map((m) => ({ ...m }));
  return DEFAULT_MENU.map((m) => ({ ...m, name: DE_NAMES[m.id] ?? m.name }));
}
```

- [ ] **Step 4: Wire the stores and Game**

Replace `src/stores/menu.ts` content:

```ts
import { derived } from 'svelte/store';
import { persisted } from './persisted';
import { DEFAULT_MENU, localizedDefaultMenu, type MenuItem } from '../core/menu';
import { settings } from './settings';

export const customMenu = persisted<MenuItem[]>(
  'op.custom-menu',
  DEFAULT_MENU.map((m) => ({ ...m })),
);

export const activeMenu = derived([settings, customMenu], ([$s, $c]) =>
  $s.useCustomMenu && $c.length > 0 ? $c : localizedDefaultMenu($s.locale),
);
```

In `src/routes/Game.svelte` `newSession()`, change the daily menu argument from `DEFAULT_MENU` to `localizedDefaultMenu(get(settings).locale)` and update the import: `import { localizedDefaultMenu } from '../core/menu';` replaces the `DEFAULT_MENU` import.

- [ ] **Step 5: Verify + commit**

Run: `npx vitest run` green; `npm run check` 0/0; `npm run build` ok.

```bash
git add src/core/menu.ts src/stores/menu.ts src/routes/Game.svelte tests/core/menu.test.ts
git commit -m "fix: default menu names localize to German"
```

---

### Task 3: euros-first entry — parseEntry + Numpad rework + Finish button

**Files:**
- Modify: `src/core/money.ts`, `src/lib/Numpad.svelte`, `src/routes/Game.svelte` (Finish label + till dim), `src/lib/TillGrid.svelte` (disabled prop), `src/i18n/en.ts`, `src/i18n/de.ts`
- Test: `tests/core/money.test.ts` (extend)

**Interfaces:**
- Produces:

```ts
// money.ts
export function parseEntry(input: string): Cents;
// '' → 0; '5' → 500; '4,5' → 450; '4,50' → 450; '0,05' → 5; '12' → 1200

// Numpad.svelte props
export interface NumpadApi { press: (k: string) => void } // k: '0'-'9', ',', 'Backspace', 'Enter'
{ onsubmit: (cents: number) => void; symbolFirst?: boolean; bindApi?: (api: NumpadApi) => void }

// TillGrid.svelte props gain: disabled?: boolean (dims + blocks takes)
```

- [ ] **Step 1: Write failing tests**

Append to `tests/core/money.test.ts`:

```ts
import { parseEntry } from '$core/money';

describe('parseEntry (euros-first)', () => {
  it('bare number is euros', () => {
    expect(parseEntry('5')).toBe(500);
    expect(parseEntry('12')).toBe(1200);
  });
  it('comma starts cents, padded to two digits', () => {
    expect(parseEntry('4,5')).toBe(450);
    expect(parseEntry('4,50')).toBe(450);
    expect(parseEntry('0,05')).toBe(5);
    expect(parseEntry('7,')).toBe(700);
  });
  it('empty is zero', () => {
    expect(parseEntry('')).toBe(0);
  });
});
```

Run: `npx vitest run tests/core/money.test.ts` — FAIL: not exported.

- [ ] **Step 2: Implement parseEntry**

Append to `src/core/money.ts`:

```ts
/** Euros-first entry string → cents. '5' → 500, '4,5' → 450, '' → 0. */
export function parseEntry(input: string): Cents {
  if (input === '') return 0;
  const [euros, cents = ''] = input.split(',');
  const c = `${cents}00`.slice(0, 2);
  return Number(euros || '0') * 100 + Number(c);
}
```

Run: `npx vitest run tests/core/money.test.ts` — all pass.

- [ ] **Step 3: Rework Numpad**

Replace `src/lib/Numpad.svelte`:

```svelte
<!-- src/lib/Numpad.svelte -->
<script lang="ts" module>
  export interface NumpadApi { press: (k: string) => void }
</script>

<script lang="ts">
  import { formatEuro, parseEntry } from '../core/money';

  let { onsubmit, symbolFirst = false, bindApi }: {
    onsubmit: (cents: number) => void;
    symbolFirst?: boolean;
    bindApi?: (api: NumpadApi) => void;
  } = $props();

  let digits = $state('');
  const display = $derived(formatEuro(parseEntry(digits), symbolFirst));

  function tap(d: string) {
    if (d === ',') {
      if (digits.includes(',')) return;
      digits = digits === '' ? '0,' : digits + ',';
      return;
    }
    const [euros, cents] = digits.split(',');
    if (cents !== undefined) {
      if (cents.length >= 2) return;
    } else if (euros.length >= 4) return;
    digits += d;
  }
  function backspace() {
    digits = digits.slice(0, -1);
  }
  function submit() {
    if (digits === '') return;
    onsubmit(parseEntry(digits));
    digits = '';
  }

  bindApi?.({
    press: (k) => {
      if (k === 'Backspace') backspace();
      else if (k === 'Enter') submit();
      else tap(k);
    },
  });
</script>

<div class="numpad">
  <output>{display}</output>
  <div class="keys">
    {#each ['1','2','3','4','5','6','7','8','9'] as k}
      <button type="button" onclick={() => tap(k)}>{k}</button>
    {/each}
    <button type="button" class="comma" onclick={() => tap(',')}>,</button>
    <button type="button" onclick={() => tap('0')}>0</button>
    <button type="button" class="ok" disabled={digits === ''} onclick={submit}>OK</button>
  </div>
  <button type="button" class="fn" onclick={() => (digits = '')}>C</button>
</div>

<style>
  .numpad { display: flex; flex-direction: column; gap: 0.5rem; }
  output {
    font-size: 2rem; text-align: right; padding: 0.25rem 0.75rem;
    background: var(--cream); color: var(--ink); border-radius: var(--radius);
    font-variant-numeric: tabular-nums;
  }
  .keys { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
  .keys button {
    font-size: 1.5rem; padding: 0.75rem 0;
    background: var(--wood-light); color: var(--cream);
  }
  .comma { background: var(--accent) !important; color: var(--ink) !important; }
  .ok { background: var(--ok) !important; }
  .ok:disabled { opacity: 0.4; }
  .fn { background: var(--danger); color: var(--cream); }
</style>
```

(`bindApi` is called once during component init — the functions it closes over are stable.)

- [ ] **Step 4: Finish button + till dim**

`src/lib/TillGrid.svelte` — add a `disabled` prop and honor it:

```svelte
<script lang="ts">
  import { DENOMS, type Denom, type Till } from '../core/till';
  import Money from './Money.svelte';

  let { till, ontake, disabled = false }: {
    till: Till; ontake: (d: Denom) => void; disabled?: boolean;
  } = $props();
</script>

<div class="till" class:dimmed={disabled}>
  {#each DENOMS as d (d)}
    <Money denom={d} count={till[d] ?? 0}
      disabled={disabled || (till[d] ?? 0) === 0} onclick={() => ontake(d)} />
  {/each}
</div>

<style>
  .till {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 0.6rem; justify-items: center;
    padding: 0.6rem; background: rgb(0 0 0 / 0.25); border-radius: var(--radius);
  }
  .dimmed { opacity: 0.45; }
</style>
```

In `src/routes/Game.svelte` change the change-phase markup:

```svelte
      <TillGrid till={tillView} ontake={take} disabled={round.changeDue === 0} />
      <ChangePile {pile} showTotal={session.params.showPileTotal} onreturn={ret} />
      <div class="actions">
        <button class="confirm" onclick={confirmChange}>
          {round.changeDue === 0 ? $t('game.finish') : $t('game.confirm')}
        </button>
```

i18n: add `'game.finish': 'Finish',` (en) and `'game.finish': 'Fertig',` (de).

- [ ] **Step 5: Verify + commit**

Run: `npx vitest run` green; `npm run check` 0/0; `npm run build` ok.

```bash
git add src/core/money.ts src/lib/Numpad.svelte src/lib/TillGrid.svelte src/routes/Game.svelte src/i18n tests/core/money.test.ts
git commit -m "feat: euros-first entry with comma key and explicit Finish for zero change"
```

---

### Task 4: difficulty rebalance

**Files:**
- Modify: `src/core/difficulty.ts`, `tests/core/difficulty.test.ts`, `tests/core/session.test.ts` (price-style assertion)

**Interfaces:**
- Produces: same exports; new anchor table at levels 1/8/18/30 per the spec, entry gates underpay 8 / tab 10 / dispute 12 / split 15, `practiceParams` base `paramsForLevel(14)`.

- [ ] **Step 1: Rewrite the difficulty tests that assert old anchors**

In `tests/core/difficulty.test.ts`:

Replace the `'level 1 matches spec anchors'` test body with:

```ts
    const p = paramsForLevel(1);
    expect(p.itemsMin).toBe(1);
    expect(p.itemsMax).toBe(2);
    expect(p.priceStyle).toBe('half');
    expect(p.paymentStyle).toBe('exact-or-round');
    expect(p.patienceSeconds).toBe(35);
    expect(p.menuVisibleSeconds).toBeNull();
    expect(p.scarceDenoms).toBe(0);
    expect(p.midOrderChangeProb).toBe(0);
    expect(p.showPileTotal).toBe(true);
    expect(p.ordersPerLevel).toBe(6);
```

The level-30 test stays as-is (L30 anchor values unchanged). Replace the entry-gate boundaries in `'is exactly zero strictly below each entry level'`:

```ts
    expect(paramsForLevel(7).underpayProb).toBe(0);
    expect(paramsForLevel(8).underpayProb).toBeGreaterThan(0);
    expect(paramsForLevel(11).disputeProb).toBe(0);
    expect(paramsForLevel(12).disputeProb).toBeGreaterThan(0);
    expect(paramsForLevel(9).tabProb).toBe(0);
    expect(paramsForLevel(10).tabProb).toBeGreaterThan(0);
    expect(paramsForLevel(14).splitProb).toBe(0);
    expect(paramsForLevel(15).splitProb).toBeGreaterThan(0);
```

Add one steepness test:

```ts
  it('mid-game arrives earlier than before', () => {
    expect(paramsForLevel(8).patienceSeconds).toBe(28);
    expect(paramsForLevel(8).ordersPerLevel).toBe(8);
  });
```

In `tests/core/session.test.ts`, the `createSession` test asserting `m.priceCents % 100 === 0` (round style at L1) becomes `% 50 === 0` (half style).

Run: `npx vitest run tests/core/difficulty.test.ts tests/core/session.test.ts` — new/changed tests FAIL against the old table.

- [ ] **Step 2: Implement the new anchors and gates**

In `src/core/difficulty.ts` replace the ANCHORS array with:

```ts
const ANCHORS: Anchor[] = [
  { level: 1,  itemsMin: 1, itemsMax: 2, priceStyle: 'half', paymentStyle: 'exact-or-round',
    patienceSeconds: 35, menuVisibleSeconds: null, scarceDenoms: 0, midOrderChangeProb: 0,
    showPileTotal: true,  ordersPerLevel: 6,
    underpayProb: 0, disputeProb: 0, tabProb: 0, splitProb: 0 },
  { level: 8,  itemsMin: 2, itemsMax: 3, priceStyle: 'tens', paymentStyle: 'round',
    patienceSeconds: 28, menuVisibleSeconds: 5,    scarceDenoms: 1, midOrderChangeProb: 0.1,
    showPileTotal: true,  ordersPerLevel: 8,
    underpayProb: 0.08, disputeProb: 0, tabProb: 0, splitProb: 0 },
  { level: 18, itemsMin: 3, itemsMax: 5, priceStyle: 'any',  paymentStyle: 'awkward',
    patienceSeconds: 20, menuVisibleSeconds: 3,    scarceDenoms: 2, midOrderChangeProb: 0.25,
    showPileTotal: false, ordersPerLevel: 10,
    underpayProb: 0.15, disputeProb: 0.12, tabProb: 0.18, splitProb: 0.12 },
  { level: 30, itemsMin: 4, itemsMax: 6, priceStyle: 'any',  paymentStyle: 'awkward',
    patienceSeconds: 15, menuVisibleSeconds: 0,    scarceDenoms: 3, midOrderChangeProb: 0.35,
    showPileTotal: false, ordersPerLevel: 12,
    underpayProb: 0.2, disputeProb: 0.2, tabProb: 0.25, splitProb: 0.2 },
];
```

Update the gate entry levels in `paramsForLevel`:

```ts
  result.underpayProb = gated(lerp(lo.underpayProb, hi.underpayProb, t), 8);
  result.disputeProb = gated(lerp(lo.disputeProb, hi.disputeProb, t), 12);
  result.tabProb = gated(lerp(lo.tabProb, hi.tabProb, t), 10);
  result.splitProb = gated(lerp(lo.splitProb, hi.splitProb, t), 15);
```

In `practiceParams`, change the base from `paramsForLevel(15)` to `paramsForLevel(14)` (overrides unchanged).

- [ ] **Step 3: Run the whole suite and repair any anchored expectations**

Run: `npx vitest run`
Expected: difficulty + session tests pass. If `tests/core/order.test.ts`'s bounds test (`paramsForLevel(10)` qty within 2..3) fails, widen its expectation to the new interpolated bounds printed by `paramsForLevel(10)` (itemsMin 2, itemsMax 3 still hold with the new table — verify, don't assume). Everything must be green before committing.

- [ ] **Step 4: Commit**

```bash
git add src/core/difficulty.ts tests/core/difficulty.test.ts tests/core/session.test.ts tests/core/order.test.ts
git commit -m "feat: steeper difficulty curve with earlier mechanics"
```

---

### Task 5: hints core — hintFor, usedHint flag, scoring integration

**Files:**
- Create: `src/core/hints.ts`
- Modify: `src/core/round.ts`, `src/core/session.ts` (scoreAndLog firstTry)
- Test: `tests/core/hints.test.ts`, `tests/core/round.test.ts` + `tests/core/session.test.ts` (extend)

**Interfaces:**
- Produces:

```ts
// round.ts additions
export interface RoundState { /* existing plus */ usedHint: boolean; }
export function markHint(s: RoundState): RoundState; // sets usedHint (idempotent), any live phase

// hints.ts
export function hintFor(round: RoundState, index: number, locale: 'en' | 'de'): string;
// sum phase: line at min(index, lines-1) → "2× Bier = 8,00 €"
// change phase, underpaid: nudge to re-count the payment
// change phase, shortage (no ask yet): nudge to ask
// change phase otherwise: "Change: 1,50 €" / "Wechselgeld: 1,50 €"
```

- `scoreAndLog`'s firstTry becomes `round.sumTries === 0 && round.changeTries === 0 && !round.usedHint`.

- [ ] **Step 1: Write failing tests**

```ts
// tests/core/hints.test.ts
import { describe, it, expect } from 'vitest';
import { hintFor } from '$core/hints';
import { createRound, submitSum, markHint } from '$core/round';
import { fullTill } from '$core/till';

const beer = { id: 'beer', name: 'Bier', priceCents: 400 };
const water = { id: 'water', name: 'Wasser', priceCents: 250 };
const order = { lines: [{ item: beer, qty: 2 }, { item: water, qty: 1 }], totalCents: 1050 };

describe('hintFor', () => {
  it('sum phase reveals line subtotals by index, clamped', () => {
    const r = createRound(order, [2000], fullTill());
    expect(hintFor(r, 0, 'de')).toBe('2× Bier = 8,00 €');
    expect(hintFor(r, 1, 'de')).toBe('1× Wasser = 2,50 €');
    expect(hintFor(r, 5, 'de')).toBe('1× Wasser = 2,50 €');
  });
  it('change phase reveals the change amount', () => {
    let r = createRound(order, [2000], fullTill());
    r = submitSum(r, 1050);
    expect(hintFor(r, 0, 'en')).toBe('Change: 9,50 €');
    expect(hintFor(r, 0, 'de')).toBe('Wechselgeld: 9,50 €');
  });
  it('underpaid payment nudges a re-count', () => {
    let r = createRound(order, [500, 200], fullTill()); // 7,00 for 10,50
    r = submitSum(r, 1050);
    expect(hintFor(r, 0, 'en')).toBe('Count the payment again…');
    expect(hintFor(r, 0, 'de')).toBe('Zähl das Geld nochmal nach…');
  });
  it('shortage nudges the ask', () => {
    const till = { 200: 5 }; // only 2€ coins
    let r = createRound({ lines: [{ item: beer, qty: 2 }], totalCents: 800 }, [500, 200, 200, 50], till);
    r = submitSum(r, 800); // change 1,50 — 200-only till can't make it
    expect(hintFor(r, 0, 'en')).toBe('The till can’t make this — ask for a coin.');
  });
});
```

Append to `tests/core/round.test.ts`:

```ts
import { markHint } from '$core/round';

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
```

Append to `tests/core/session.test.ts`:

```ts
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
```

Run: `npx vitest run tests/core/hints.test.ts tests/core/round.test.ts tests/core/session.test.ts` — FAIL (module/field missing).

- [ ] **Step 2: Implement round flag**

In `src/core/round.ts`: add `usedHint: boolean;` to `RoundState`, initialize `usedHint: false,` in `createRound`, and append:

```ts
export function markHint(s: RoundState): RoundState {
  if (s.phase === 'done' || s.usedHint) return s;
  return { ...s, usedHint: true };
}
```

- [ ] **Step 3: Implement hints.ts**

```ts
// src/core/hints.ts
import type { RoundState } from './round';
import { formatEuro } from './money';
import { canMakeChange } from './change';

/** Contextual hint text. Reveals structure, never the full solution. */
export function hintFor(round: RoundState, index: number, locale: 'en' | 'de'): string {
  if (round.phase === 'sum') {
    const lines = round.order.lines;
    const l = lines[Math.min(index, lines.length - 1)];
    return `${l.qty}× ${l.item.name} = ${formatEuro(l.item.priceCents * l.qty)}`;
  }
  if (round.paymentCents < round.order.totalCents) {
    return locale === 'en' ? 'Count the payment again…' : 'Zähl das Geld nochmal nach…';
  }
  if (!round.usedAsk && !canMakeChange(round.till, round.changeDue)) {
    return locale === 'en'
      ? 'The till can’t make this — ask for a coin.'
      : 'Die Kasse kann das nicht — frag nach einer Münze.';
  }
  return locale === 'en'
    ? `Change: ${formatEuro(round.changeDue)}`
    : `Wechselgeld: ${formatEuro(round.changeDue)}`;
}
```

- [ ] **Step 4: Scoring integration**

In `src/core/session.ts`, `scoreAndLog`, change the firstTry line to:

```ts
  const firstTry = round.sumTries === 0 && round.changeTries === 0 && !round.usedHint;
```

- [ ] **Step 5: Run tests, full suite, commit**

Run: `npx vitest run` — all green.

```bash
git add src/core/hints.ts src/core/round.ts src/core/session.ts tests/core/hints.test.ts tests/core/round.test.ts tests/core/session.test.ts
git commit -m "feat: contextual hints with first-try forfeit"
```

---

### Task 6: physical keyboard play + till key badges

**Files:**
- Modify: `src/routes/Game.svelte`, `src/lib/TillGrid.svelte`, `src/lib/Money.svelte`

**Interfaces:**
- Consumes: `NumpadApi`/`bindApi` from Task 3.
- Produces: Game-level `onkeydown` handling per the Global Constraints key map; `TillGrid` prop `showKeys?: boolean`; `Money` prop `keyBadge?: string | null` (small corner badge).

- [ ] **Step 1: Money key badge**

In `src/lib/Money.svelte`: add prop `keyBadge = null` (`keyBadge?: string | null`) and render after the count badge:

```svelte
  {#if keyBadge}<kbd class="keybadge">{keyBadge}</kbd>{/if}
```

with style:

```css
  .keybadge {
    position: absolute; bottom: -6px; left: -6px;
    background: var(--cream); color: var(--ink);
    border-radius: 4px; font-size: 0.65rem; padding: 0 4px;
    font-family: inherit;
  }
```

- [ ] **Step 2: TillGrid showKeys**

In `src/lib/TillGrid.svelte`, add `showKeys = false` (`showKeys?: boolean`) to the props and pass the badge — DENOMS order maps to keys 1..9,0:

```svelte
  {#each DENOMS as d, i (d)}
    <Money denom={d} count={till[d] ?? 0}
      disabled={disabled || (till[d] ?? 0) === 0}
      keyBadge={showKeys ? String((i + 1) % 10) : null}
      onclick={() => ontake(d)} />
  {/each}
```

- [ ] **Step 3: Game key handler**

In `src/routes/Game.svelte`:

Add state + api capture:

```ts
  import type { NumpadApi } from '../lib/Numpad.svelte';
  import { DENOMS } from '../core/till';   // extend the existing till import

  let numpadApi: NumpadApi | null = null;
  let hasKeyboard = $state(false); // becomes true on first physical keydown → shows badges
```

Add the handler (script section, near the bottom):

```ts
  function onKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
    if (session.finished || dispute) return;
    hasKeyboard = true;
    const k = e.key;
    if (!round) return;
    if (round.phase === 'sum' && !numpadLocked) {
      if (/^[0-9]$/.test(k)) { numpadApi?.press(k); e.preventDefault(); }
      else if (k === ',' || k === '.') { numpadApi?.press(','); e.preventDefault(); }
      else if (k === 'Backspace') { numpadApi?.press('Backspace'); e.preventDefault(); }
      else if (k === 'Enter') { numpadApi?.press('Enter'); e.preventDefault(); }
    } else if (round.phase === 'change') {
      if (/^[0-9]$/.test(k)) {
        const idx = k === '0' ? 9 : Number(k) - 1;
        take(DENOMS[idx]);
        e.preventDefault();
      } else if (k === 'Enter') { confirmChange(); e.preventDefault(); }
      else if (k === 'a' || k === 'A') { askOpen = !askOpen; e.preventDefault(); }
      else if (k === 'n' || k === 'N') { onNotEnough(); e.preventDefault(); }
    }
  }
```

Wire it with `<svelte:window onkeydown={onKey} />` placed directly above `<main class="game">`. (`T` for Tipp and Space/Esc are added in Tasks 9 and 7 respectively — this handler is where they will slot in.)

Change the Numpad usage to capture the api, and the TillGrid to show badges when a keyboard was used:

```svelte
        <Numpad onsubmit={onSum} {symbolFirst} bindApi={(api) => (numpadApi = api)} />
```

```svelte
      <TillGrid till={tillView} ontake={take} disabled={round.changeDue === 0} showKeys={hasKeyboard} />
```

- [ ] **Step 4: Verify + commit**

Run: `npm run check` 0/0; `npm run build` ok; `npx vitest run` green.

```bash
git add src/routes/Game.svelte src/lib/TillGrid.svelte src/lib/Money.svelte
git commit -m "feat: full physical-keyboard play with till key badges"
```

---

### Task 7: pause system — PausableTimer, PauseOverlay, Space/Esc

**Files:**
- Create: `src/lib/pausable.ts`, `src/lib/PauseOverlay.svelte`
- Modify: `src/routes/Game.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`
- Test: `tests/lib/pausable.test.ts`

**Interfaces:**
- Produces:

```ts
// pausable.ts
export class PausableTimer {
  start(fn: () => void, ms: number): void; // replaces any pending run
  pause(): void;                            // captures remaining time
  resume(): void;                           // re-arms with the remainder
  clear(): void;                            // cancels; fn forgotten
  get pending(): boolean;
}

// PauseOverlay.svelte props
{ menu: boolean; soundOn: boolean; onresume: () => void; onrestart: () => void;
  ontogglesound: () => void; allowRestart?: boolean }
// menu=false → plain "Paused" + tap/Space to resume; menu=true → buttons.
```

- [ ] **Step 1: Write failing PausableTimer tests (fake timers)**

```ts
// tests/lib/pausable.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PausableTimer } from '../../src/lib/pausable';

describe('PausableTimer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires after the delay', () => {
    const t = new PausableTimer();
    const fn = vi.fn();
    t.start(fn, 1000);
    vi.advanceTimersByTime(999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
    expect(t.pending).toBe(false);
  });
  it('pause preserves the remainder, resume completes it', () => {
    const t = new PausableTimer();
    const fn = vi.fn();
    t.start(fn, 1000);
    vi.advanceTimersByTime(600);
    t.pause();
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
    t.resume();
    vi.advanceTimersByTime(399);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
  });
  it('clear cancels and forgets', () => {
    const t = new PausableTimer();
    const fn = vi.fn();
    t.start(fn, 1000);
    t.clear();
    t.resume();
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
    expect(t.pending).toBe(false);
  });
  it('start replaces a pending run', () => {
    const t = new PausableTimer();
    const a = vi.fn();
    const b = vi.fn();
    t.start(a, 1000);
    t.start(b, 1000);
    vi.advanceTimersByTime(1000);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
  });
});
```

Run: `npx vitest run tests/lib/pausable.test.ts` — FAIL (module missing).

- [ ] **Step 2: Implement PausableTimer**

```ts
// src/lib/pausable.ts
/** setTimeout wrapper whose remaining time survives pause/resume. */
export class PausableTimer {
  private id: ReturnType<typeof setTimeout> | undefined;
  private remaining = 0;
  private startedAt = 0;
  private fn: (() => void) | null = null;

  start(fn: () => void, ms: number): void {
    this.clear();
    this.fn = fn;
    this.remaining = ms;
    this.arm();
  }

  private arm(): void {
    this.startedAt = Date.now();
    this.id = setTimeout(() => {
      this.id = undefined;
      const f = this.fn;
      this.fn = null;
      f?.();
    }, this.remaining);
  }

  pause(): void {
    if (this.id === undefined) return;
    clearTimeout(this.id);
    this.id = undefined;
    this.remaining -= Date.now() - this.startedAt;
  }

  resume(): void {
    if (this.id !== undefined || this.fn === null) return;
    this.remaining = Math.max(this.remaining, 0);
    this.arm();
  }

  clear(): void {
    if (this.id !== undefined) clearTimeout(this.id);
    this.id = undefined;
    this.fn = null;
  }

  get pending(): boolean {
    return this.id !== undefined || this.fn !== null;
  }
}
```

Run: `npx vitest run tests/lib/pausable.test.ts` — 4 passed.

- [ ] **Step 3: PauseOverlay component**

```svelte
<!-- src/lib/PauseOverlay.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { go } from './router';

  let { menu, soundOn, onresume, onrestart, ontogglesound, allowRestart = true }: {
    menu: boolean;
    soundOn: boolean;
    onresume: () => void;
    onrestart: () => void;
    ontogglesound: () => void;
    allowRestart?: boolean;
  } = $props();
</script>

<div class="pause" role="dialog" aria-label={$t('pause.title')}>
  <h2>{$t('pause.title')}</h2>
  {#if menu}
    <div class="menu-actions">
      <button onclick={onresume}>{$t('menu.resume')}</button>
      {#if allowRestart}
        <button onclick={onrestart}>{$t('menu.restart')}</button>
      {/if}
      <button onclick={ontogglesound}>{$t('menu.sound')}: {soundOn ? '🔊' : '🔇'}</button>
      <button onclick={() => go('home')}>{$t('result.home')}</button>
    </div>
  {:else}
    <button class="tapzone" onclick={onresume}>{$t('pause.tap')}</button>
  {/if}
</div>

<style>
  .pause {
    position: fixed; inset: 0; background: rgb(0 0 0 / 0.85);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 1rem; text-align: center;
  }
  .menu-actions { display: flex; flex-direction: column; gap: 0.5rem; width: 240px; }
  .menu-actions button { background: var(--accent); color: var(--ink); font-size: 1.1rem; }
  .tapzone {
    position: absolute; inset: 0; width: 100%;
    background: none; color: var(--cream); opacity: 0.7;
    display: flex; align-items: flex-end; justify-content: center;
    padding-bottom: 20dvh; font-size: 1rem;
  }
</style>
```

- [ ] **Step 4: Wire pause into Game**

In `src/routes/Game.svelte`:

1. Replace the four raw timer variables with PausableTimer instances:

```ts
  import { PausableTimer } from '../lib/pausable';
  import PauseOverlay from '../lib/PauseOverlay.svelte';

  const amendT = new PausableTimer();
  const menuT = new PausableTimer();
  const flashT = new PausableTimer();
  const waveT = new PausableTimer();
  let paused = $state(false);
  let pauseMenu = $state(false);
```

2. Mechanical substitution across the file: `clearTimeout(amendTimer)` → `amendT.clear()`, `amendTimer = setTimeout(fn, ms)` → `amendT.start(fn, ms)` — same for menuT/flashT/waveT. Delete the old `let ...Timer` declarations. The unmount cleanup calls `.clear()` on all four.

3. Pause plumbing:

```ts
  function setPaused(on: boolean, menu = false) {
    if (session.finished) return;
    paused = on;
    pauseMenu = on && menu;
    const timers = [amendT, menuT, flashT, waveT];
    for (const t of timers) on ? t.pause() : t.resume();
  }
```

4. In the interval callback, immediately after the `if (dispute) return;` line add `if (paused) return;`.

5. Extend `onKey` — at the TOP of the function (before the `session.finished || dispute` guard) add:

```ts
    if (k === 'Escape') {
      if (paused) setPaused(false);
      else setPaused(true, true);
      e.preventDefault();
      return;
    }
    if (k === ' ') {
      setPaused(!paused);
      e.preventDefault();
      return;
    }
```

(`const k = e.key;` moves above these lines; the input-focus guard stays first. Space while the menu is open resumes.)

6. Markup — hide the order text while paused and render the overlay. Change `{#if round}` block's order line to:

```svelte
    <p class="order">“{paused ? '…' : orderText}”</p>
```

and add before the dispute block:

```svelte
  {#if paused}
    <PauseOverlay
      menu={pauseMenu}
      soundOn={$settings.sound}
      onresume={() => setPaused(false)}
      onrestart={() => { setPaused(false); restart(); }}
      ontogglesound={() => settings.update((s) => ({ ...s, sound: !s.sound }))}
      allowRestart={!dispute}
    />
  {/if}
```

(While a dispute is open, `onKey` returns before Space, but Esc runs first — Esc during a dispute opens the menu with `allowRestart={false}`, and the dispute dialog markup gains `{#if dispute && !paused}` so it hides under the menu. Update that `{#if}` accordingly.)

7. `restart()` additionally sets `paused = false; pauseMenu = false;`.

i18n additions — en: `'pause.title': 'Paused'`, `'pause.tap': 'Tap or press Space to continue'`, `'menu.resume': 'Resume'`, `'menu.restart': 'Restart'`, `'menu.sound': 'Sound'`; de: `'pause.title': 'Pause'`, `'pause.tap': 'Tippen oder Leertaste zum Weiterspielen'`, `'menu.resume': 'Weiter'`, `'menu.restart': 'Neu starten'`, `'menu.sound': 'Ton'`.

- [ ] **Step 5: Verify + commit**

Run: `npx vitest run` green; `npm run check` 0/0; `npm run build` ok.

```bash
git add src/lib/pausable.ts src/lib/PauseOverlay.svelte src/routes/Game.svelte src/i18n tests/lib/pausable.test.ts
git commit -m "feat: pause with frozen timers, Esc game menu, Space toggle"
```

---

### Task 8: keyboard navigation — keynav action, focus outlines, Esc-home

**Files:**
- Create: `src/lib/keynav.ts`
- Modify: `src/app.css`, `src/routes/Home.svelte`, `src/routes/Levels.svelte`, `src/routes/Practice.svelte`, `src/App.svelte`

**Interfaces:**
- Produces: Svelte action `keynav(node)` — roving tabindex over the node's direct `<button>` descendants: Arrow keys move focus (grid-aware via `--keynav-cols` custom property or linear fallback), Home/End jump. Global `:focus-visible` style. Esc on non-game routes navigates Home.

- [ ] **Step 1: Implement keynav action**

```ts
// src/lib/keynav.ts
/** Roving-tabindex arrow navigation over a container's buttons. */
export function keynav(node: HTMLElement) {
  function buttons(): HTMLButtonElement[] {
    return [...node.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  }
  function cols(): number {
    const v = getComputedStyle(node).getPropertyValue('--keynav-cols').trim();
    return v ? Number(v) : 1;
  }
  function onKeydown(e: KeyboardEvent) {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const list = buttons();
    const current = list.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;
    const c = cols();
    let next = current;
    if (e.key === 'ArrowRight') next = current + 1;
    else if (e.key === 'ArrowLeft') next = current - 1;
    else if (e.key === 'ArrowDown') next = current + c;
    else if (e.key === 'ArrowUp') next = current - c;
    else if (e.key === 'Home') next = 0;
    else next = list.length - 1;
    if (next < 0 || next >= list.length) return;
    e.preventDefault();
    list[next].focus();
  }
  node.addEventListener('keydown', onKeydown);
  return { destroy: () => node.removeEventListener('keydown', onKeydown) };
}
```

- [ ] **Step 2: Apply it**

- `src/routes/Home.svelte`: `<main class="home" use:keynav>` (+ import). Vertical list → no `--keynav-cols` needed (defaults to 1).
- `src/routes/Levels.svelte`: `<div class="grid" use:keynav style="--keynav-cols: 5">` (+ import).
- `src/routes/Practice.svelte`: `<div class="grid" use:keynav style="--keynav-cols: 2">` (+ import).

- [ ] **Step 3: Global focus style + Esc-home**

Append to `src/app.css`:

```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

In `src/App.svelte`, add a window key handler for non-game routes:

```ts
  const onGameRoute = $derived(
    gameLevel !== null || $route === 'rush' || $route === 'daily' || practiceSkill !== null,
  );

  function onEsc(e: KeyboardEvent) {
    if (e.key !== 'Escape' || onGameRoute) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
    if ($route !== 'home') go('home');
  }
```

with `import { route, go } from './lib/router';` (extend the existing import) and `<svelte:window onkeydown={onEsc} />` above the `{#key}` block.

- [ ] **Step 4: Verify + commit**

Run: `npm run check` 0/0; `npm run build` ok; `npx vitest run` green.

```bash
git add src/lib/keynav.ts src/app.css src/routes/Home.svelte src/routes/Levels.svelte src/routes/Practice.svelte src/App.svelte
git commit -m "feat: arrow-key navigation, focus outlines, Esc to home"
```

---

### Task 9: Tipp UI + praise messages

**Files:**
- Create: `src/lib/praise.ts`
- Modify: `src/routes/Game.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`

**Interfaces:**
- Consumes: `hintFor`/`markHint` (Task 5), key handler (Task 6), pause state (Task 7).
- Produces: `praiseKey(streak: number): string` → `praise.<tier>.<n>` with tier 1 (streak 0-2), 2 (3-5), 3 (6+), n ∈ 1..3 via `Math.random`.

- [ ] **Step 1: praise helper**

```ts
// src/lib/praise.ts
/** Streak-scaled praise key. Uses Math.random — NEVER session.rng
 *  (outcome-dependent consumption would desync daily seeds). */
export function praiseKey(streak: number): string {
  const tier = streak >= 6 ? 3 : streak >= 3 ? 2 : 1;
  const n = 1 + Math.floor(Math.random() * 3);
  return `praise.${tier}.${n}`;
}
```

- [ ] **Step 2: Tipp wiring in Game**

Add imports: `import { hintFor } from '../core/hints';`, `markHint` joins the round import, `import { praiseKey } from '../lib/praise';`.

New state:

```ts
  let hintText = $state<string | null>(null);
  let hintIndex = $state(0);
  let scoreAtRoundStart = 0;
```

In `startRound()` (with the other per-round resets) and in `nextPayer()` (after the new round is created):

```ts
    hintText = null;
    hintIndex = 0;
    scoreAtRoundStart = session.score;
```

Handler:

```ts
  function onTipp() {
    if (!round || dispute || paused || round.phase === 'done') return;
    round = markHint(round);
    hintText = hintFor(round, hintIndex, $settings.locale);
    hintIndex += 1;
    session = { ...session, score: Math.max(session.score - 25, scoreAtRoundStart) };
  }
```

Key handler: inside `onKey`, in BOTH phase branches add:

```ts
      else if (k === 't' || k === 'T') { onTipp(); e.preventDefault(); }
```

Markup — Tipp button in the sum phase (below the Numpad) and in the change-phase actions row; hint text under the prompt:

```svelte
    {#if hintText}<p class="hint-line">💡 {hintText}</p>{/if}
```

(placed right after the `{#if amendText}` line, so it shows in both phases), plus:

```svelte
        <Numpad onsubmit={onSum} {symbolFirst} bindApi={(api) => (numpadApi = api)} />
        <button class="tipp" onclick={onTipp}>{$t('game.tipp')} (−25)</button>
```

and in the change actions row after Not-enough:

```svelte
        <button class="tipp" onclick={onTipp}>{$t('game.tipp')}</button>
```

Style: `.tipp { background: var(--wood-light); color: var(--cream); } .hint-line { color: var(--accent); animation: op-slide-up 0.2s ease-out; }`

Also clear `hintText = null;` in `finishRound()` (with the other resets).

- [ ] **Step 3: Praise on success — flash moves after completeRound**

In `finishRound()`, restructure: delete the current `flash = ...` assignment block from BEFORE `session = completeRound(...)` and insert AFTER it:

```ts
    flash = disputeVerdict !== null
      ? disputeVerdict
      : failed
        ? done.errors.includes('change-wrong')
          ? `${$t('game.change-was')} ${formatEuro(done.changeDue, symbolFirst)}`
          : `${$t('game.wrong')} ${formatEuro(done.order.totalCents, symbolFirst)}`
        : $t(praiseKey(session.streak));
    disputeVerdict = null;
```

(`session.streak` is now the post-round streak, so the praise tier reflects the streak the player just reached. The sound/pulse calls stay where they are — they only need `failed`.)

- [ ] **Step 4: i18n praise + tipp keys**

en:

```ts
  'game.tipp': 'Tipp',
  'praise.1.1': 'Nice!',
  'praise.1.2': 'Correct!',
  'praise.1.3': 'Well done!',
  'praise.2.1': 'Great pace!',
  'praise.2.2': 'Keep it rolling!',
  'praise.2.3': 'Sharp counting!',
  'praise.3.1': 'On fire! 🔥',
  'praise.3.2': 'Bar legend!',
  'praise.3.3': 'Unstoppable! 🔥',
```

de:

```ts
  'game.tipp': 'Tipp',
  'praise.1.1': 'Passt!',
  'praise.1.2': 'Richtig!',
  'praise.1.3': 'Gut gemacht!',
  'praise.2.1': 'Läuft bei dir!',
  'praise.2.2': 'Weiter so!',
  'praise.2.3': 'Sauber gerechnet!',
  'praise.3.1': 'Du brennst! 🔥',
  'praise.3.2': 'Tresen-Legende!',
  'praise.3.3': 'Nicht zu stoppen! 🔥',
```

- [ ] **Step 5: Verify + commit**

Run: `npx vitest run` green; `npm run check` 0/0; `npm run build` ok.

```bash
git add src/lib/praise.ts src/routes/Game.svelte src/i18n
git commit -m "feat: paid Tipp hints and streak-scaled praise"
```

---

### Task 10: logo + icons

**Files:**
- Modify: `public/icon.svg`; regenerate `public/pwa-192.png`, `public/pwa-512.png`, `public/pwa-maskable-512.png`
- Create: none beyond the regenerated assets

- [ ] **Step 1: Replace public/icon.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#2b1d12"/>
  <!-- beer glass -->
  <path d="M148 168 h150 l-16 226 a26 26 0 0 1 -26 24 h-66 a26 26 0 0 1 -26 -24 z" fill="#d99a2b"/>
  <path d="M152 224 h142 l-4 44 h-134 z" fill="#f0c96a" opacity="0.6"/>
  <!-- foam -->
  <circle cx="170" cy="158" r="28" fill="#f5ecd7"/>
  <circle cx="220" cy="144" r="34" fill="#f5ecd7"/>
  <circle cx="272" cy="156" r="28" fill="#f5ecd7"/>
  <rect x="146" y="152" width="154" height="24" rx="12" fill="#f5ecd7"/>
  <!-- coin stack -->
  <ellipse cx="372" cy="392" rx="60" ry="20" fill="#a5673f"/>
  <ellipse cx="372" cy="372" rx="60" ry="20" fill="#c9962e"/>
  <ellipse cx="372" cy="352" rx="60" ry="20" fill="#d99a2b"/>
  <ellipse cx="372" cy="344" rx="60" ry="20" fill="#f0c96a"/>
  <text x="372" y="354" font-size="28" text-anchor="middle" fill="#2b1d12"
    font-family="Georgia, serif" font-weight="bold">€</text>
</svg>
```

- [ ] **Step 2: Regenerate PNG icons**

```bash
rsvg-convert -w 192 -h 192 public/icon.svg -o public/pwa-192.png
rsvg-convert -w 512 -h 512 public/icon.svg -o public/pwa-512.png
rsvg-convert -w 512 -h 512 public/icon.svg -o public/pwa-maskable-512.png
file public/pwa-192.png public/pwa-512.png
```

(rsvg-convert is known to be installed; if it fails, use `magick`/`convert` as in round 2.) Manifest already references these paths — no config change.

- [ ] **Step 3: Verify + commit**

Run: `npm run build` — ok, `dist/manifest.webmanifest` unchanged in shape.

```bash
git add public/icon.svg public/pwa-192.png public/pwa-512.png public/pwa-maskable-512.png
git commit -m "feat: new beer-and-coins logo across icons"
```

---

### Task 11: UX pass — tokens, Home redesign, sticky actions, payment chips, animations

**Files:**
- Modify: `src/app.css`, `src/routes/Home.svelte`, `src/routes/Game.svelte`, `src/lib/EndOverlay.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`

**Interfaces:**
- Consumes: `unlockedLevel($progress)` for the Play card; Money component for payment chips; existing keyframes.
- Produces: i18n keys `home.continue` ('Continue — Level {n}'/'Weiter — Level {n}'), `home.rush-sub` ('Survive the night'/'Überlebe die Nacht'), `home.daily-sub` ('Today’s 10 orders'/'Die 10 Aufträge des Tages'), `home.practice-sub` ('Drill your weakest skill'/'Trainiere deine Schwächen').

- [ ] **Step 1: Tokens in app.css**

Append:

```css
:root {
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 24px;
  --shadow: 0 2px 8px rgb(0 0 0 / 0.35);
}
button:active { transform: scale(0.97); }
@media (prefers-reduced-motion: reduce) {
  button:active { transform: none; }
}
```

- [ ] **Step 2: Home redesign**

Replace `src/routes/Home.svelte`:

```svelte
<script lang="ts">
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import { keynav } from '../lib/keynav';
  import { daily } from '../stores/daily';
  import { dailyKey } from '../core/daily';
  import { progress, unlockedLevel } from '../stores/progress';

  const doneToday = $derived($daily?.date === dailyKey(new Date()));
  const level = $derived(unlockedLevel($progress));
</script>

<main class="home" use:keynav>
  <img class="logo" src="/icon.svg" alt="" width="96" height="96" />
  <h1>{$t('home.title')}</h1>

  <button class="play" onclick={() => go(`game/${level}`)}>
    <strong>{$t('home.play')}</strong>
    <span>{$t('home.continue').replace('{n}', String(level))}</span>
  </button>

  <div class="tiles" style="--keynav-cols: 3">
    <button onclick={() => go('rush')}>
      🌙<strong>{$t('home.rush')}</strong><span>{$t('home.rush-sub')}</span>
    </button>
    <button onclick={() => go('daily')}>
      📅<strong>{$t('home.daily')}{doneToday ? ' ✓' : ''}</strong><span>{$t('home.daily-sub')}</span>
    </button>
    <button onclick={() => go('practice')}>
      🎯<strong>{$t('home.practice')}</strong><span>{$t('home.practice-sub')}</span>
    </button>
  </div>

  <div class="row">
    <button class="minor" onclick={() => go('levels')}>{$t('levels.title')}</button>
    <button class="minor" onclick={() => go('stats')}>{$t('home.stats')}</button>
    <button class="minor" onclick={() => go('menu')}>{$t('home.menu')}</button>
    <button class="minor" onclick={() => go('settings')}>{$t('home.settings')}</button>
  </div>
</main>

<style>
  .home {
    min-height: 100dvh; display: flex; flex-direction: column;
    justify-content: center; align-items: stretch; gap: var(--space-4);
    max-width: 360px; margin: 0 auto; padding: var(--space-5);
    padding-bottom: calc(var(--space-5) + env(safe-area-inset-bottom));
  }
  .logo { align-self: center; border-radius: 20px; box-shadow: var(--shadow); }
  h1 { text-align: center; font-family: Georgia, serif; margin-bottom: var(--space-2); }
  .play {
    display: flex; flex-direction: column; gap: var(--space-1);
    background: var(--accent); color: var(--ink);
    font-size: 1.2rem; padding: var(--space-4); box-shadow: var(--shadow);
  }
  .play span { font-size: 0.85rem; opacity: 0.8; }
  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
  .tiles button {
    display: flex; flex-direction: column; gap: var(--space-1); align-items: center;
    background: var(--wood-light); color: var(--cream);
    padding: var(--space-3) var(--space-1); font-size: 1.2rem;
  }
  .tiles strong { font-size: 0.9rem; }
  .tiles span { font-size: 0.7rem; opacity: 0.7; }
  .row { display: flex; gap: var(--space-2); }
  .row .minor {
    flex: 1; background: none; color: var(--cream);
    border: 1px solid var(--wood-light); font-size: 0.85rem; padding: var(--space-2);
  }
</style>
```

(The Levels map moves into the bottom row; the Play card jumps straight into the highest unlocked level.)

- [ ] **Step 3: Game — sticky action bar, Money payment chips, phase cross-fade**

In `src/routes/Game.svelte`:

Payment chips — replace the `.paid` spans:

```svelte
      <p class="prompt">
        {$t('game.pays')}:
        {#each [...round.paymentPieces].sort((a, b) => b - a) as p, i (i)}
          <Money denom={p} />
        {/each}
      </p>
```

(`Money` is imported already? If not: `import Money from '../lib/Money.svelte';`. The `.paid` style rule is removed.)

Phase cross-fade — wrap the phase area:

```svelte
    {#key round.phase}
      <div class="phase">
        {#if round.phase === 'sum'}
          ...existing sum markup...
        {:else if round.phase === 'change'}
          ...existing change markup...
        {/if}
      </div>
    {/key}
```

with style `.phase { display: flex; flex-direction: column; gap: 0.75rem; animation: op-slide-up 0.15s ease-out; }`.

Sticky actions — the change-phase `.actions` div style becomes:

```css
  .actions {
    display: flex; gap: 0.5rem;
    position: sticky; bottom: 0;
    padding: var(--space-2) 0 calc(var(--space-2) + env(safe-area-inset-bottom));
    background: var(--wood);
  }
```

- [ ] **Step 4: EndOverlay — sequential stars + score count-up**

In `src/lib/EndOverlay.svelte`, replace the stars line with:

```svelte
    <p class="stars">
      {#each [0, 1, 2] as i (i)}
        <span class="star" class:earned={i < stars} style="animation-delay: {i * 0.25}s">
          {i < stars ? '★' : '☆'}
        </span>
      {/each}
    </p>
```

and the score line with a count-up:

```svelte
  <p>{$t('game.score')}: {displayScore}</p>
```

```ts
  let displayScore = $state(0);
  $effect(() => {
    const target = session.score;
    const steps = 20;
    let i = 0;
    displayScore = 0;
    const iv = setInterval(() => {
      i += 1;
      displayScore = Math.round((target * i) / steps);
      if (i >= steps) clearInterval(iv);
    }, 30);
    return () => clearInterval(iv);
  });
```

Styles:

```css
  .star { display: inline-block; animation: op-pop 0.3s ease-out both; }
  .star.earned { color: var(--accent); }
```

(`op-pop ... both` keeps stars invisible until their delayed pop; under reduced motion the global kill switch shows them immediately.)

- [ ] **Step 5: i18n + verify + commit**

Add the four `home.*` keys from Interfaces to both dictionaries.

Run: `npx vitest run` green; `npm run check` 0/0; `npm run build` ok.

```bash
git add src/app.css src/routes/Home.svelte src/routes/Game.svelte src/lib/EndOverlay.svelte src/i18n
git commit -m "feat: card home, sticky actions, payment chips, animated results"
```

---

### Task 12: final verification + README controls section

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README controls + round-3 notes**

Add to `README.md` after the feature bullets:

```markdown
- **Plays great with a keyboard**: type sums directly (`5` → 5,00 €, comma for
  cents), number keys grab coins from the till, Enter confirms, A asks,
  N challenges a short payment, T buys a hint, Space pauses, Esc opens the
  game menu.
- **Tipp system**: stuck? A hint costs 25 points and the round's first-try
  bonus — it shows structure (a line's subtotal, the change amount), never
  the full answer.
```

- [ ] **Step 2: Full verification**

Run: `npx vitest run` — all green (~140 tests).
Run: `npm run check` — 0 errors, 0 warnings.
Run: `npm run build` — clean; `dist/` contains the regenerated icons.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: keyboard controls and hints in README"
```

---

## Verification checklist (whole plan)

- `npx vitest run` all green; `npm run check` 0/0; `npm run build` clean.
- Manual: rush night flows continuously; DE locale shows Bier/Wasser everywhere; typing `5` + Enter answers a 5 € order; zero-change round shows Finish with a dimmed till; Space pauses (order hidden, patience frozen), Esc menus, arrow keys walk Home/Levels/Practice; L1 noticeably harder; Tipp reveals and deducts; praise escalates with streak; new logo on Home and installed icon.
