# Orders, Please — Round 8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement round 8 per `docs/superpowers/specs/2026-08-26-orders-please-round8-design.md`: pieces-mode change entry (classic amount mode as setting), top flash, error toasts, pause quick settings, numpad nav, Main-menu rename, volume/haptics, levels 31-40, weekly challenge, update toast, and the polish backlog.

**Architecture:** Core first (L40 anchor, weekly TDD), then settings/audio plumbing, then the Game change-entry rework, then UI polish waves. Weekly reuses the daily machinery pattern (seeded session, per-round ramp, record store).

**Tech Stack:** unchanged — Svelte 5 (runes), Vite, TypeScript, Vitest, vite-plugin-pwa.

## Global Constraints

- All prior constraints hold: integer cents, core purity, EN+DE for every UI string, svelte-check 0/0, build clean, suite green, no z-index, determinism (weekly consumes rng exactly like daily; no other new consumption), persisted stores tolerate legacy payloads (`?? default` on every new settings field).
- Pieces mode is the DEFAULT (`settings.amountEntry` falsy); classic amount mode = round-7 behavior exactly, gated by the setting. Pieces mode: pile and till clicks mix; entry names one denomination; empty-Enter confirms; invalid denomination buzzes + toast, no try burned.
- Error toasts never replace round-failure feedback — only the silent retry cases.
- Every commit message ends with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01BFFLt2muz8HfETCzn4N1ok`

---

### Task 1: core levels 31-40

**Files:**
- Modify: `src/core/difficulty.ts`, `src/i18n/en.ts`, `src/i18n/de.ts`
- Test: `tests/core/difficulty.test.ts` (extend), `tests/core/level-names.test.ts` (extend)

- [ ] **Step 1: Failing tests**

Append to `tests/core/difficulty.test.ts`:

```ts
describe('levels 31-40', () => {
  it('MAX_LEVEL is 40 and L40 hits the new anchor', () => {
    expect(MAX_LEVEL).toBe(40);
    const p = paramsForLevel(40);
    expect(p.itemsMin).toBe(6);
    expect(p.itemsMax).toBe(8);
    expect(p.patienceSeconds).toBe(10);
    expect(p.ordersPerLevel).toBe(14);
    expect(p.scarceDenoms).toBe(5);
    expect(p.underpayProb).toBeCloseTo(0.3);
    expect(p.disputeProb).toBeCloseTo(0.3);
    expect(p.tabProb).toBeCloseTo(0.35);
    expect(p.splitProb).toBeCloseTo(0.3);
    expect(p.happyHourProb).toBeCloseTo(0.6);
    expect(p.rowdyProb).toBeCloseTo(0.2);
  });
  it('L30 is unchanged and 30→40 interpolates', () => {
    const p30 = paramsForLevel(30);
    expect(p30.ordersPerLevel).toBe(12);
    expect(p30.patienceSeconds).toBe(12);
    const p35 = paramsForLevel(35);
    expect(p35.ordersPerLevel).toBe(13);
    expect(p35.patienceSeconds).toBe(11);
    expect(p35.underpayProb).toBeCloseTo(0.275);
  });
});
```

`tests/core/level-names.test.ts`: the completeness loop asserts keys `level.name.1`..`level.name.MAX_LEVEL` in both dictionaries — verify it derives the range from `MAX_LEVEL` (if hardcoded 30, change the bound to `MAX_LEVEL`). Run: FAIL.

- [ ] **Step 2: Implement**

`src/core/difficulty.ts`: `MAX_LEVEL = 40`; append the L40 anchor:

```ts
  { level: 40, itemsMin: 6, itemsMax: 8, priceStyle: 'any',  paymentStyle: 'awkward',
    patienceSeconds: 10, menuVisibleSeconds: 0,    scarceDenoms: 5, midOrderChangeProb: 0.45,
    showPileTotal: false, ordersPerLevel: 14,
    underpayProb: 0.3, disputeProb: 0.3, tabProb: 0.35, splitProb: 0.3,
    happyHourProb: 0.6, rowdyProb: 0.2 },
```

i18n level names 31-40 (append after level.name.30 in both files):

en: 31 'Overtime', 32 'Double Booking', 33 'Power Cut', 34 'Festival Eve', 35 'The Rush', 36 'No Breaks', 37 "Champions' Night", 38 'Chaos Shift', 39 'Final Boss', 40 "Owner's Chair"
de: 31 'Überstunden', 32 'Doppelt gebucht', 33 'Stromausfall', 34 'Festival-Vorabend', 35 'Der Ansturm', 36 'Ohne Pause', 37 'Nacht der Champions', 38 'Chaos-Schicht', 39 'Endgegner', 40 'Chefsessel'

(keys `'level.name.31': 'Overtime',` etc.)

- [ ] **Step 3: PASS + suite (adjust any test that assumed MAX_LEVEL 30 — verify each adjustment is a legitimate re-derivation, never a weakened assertion) + check + build; commit**

```bash
git add src/core/difficulty.ts src/i18n tests/core
git commit -m "feat: levels 31-40 with an endgame anchor"
```

---

### Task 2: core weekly challenge + store

**Files:**
- Create: `src/core/weekly.ts`, `src/stores/weekly.ts`
- Test: `tests/core/weekly.test.ts`

**Interfaces:**
- Produces:

```ts
// core/weekly.ts
export const WEEKLY_ORDERS = 20;
export function weekKey(date: Date): string;        // ISO week 'YYYY-Www' (e.g. '2026-W35')
export function weeklySeed(date: Date): number;     // deterministic int from weekKey
export function weeklyLevelFor(roundIndex: number): number; // min(30, 5 + floor(i*25/19))
export interface WeeklyRecord { week: string; score: number; best: number }
export function nextWeeklyRecord(
  prev: WeeklyRecord | null, date: Date, score: number,
): WeeklyRecord;
// same week: keeps the week's first score unless the new one is higher; best = max ever
export function weeklyShareText(date: Date, score: number, served: number, total: number): string;
// 'Orders, Please 2026-W35 — 4.230 pts · 18/20'

// stores/weekly.ts
export const weekly: Writable<WeeklyRecord | null>; // persisted 'op.weekly', null
```

- [ ] **Step 1: Failing tests**

```ts
// tests/core/weekly.test.ts
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
```

Run: FAIL. Hand-verify the ISO expectations before implementing (2026-01-01 is a Thursday → W01 ✓; 2027-01-01 is a Friday → belongs to 2026-W53 ✓; 2024-12-30 is a Monday → 2025-W01 ✓).

- [ ] **Step 2: Implement**

```ts
// src/core/weekly.ts
export const WEEKLY_ORDERS = 20;

/** ISO-8601 week: Thursday of the current week determines the week-year. */
export function weekKey(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - day + 3); // this week's Thursday
  const weekYear = d.getFullYear();
  const jan4 = new Date(weekYear, 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7;
  const week1Mon = new Date(weekYear, 0, 4 - jan4Day);
  const week = 1 + Math.round((d.getTime() - week1Mon.getTime()) / (7 * 86400000));
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}

export function weeklySeed(date: Date): number {
  const key = weekKey(date);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** Virtual difficulty for order index 0..19: 5 → 30. */
export function weeklyLevelFor(roundIndex: number): number {
  return Math.min(30, 5 + Math.floor((Math.min(roundIndex, WEEKLY_ORDERS - 1) * 25) / (WEEKLY_ORDERS - 1)));
}

export interface WeeklyRecord { week: string; score: number; best: number }

export function nextWeeklyRecord(
  prev: WeeklyRecord | null, date: Date, score: number,
): WeeklyRecord {
  const week = weekKey(date);
  const best = Math.max(prev?.best ?? 0, score);
  if (prev && prev.week === week) {
    return { week, score: Math.max(prev.score, score), best };
  }
  return { week, score, best };
}

function formatPts(score: number): string {
  return String(score).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function weeklyShareText(
  date: Date, score: number, served: number, total: number,
): string {
  const check = served === total ? ' ✓' : '';
  return `Orders, Please ${weekKey(date)} — ${formatPts(score)} pts · ${served}/${total}${check}`;
}
```

```ts
// src/stores/weekly.ts
import { persisted } from './persisted';
import type { WeeklyRecord } from '../core/weekly';

export const weekly = persisted<WeeklyRecord | null>('op.weekly', null);
```

- [ ] **Step 3: PASS + suite + check + build; commit**

```bash
git add src/core/weekly.ts src/stores/weekly.ts tests/core/weekly.test.ts
git commit -m "feat: weekly challenge core — ISO week seed, ramp, record"
```

---

### Task 3: settings fields + volume + haptics plumbing

**Files:**
- Modify: `src/stores/settings.ts`, `src/lib/sound.ts`, `src/routes/Settings.svelte`, `src/App.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`
- Create: `src/lib/haptics.ts`

- [ ] **Step 1: Settings fields**

`src/stores/settings.ts`: interface gains `amountEntry: boolean; volume: number; haptics: boolean;` — defaults `amountEntry: false, volume: 1, haptics: true`. Legacy payloads lack them: every consumer reads with `?? default` (`$settings.volume ?? 1`, `$settings.haptics ?? true`; `amountEntry` falsy-safe as-is).

- [ ] **Step 2: sound.ts volume**

Add at module top:

```ts
let volume = 1;
export function setVolume(v: number): void {
  volume = Math.min(1, Math.max(0, v));
}
```

and in `tone(...)` change `g.gain.setValueAtTime(gain, t0)` to `g.gain.setValueAtTime(Math.max(0.0001, gain * volume), t0)` (exponential ramps reject 0 — floor it).

`src/App.svelte`: add

```ts
  import { setVolume } from './lib/sound';
  $effect(() => {
    setVolume($settings.volume ?? 1);
  });
```

- [ ] **Step 3: haptics helper**

```ts
// src/lib/haptics.ts
/** Fire-and-forget vibration; silently unsupported on desktop. */
export function vibrate(ms: number, enabled: boolean): void {
  if (!enabled) return;
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
}
```

- [ ] **Step 4: Settings route controls**

`src/routes/Settings.svelte`, after the alwaysShowPrices checkbox:

```svelte
  <label><input type="checkbox" bind:checked={$settings.amountEntry} /> {$t('settings.amount-entry')}</label>
  <label><input type="checkbox" bind:checked={$settings.haptics} /> {$t('settings.haptics-label')}</label>
  {#if $settings.sound}
    <label class="vol">{$t('settings.volume')}
      <input type="range" min="0" max="1" step="0.1" bind:value={$settings.volume} />
    </label>
  {/if}
```

with style `.vol input { flex: 1; }`. NOTE on legacy payloads: `bind:value` on an undefined volume renders the range at its default — add a one-time normalizer at the top of the script: `if ($settings.volume === undefined) settings.update((s) => ({ ...s, volume: 1, haptics: s.haptics ?? true, amountEntry: s.amountEntry ?? false }));`

- [ ] **Step 5: i18n**

en: `'settings.amount-entry': 'Type the whole change amount (classic)', 'settings.haptics-label': 'Vibration', 'settings.volume': 'Volume',`
de: `'settings.amount-entry': 'Ganzen Betrag tippen (klassisch)', 'settings.haptics-label': 'Vibration', 'settings.volume': 'Lautstärke',`

- [ ] **Step 6: Verify + commit**

```bash
git add src/stores/settings.ts src/lib/sound.ts src/lib/haptics.ts src/routes/Settings.svelte src/App.svelte src/i18n
git commit -m "feat: volume, vibration and input-method settings"
```

---

### Task 4: pieces-mode change entry + error toasts + flash top

**Files:**
- Modify: `src/routes/Game.svelte`, `src/lib/ChangePhase.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`

- [ ] **Step 1: Flash + error toast slots**

Game.svelte CSS: positioned `.flash` rule → `inset: 7% 0 auto 0;` and add `font-size: 1.15rem;` (replacing 1.3rem). New state `let errorFlash = $state<string | null>(null);` with its own timer `const errT = new PausableTimer();` (add to the timer arrays in `setPaused`, `maybeExplain`/`dismissExplain`, and the unmount cleanup + `restart()` clear, exactly like flashT). Helper:

```ts
  function showError(key: string) {
    errorFlash = $t(key);
    errT.clear();
    errT.start(() => (errorFlash = null), 1100);
  }
```

Markup after the `{#if flash}` line:

```svelte
  {#if errorFlash}<div class="flash err-flash">{errorFlash}</div>{/if}
```

with style `.err-flash { inset: 14% 0 auto 0; background: var(--danger); color: var(--cream); font-size: 1rem; }`.

- [ ] **Step 2: Wire the silent-retry toasts**

- `onSum`: the existing `else if (round.sumTries > 0 && round.phase === 'sum')` branch gains `showError('err.sum');` next to the buzz.
- `confirmChange`: the wrong-pile `else { pile = []; errorBuzz(...) }` branch gains `showError('err.change');`.
- Round-failure flashes are untouched.

- [ ] **Step 3: Pieces mode**

`submitTyped()` becomes mode-aware (`amountEntry` read via `get(settings).amountEntry`):

```ts
  function submitTyped() {
    if (!round) return;
    if (typedChange === '') {
      confirmChange();
      return;
    }
    const amount = parseEntry(typedChange);
    typedChange = '';
    if (!get(settings).amountEntry) {
      // pieces mode: the entry names one denomination
      const d = amount as Denom;
      if (!DENOMS.includes(d) || (tillView[d] ?? 0) <= 0) {
        errorBuzz($settings.sound);
        showError('err.denom');
        return;
      }
      pile = [...pile, d];
      coinClink($settings.sound);
      return;
    }
    // classic amount mode (round 7)
    const pieces = makeChange(round.till, amount);
    if (pieces === null && amount === round.changeDue) {
      errorBuzz($settings.sound);
      askOpen = true;
      return;
    }
    pile = pieces ?? [];
    confirmChange();
  }
```

(`DENOMS` returns to the till import; `Denom` already imported.)

`typeChange()`: the first line `if (typedChange === '') pile = [];` becomes mode-aware — clear the pile only in classic mode:

```ts
    if (typedChange === '' && get(settings).amountEntry) pile = [];
```

`take()`: the `typedChange = '';` line added in round 7 stays ONLY for classic mode:

```ts
    if (get(settings).amountEntry) typedChange = '';
```

(pieces mode: clicking and typing feed the same pile; a half-typed entry survives a click.)

- [ ] **Step 4: ChangePhase hint text**

Game passes a mode-aware hint. ChangePhase already renders `{$t('game.typed-hint')}` inside `.typed` — change the component to take the hint as a prop instead: rename usage so the component renders `<small>{typedHint}</small>` with new optional prop `typedHint: string` default `''`, and Game passes:

```svelte
            typedHint={$settings.amountEntry ? $t('game.typed-hint') : $t('game.typed-hint-piece')}
```

- [ ] **Step 5: i18n**

en: `'game.typed-hint-piece': 'Enter adds this piece', 'err.sum': 'Sum is wrong — try again', 'err.change': 'Change is wrong', 'err.denom': 'No coin or note with that value',`
de: `'game.typed-hint-piece': 'Enter legt dieses Stück', 'err.sum': 'Summe stimmt nicht — nochmal', 'err.change': 'Rückgeld stimmt nicht', 'err.denom': 'Kein passendes Stück',`

- [ ] **Step 6: Verify + commit**

Run: suite green; check 0/0; build clean. Self-check the pieces flow: `2 ⏎` adds a 2€ piece; `2,5 ⏎` buzzes + toast, no try burned; `⏎` on empty confirms; classic toggle restores round-7 behavior including pile-clearing.

```bash
git add src/routes/Game.svelte src/lib/ChangePhase.svelte src/i18n
git commit -m "feat: piecewise change entry by default with error toasts"
```

---

### Task 5: pause-menu quick settings + Main-menu rename + numpad nav

**Files:**
- Modify: `src/lib/PauseOverlay.svelte`, `src/lib/keynav.ts`, `src/i18n/en.ts`, `src/i18n/de.ts`

- [ ] **Step 1: PauseOverlay quick settings**

PauseOverlay imports the settings store directly (`import { settings } from '../stores/settings';` + `t` already there). The sound button stays where it is (it toggles via callback for Game's benefit — keep the existing `ontogglesound` contract). Under `.menu-actions` add:

```svelte
    <div class="quick">
      <h3>{$t('pause.settings')}</h3>
      {#if soundOn}
        <label>{$t('settings.volume')}
          <input type="range" min="0" max="1" step="0.1" bind:value={$settings.volume} />
        </label>
      {/if}
      <label><input type="checkbox" bind:checked={$settings.alwaysShowPrices} /> {$t('settings.show-prices')}</label>
      <label><input type="checkbox" bind:checked={$settings.amountEntry} /> {$t('settings.amount-entry')}</label>
      <label><input type="checkbox" bind:checked={$settings.haptics} /> {$t('settings.haptics-label')}</label>
    </div>
```

with styles:

```css
  .quick {
    display: flex; flex-direction: column; gap: 0.5rem; width: 240px;
    text-align: left; font-size: 0.9rem; margin-top: 0.5rem;
    background: rgb(255 255 255 / 0.06); border-radius: var(--radius); padding: 0.75rem;
  }
  .quick h3 { font-size: 0.8rem; opacity: 0.7; text-transform: uppercase; }
  .quick label { display: flex; align-items: center; gap: 0.5rem; }
  .quick input[type='range'] { flex: 1; }
  .quick input[type='checkbox'] { width: 20px; height: 20px; }
```

NOTE: the quick block lives OUTSIDE the `use:keynav` `.menu-actions` div (checkbox/range inputs must not join the button grid; keynav's input guard covers key events).

- [ ] **Step 2: rename + i18n**

en: `'result.home': 'Main menu',` (replace 'Home'); add `'pause.settings': 'Settings',`
de: `'result.home': 'Hauptmenü',` (replace 'Start'); add `'pause.settings': 'Einstellungen',`

- [ ] **Step 3: keynav numpad digits**

In `keynav`'s `VIM` map add: `'4': 'ArrowLeft', '6': 'ArrowRight', '8': 'ArrowUp', '2': 'ArrowDown',` (same object; rename the const to `KEYMAP` for honesty).

- [ ] **Step 4: Verify + commit**

Run: suite green; check 0/0; build clean.

```bash
git add src/lib/PauseOverlay.svelte src/lib/keynav.ts src/i18n
git commit -m "feat: quick settings in the pause menu, numpad nav, Main menu label"
```

---

### Task 6: weekly mode wiring

**Files:**
- Modify: `src/core/session.ts`, `src/core/tips.ts`, `src/core/badges.ts`, `src/routes/Game.svelte`, `src/routes/Home.svelte`, `src/App.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`
- Test: `tests/core/session.test.ts` (extend)

- [ ] **Step 1: Core unions + ramp (TDD)**

Append to `tests/core/session.test.ts`:

```ts
describe('weekly mode', () => {
  it('ramps params per round like daily but toward level 30', () => {
    let s = createSession('weekly', 1, DEFAULT_MENU, false, 42, {
      ...paramsForLevel(5), ordersPerLevel: 20,
    });
    for (let i = 0; i < 19; i++) {
      const round = createRound(
        { lines: [{ item: DEFAULT_MENU[0], qty: 1 }], totalCents: DEFAULT_MENU[0].priceCents },
        [5000], s.till,
      );
      const done = { ...round, phase: 'done' as const, success: true as const };
      s = completeRound(s, done, { orderText: '', ms: 1000 });
    }
    expect(s.finished).toBe(null); // 19 of 20 done
    expect(s.params.patienceSeconds).toBeLessThanOrEqual(paramsForLevel(30).patienceSeconds + 2);
  });
});
```

(Adapt imports to the file's existing style; the assertion pins that the ramp actually tightens params.) Run FAIL (unknown mode).

Implement:
- `session.ts`: `SessionMode` gains `'weekly'`; in `completeRound`, extend the daily ramp block:

```ts
  if (next.finished === null && (next.mode === 'daily' || next.mode === 'weekly')) {
    const lvl = next.mode === 'daily'
      ? dailyLevelFor(next.roundsDone)
      : weeklyLevelFor(next.roundsDone);
    next.params = { ...paramsForLevel(lvl), ordersPerLevel: next.params.ordersPerLevel };
  }
```

(import `weeklyLevelFor` from './weekly'). Also `effectiveLevel`: weekly returns `weeklyLevelFor(s.roundsDone)` like daily's branch.
- `tips.ts`: no mode field — Game gates modes; nothing to change (verify).
- `badges.ts`: `BadgeContext.mode` union gains `'weekly'`; `first-win`'s `anyWin` treats weekly like daily (`(ctx.mode === 'daily' || ctx.mode === 'weekly') && ctx.finished === 'won'`). Existing badge tests keep passing (re-run).

- [ ] **Step 2: Game wiring**

`Game.svelte`:
- `newSession()`: weekly branch — `override = mode === 'weekly' ? { ...paramsForLevel(weeklyLevelFor(0)), ordersPerLevel: WEEKLY_ORDERS } : ...`; `seed = mode === 'weekly' ? weeklySeed(new Date()) : ...`; menu/custom flags exactly like daily (localized default menu, not custom).
- Tip earn gate adds weekly: `(mode === 'level' || mode === 'rush' || mode === 'daily' || mode === 'weekly')`.
- `finalize()`: weekly block after the daily block:

```ts
    if (session.mode === 'weekly') {
      weekly.update((prev) => nextWeeklyRecord(prev, new Date(), session.score));
    }
```

- `doShare()`: weekly variant — when mode === 'weekly' use `weeklyShareText(new Date(), session.score, served, WEEKLY_ORDERS)`.
- EndOverlay props: `onshare={mode === 'daily' || mode === 'weekly' ? doShare : null}`.
- Header title branch: weekly shows `$t('weekly.title')`.
- badges context: mode passes through unchanged (union now allows it).

- [ ] **Step 3: Routes + Home tile**

`App.svelte`: `{:else if $route === 'weekly'}<Game mode="weekly" />` and add `'weekly'` to `onGameRoute`'s condition.

`Home.svelte`: fourth tile in `.tiles`:

```svelte
    <button onclick={() => go('weekly')}>
      🗓<strong>{$t('home.weekly')}{doneThisWeek ? ' ✓' : ''}</strong><span>{$t('home.weekly-sub')}</span>
    </button>
```

with `const doneThisWeek = $derived($weekly?.week === weekKey(new Date()));` (imports weekly store + weekKey) and `.tiles` grid becomes `grid-template-columns: repeat(2, 1fr);` with `--keynav-cols: 2` on the style attribute (was 3 — update BOTH the CSS and the inline `--keynav-cols`).

- [ ] **Step 4: i18n**

en: `'home.weekly': 'Weekly', 'home.weekly-sub': 'One seed, seven days', 'weekly.title': 'Weekly',`
de: `'home.weekly': 'Wochen-Challenge', 'home.weekly-sub': 'Ein Seed, sieben Tage', 'weekly.title': 'Wochen-Challenge',`

- [ ] **Step 5: Verify + commit**

Run: suite green; check 0/0; build clean.

```bash
git add src/core src/routes src/App.svelte src/stores src/i18n tests/core/session.test.ts
git commit -m "feat: weekly challenge mode with its own seed and record"
```

---

### Task 7: GameHeader extraction + haptics wiring

**Files:**
- Create: `src/lib/GameHeader.svelte`
- Modify: `src/routes/Game.svelte`

- [ ] **Step 1: GameHeader**

```svelte
<!-- src/lib/GameHeader.svelte -->
<script lang="ts">
  let { lives, heartPulse, title, streak, tipJar, tipJarText, score, scoreLabel, menuLabel, onmenu }: {
    lives: number; heartPulse: boolean; title: string; streak: number;
    tipJar: number; tipJarText: string; score: number; scoreLabel: string;
    menuLabel: string; onmenu: () => void;
  } = $props();
</script>

<header>
  <span class="lives" class:pulse={heartPulse}>{'♥'.repeat(Math.max(0, lives))}</span>
  <span>{title}</span>
  {#if streak >= 3}<span class="flame">🔥{streak}</span>{/if}
  {#if tipJar > 0}<span class="jar">🫙 {tipJarText}</span>{/if}
  <span>{scoreLabel}: {score}</span>
  <button class="menu-btn" aria-label={menuLabel} onclick={onmenu}>☰</button>
</header>

<style>
  header { display: flex; justify-content: space-between; align-items: center; }
  .lives { color: var(--danger); }
  .lives.pulse { animation: op-pulse 0.5s ease-in-out; }
  .flame { color: var(--accent); font-weight: bold; animation: op-pop 0.3s ease-out; }
  .jar { font-size: 0.9rem; }
  .menu-btn { background: none; color: var(--cream); font-size: 1.2rem; padding: 0 0.3rem; min-height: 0; }
</style>
```

Game.svelte replaces its inline `<header>…</header>` with:

```svelte
  <GameHeader
    lives={MAX_LIVES - session.livesLost} {heartPulse}
    title={mode === 'level' ? `${level} · ${$t(`level.name.${level}`)}`
      : mode === 'rush' ? `${$t('game.rush')} · ${session.level >= MAX_LEVEL ? '40+' : session.level}`
      : mode === 'practice' ? $t('practice.title')
      : mode === 'weekly' ? $t('weekly.title')
      : $t('daily.title')}
    streak={session.streak}
    {tipJar} tipJarText={formatEuro(tipJar, symbolFirst)}
    score={session.score} scoreLabel={$t('game.score')}
    menuLabel={$t('game.menu')} onmenu={() => setPaused(true, true)}
  />
```

and deletes the now-unused header styles (.lives/.pulse/.flame/.jar/.menu-btn — verify each unused with grep; `header` selector too). Note the rush cap label becomes '40+' (MAX_LEVEL moved).

- [ ] **Step 2: Haptics wiring**

Game.svelte imports `vibrate` from '../lib/haptics'. Call sites:
- `finishRound()`: success → `vibrate(20, $settings.haptics ?? true)` next to chaChing; failure → `vibrate(60, ...)` next to errorBuzz;
- walkout flash block in the interval → `vibrate(60, ...)`.

- [ ] **Step 3: Verify + commit**

Run: suite green; check 0/0; build clean. Report Game.svelte's new line count.

```bash
git add src/lib/GameHeader.svelte src/routes/Game.svelte
git commit -m "refactor: extract GameHeader and add haptic feedback"
```

---

### Task 8: polish backlog — overlay clip, chart line, tutorial nudge

**Files:**
- Modify: `src/lib/EndOverlay.svelte`, `src/routes/Stats.svelte`, `src/routes/Tutorial.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`

- [ ] **Step 1: EndOverlay safe center**

`.overlay` rule: `justify-content: center;` → `justify-content: safe center;`. Browsers without `safe` support ignore the whole declaration — so ALSO add `margin: auto 0;` guidance: wrap is overkill; instead add to the overlay's first child spacing via `.overlay > :first-child { margin-top: auto; } .overlay > :last-child { margin-bottom: auto; }`? NO — simplest robust pattern: keep flex column, replace `justify-content: center` with nothing, and give the overlay `padding: 2rem 1rem;` plus `.overlay { justify-content: safe center; }` AFTER a base `justify-content: center;` line (two declarations: `justify-content: center; justify-content: safe center;` — cascade keeps `center` where `safe` unsupported, upgrades where supported). Content stays centered when short, scrolls from the top when tall in modern browsers.

- [ ] **Step 2: Chart accuracy polyline**

`src/routes/Stats.svelte`: inside the chart `<svg>`, before the `{#each}`, build the line segments in script:

```ts
  const accSegments = $derived.by(() => {
    const segs: string[] = [];
    let current: string[] = [];
    days.forEach(({ entry }, i) => {
      if (entry && entry.rounds > 0) {
        const acc = entry.correct / entry.rounds;
        current.push(`${i * 20 + 10},${70 - acc * 60}`);
      } else if (current.length) {
        segs.push(current.join(' '));
        current = [];
      }
    });
    if (current.length) segs.push(current.join(' '));
    return segs.filter((s) => s.includes(' ')); // only segments with ≥2 points
  });
```

and render after the bars/dots each-block (so the line draws over bars, under nothing that matters):

```svelte
      {#each accSegments as pts (pts)}
        <polyline points={pts} class="acc-line" />
      {/each}
```

with style `.acc-line { fill: none; stroke: var(--cream); stroke-width: 1.5; opacity: 0.8; }`.

- [ ] **Step 3: Tutorial ask nudge**

`src/routes/Tutorial.svelte` `confirm()`: add a local `let asked = $state(false);` set to true in `onAsk`'s success path and reset to false in `startStep`. At the top of `confirm()` (before the pile comparison) add the guard:

```ts
    if (TUTORIAL_STEPS[step].needsAsk && !asked) {
      errorBuzz($settings.sound);
      coach = get(t)('tutorial.need-ask');
      pile = [];
      return;
    }
```



i18n: en `'tutorial.need-ask': "The till can't make this change — press Ask first.",` de `'tutorial.need-ask': 'Die Kasse kann das nicht passend geben — drück zuerst Fragen.',`

- [ ] **Step 4: Verify + commit**

```bash
git add src/lib/EndOverlay.svelte src/routes/Stats.svelte src/routes/Tutorial.svelte src/i18n
git commit -m "fix: overlay fits short screens, chart gains an accuracy line, tutorial nudges the ask"
```

---

### Task 9: PWA update toast

**Files:**
- Modify: `vite.config.ts`, `src/main.ts`, `src/App.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`
- Create: `src/stores/update.ts`

- [ ] **Step 1: Prompt-mode registration**

`vite.config.ts`: `registerType: 'autoUpdate'` → `registerType: 'prompt'`.

```ts
// src/stores/update.ts
import { writable } from 'svelte/store';

export const updateReady = writable(false);
export let doUpdate: () => void = () => {};
export function setUpdater(fn: () => void): void {
  doUpdate = fn;
}
```

`src/main.ts` (read the current file; add):

```ts
import { registerSW } from 'virtual:pwa-register';
import { updateReady, setUpdater } from './stores/update';

const updateSW = registerSW({
  onNeedRefresh() {
    updateReady.set(true);
  },
});
setUpdater(() => updateSW(true));
```

(If `virtual:pwa-register` types are missing, add `/// <reference types="vite-plugin-pwa/client" />` to `src/vite-env.d.ts`.)

- [ ] **Step 2: App toast**

`src/App.svelte` (imports `updateReady`, `doUpdate`, `t`): at the end of the markup:

```svelte
{#if $updateReady}
  <div class="update-toast" role="status">
    <span>{$t('update.available')}</span>
    <button class="reload" onclick={() => doUpdate()}>{$t('update.reload')}</button>
    <button class="close" aria-label={$t('update.dismiss')} onclick={() => updateReady.set(false)}>✕</button>
  </div>
{/if}
```

with styles (App.svelte gets a style block if it lacks one):

```css
  .update-toast {
    position: fixed; inset: auto 0 0 0; margin: 0 auto 0.75rem; width: fit-content;
    display: flex; gap: 0.6rem; align-items: center;
    background: var(--cream); color: var(--ink);
    padding: 0.5rem 0.9rem; border-radius: var(--radius);
    box-shadow: var(--shadow); font-size: 0.9rem;
  }
  .reload { background: var(--ok); color: var(--cream); }
  .close { background: none; color: var(--ink); min-height: 0; padding: 0 0.2rem; }
```

- [ ] **Step 3: i18n**

en: `'update.available': 'Update available', 'update.reload': 'Reload', 'update.dismiss': 'Dismiss',`
de: `'update.available': 'Update verfügbar', 'update.reload': 'Neu laden', 'update.dismiss': 'Schließen',`

- [ ] **Step 4: Verify + commit**

Run: suite green; check 0/0; both builds clean (the SW registration only activates in production builds — `registerSW` import is virtual and build-safe in dev).

```bash
git add vite.config.ts src/main.ts src/App.svelte src/stores/update.ts src/i18n
git commit -m "feat: update toast instead of silent reloads"
```

---

### Task 10: final verification

- [ ] `npx vitest run` all green; `npm run check` 0/0; `npm run build` + `OP_BASE=/ordersplease/ npm run build` clean.
- [ ] Greps: `z-index` absent; EN/DE key parity equal counts; no `session.rng` outside Game fixed points; persisted setItem try/catch present (verified round 8 start — confirm unchanged).
- [ ] Reduced-motion: confirm new animations (err-flash uses .flash's op-slide-up — acceptable, it's a transform-free? check: op-slide-up is a transform — gate NOT required for tiny toasts per existing convention with .flash) — report status quo.
- [ ] Version bump: set `package.json` `"version"` to `1.6.0` and run `npm install --package-lock-only` so the lockfile follows; commit `chore: bump version to 1.6.0`. (Standing practice from this round on: the package version always matches the release tag.)
- [ ] Report results; fix nothing silently.

## Verification checklist (whole plan)

- Pieces flow `2 ⏎ 0,5 ⏎ ⏎` gives 2,50 €; `2,5 ⏎` buzzes with 'Kein passendes Stück'; classic toggle (Settings AND pause) switches live.
- "Passt!" at top; error toasts under it on wrong tries.
- Pause menu: quick settings bind live; Main menu label reads 'Hauptmenü'.
- 4/6/8/2 + hjkl + arrows all navigate menus.
- Level 31 reachable after winning 30; L40 params bite; weekly plays, records, shares, shows ✓ on Home for the rest of the week.
- Volume slider audibly scales; vibration on supported devices.
- Deploy produces the update toast on the NEXT visit after a new version.
