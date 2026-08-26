# Orders, Please — Round 9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement round 9 per `docs/superpowers/specs/2026-08-26-orders-please-round9-design.md`: career meta (wallet, upgrades, titles, badges 13-20), themes/accessibility (light mode, accents, font scale, color-blind money, left-hand), history surfaces (calendar, weekly archive, compare codes), test infrastructure (component tests, CI smoke), and the ledger cleanup batch.

**Architecture:** Core-pure modules first (career, calendar, compare, badge rules — all TDD), then store/UI wiring in dependency order (theme plumbing before the Bar screen that sells accents; weekly archive before the badge that counts weeks). Test-infra tasks land last so they cover the round's own components.

**Tech Stack:** Svelte 5 (runes), Vite, TypeScript, Vitest (+ new: @testing-library/svelte, jsdom, @playwright/test as dev-deps).

## Global Constraints

- All prior constraints hold: integer cents, core purity, EN+DE for every UI string, svelte-check 0/0, build clean, suite green, no z-index, determinism (this round adds ZERO session.rng consumption; upgrade effects must not touch rng or fire in daily/weekly).
- Ranked fairness: `applyUpgrades` is IDENTITY for modes 'daily' and 'weekly' (gameplay effects); cosmetics apply everywhere.
- Spending never reduces `stats.tipsEarnedCents`; wallet and lifetime accumulate independently at earn time.
- BADGE_IDS order: the existing 12 stay first and unchanged; the 8 new ids append after.
- Theme: default 'dark' keeps today's exact look (no visual change unless the user opts in).
- Every commit message ends with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01BFFLt2muz8HfETCzn4N1ok`

---

### Task 1: core career — catalog, upgrades, titles + store

**Files:**
- Create: `src/core/career.ts`, `src/stores/career.ts`
- Test: `tests/core/career.test.ts`

**Interfaces:**
- Produces:

```ts
// core/career.ts
import type { DifficultyParams } from './difficulty';
import type { SessionMode } from './session';

export interface Upgrade {
  id: string;
  costCents: number;
  kind: 'gameplay' | 'cosmetic';
}
export const UPGRADES: Upgrade[] = [
  { id: 'jar-xl', costCents: 2000, kind: 'gameplay' },
  { id: 'coffee-machine', costCents: 5000, kind: 'gameplay' },
  { id: 'cheat-sheet', costCents: 3000, kind: 'gameplay' },
  { id: 'accent-copper', costCents: 1000, kind: 'cosmetic' },
  { id: 'accent-forest', costCents: 1000, kind: 'cosmetic' },
];

/** Gameplay-affecting params tweak. IDENTITY for daily/weekly (ranked). */
export function applyUpgrades(
  params: DifficultyParams, upgrades: readonly string[], mode: SessionMode,
): DifficultyParams;
// coffee-machine: patienceSeconds + 1 (level/rush/practice only)

export function boostTip(tipCents: number, upgrades: readonly string[], mode: SessionMode): number;
// jar-xl outside daily/weekly: ceil(tip*1.1 to 10c grid); else unchanged

export function freeFirstHint(upgrades: readonly string[], mode: SessionMode): boolean;
// cheat-sheet outside daily/weekly

export type CareerTitle = 'aushilfe' | 'barkeeper' | 'schichtleiter' | 'wirt' | 'legende';
export function careerTitle(totalStars: number, maxLevelWon: number): CareerTitle;

// stores/career.ts
export interface Career { walletCents: number; upgrades: string[] }
export const career: Writable<Career>; // persisted 'op.career', { walletCents: 0, upgrades: [] }
```

- [ ] **Step 1: Failing tests**

```ts
// tests/core/career.test.ts
import { describe, it, expect } from 'vitest';
import {
  UPGRADES, applyUpgrades, boostTip, freeFirstHint, careerTitle,
} from '../../src/core/career';
import { paramsForLevel } from '../../src/core/difficulty';

describe('UPGRADES', () => {
  it('has the five catalog entries with 10c-grid costs', () => {
    expect(UPGRADES.map((u) => u.id)).toEqual(
      ['jar-xl', 'coffee-machine', 'cheat-sheet', 'accent-copper', 'accent-forest']);
    for (const u of UPGRADES) expect(u.costCents % 10).toBe(0);
  });
});

describe('applyUpgrades', () => {
  const base = paramsForLevel(10);
  it('coffee machine adds a second of patience outside ranked modes', () => {
    expect(applyUpgrades(base, ['coffee-machine'], 'level').patienceSeconds)
      .toBe(base.patienceSeconds + 1);
    expect(applyUpgrades(base, ['coffee-machine'], 'practice').patienceSeconds)
      .toBe(base.patienceSeconds + 1);
  });
  it('is identity for daily and weekly regardless of upgrades', () => {
    expect(applyUpgrades(base, ['coffee-machine', 'jar-xl'], 'daily')).toEqual(base);
    expect(applyUpgrades(base, ['coffee-machine'], 'weekly')).toEqual(base);
  });
  it('is identity without the upgrade', () => {
    expect(applyUpgrades(base, ['jar-xl'], 'level')).toEqual(base);
  });
});

describe('boostTip', () => {
  it('jar-xl rounds the 10% boost up to the 10c grid outside ranked', () => {
    expect(boostTip(40, ['jar-xl'], 'level')).toBe(50);   // 44 → 50
    expect(boostTip(100, ['jar-xl'], 'rush')).toBe(110);
    expect(boostTip(40, ['jar-xl'], 'weekly')).toBe(40);
    expect(boostTip(40, [], 'level')).toBe(40);
  });
});

describe('freeFirstHint', () => {
  it('cheat sheet outside ranked only', () => {
    expect(freeFirstHint(['cheat-sheet'], 'level')).toBe(true);
    expect(freeFirstHint(['cheat-sheet'], 'daily')).toBe(false);
    expect(freeFirstHint([], 'level')).toBe(false);
  });
});

describe('careerTitle', () => {
  it('walks the ladder on stars and level', () => {
    expect(careerTitle(0, 0)).toBe('aushilfe');
    expect(careerTitle(10, 5)).toBe('barkeeper');
    expect(careerTitle(30, 15)).toBe('schichtleiter');
    expect(careerTitle(30, 14)).toBe('barkeeper');   // level gate not met
    expect(careerTitle(60, 25)).toBe('wirt');
    expect(careerTitle(90, 40)).toBe('legende');
    expect(careerTitle(90, 39)).toBe('wirt');
  });
});
```

Run FAIL.

- [ ] **Step 2: Implement**

```ts
// src/core/career.ts
import type { DifficultyParams } from './difficulty';
import type { SessionMode } from './session';

export interface Upgrade {
  id: string;
  costCents: number;
  kind: 'gameplay' | 'cosmetic';
}

export const UPGRADES: Upgrade[] = [
  { id: 'jar-xl', costCents: 2000, kind: 'gameplay' },
  { id: 'coffee-machine', costCents: 5000, kind: 'gameplay' },
  { id: 'cheat-sheet', costCents: 3000, kind: 'gameplay' },
  { id: 'accent-copper', costCents: 1000, kind: 'cosmetic' },
  { id: 'accent-forest', costCents: 1000, kind: 'cosmetic' },
];

const RANKED: SessionMode[] = ['daily', 'weekly'];

export function applyUpgrades(
  params: DifficultyParams, upgrades: readonly string[], mode: SessionMode,
): DifficultyParams {
  if (RANKED.includes(mode) || !upgrades.includes('coffee-machine')) return params;
  return { ...params, patienceSeconds: params.patienceSeconds + 1 };
}

export function boostTip(
  tipCents: number, upgrades: readonly string[], mode: SessionMode,
): number {
  if (RANKED.includes(mode) || !upgrades.includes('jar-xl')) return tipCents;
  return Math.ceil((tipCents * 1.1) / 10) * 10;
}

export function freeFirstHint(upgrades: readonly string[], mode: SessionMode): boolean {
  return !RANKED.includes(mode) && upgrades.includes('cheat-sheet');
}

export type CareerTitle = 'aushilfe' | 'barkeeper' | 'schichtleiter' | 'wirt' | 'legende';

export function careerTitle(totalStars: number, maxLevelWon: number): CareerTitle {
  if (totalStars >= 90 && maxLevelWon >= 40) return 'legende';
  if (totalStars >= 60 && maxLevelWon >= 25) return 'wirt';
  if (totalStars >= 30 && maxLevelWon >= 15) return 'schichtleiter';
  if (totalStars >= 10) return 'barkeeper';
  return 'aushilfe';
}
```

```ts
// src/stores/career.ts
import { persisted } from './persisted';

export interface Career { walletCents: number; upgrades: string[] }

export const career = persisted<Career>('op.career', { walletCents: 0, upgrades: [] });
```

- [ ] **Step 3: PASS + suite + check + build; commit**

```bash
git add src/core/career.ts src/stores/career.ts tests/core/career.test.ts
git commit -m "feat: career core — upgrade catalog, effects, titles"
```

---

### Task 2: core calendar + compare + weekly archive store

**Files:**
- Create: `src/core/calendar.ts`, `src/core/compare.ts`, `src/stores/weekly-history.ts`
- Test: `tests/core/calendar.test.ts`, `tests/core/compare.test.ts`

**Interfaces:**
- Produces:

```ts
// core/calendar.ts
export function monthGrid(year: number, month0: number): (string | null)[][];
// weeks (Mon..Sun rows) covering the month; cells are localDayKey-format
// 'yyyy-mm-dd' for days IN the month, null for leading/trailing padding.

// core/compare.ts
export function encodeResult(r: { week: string; score: number }): string;
// 'OP-<week base36-packed>-<score base36>-<mod97 checksum of the payload>'
export function decodeResult(code: string): { week: string; score: number } | null;
// null on any malformed/checksum-failing input; never throws

// stores/weekly-history.ts
export const weeklyHistory: Writable<Record<string, number>>; // 'op.weekly-history', {}
```

- [ ] **Step 1: Failing tests**

```ts
// tests/core/calendar.test.ts
import { describe, it, expect } from 'vitest';
import { monthGrid } from '../../src/core/calendar';

describe('monthGrid', () => {
  it('August 2026 starts on a Saturday and spans 6 Monday-weeks', () => {
    const g = monthGrid(2026, 7); // Aug 2026: Aug 1 = Saturday
    expect(g[0]).toEqual([null, null, null, null, null, '2026-08-01', '2026-08-02']);
    expect(g.at(-1)![0]).toBe('2026-08-31'); // Aug 31 is a Monday
    expect(g.flat().filter(Boolean)).toHaveLength(31);
  });
  it('February 2024 (leap) has 29 days and starts Thursday', () => {
    const g = monthGrid(2024, 1);
    expect(g.flat().filter(Boolean)).toHaveLength(29);
    expect(g[0][3]).toBe('2024-02-01');
  });
  it('December wraps years cleanly', () => {
    const g = monthGrid(2026, 11);
    expect(g.flat().filter(Boolean)).toHaveLength(31);
    expect(g[0][1]).toBe('2026-12-01'); // Dec 1 2026 is a Tuesday
  });
  it('every row has exactly 7 cells', () => {
    for (const row of monthGrid(2026, 7)) expect(row).toHaveLength(7);
  });
});
```

```ts
// tests/core/compare.test.ts
import { describe, it, expect } from 'vitest';
import { encodeResult, decodeResult } from '../../src/core/compare';

describe('compare codec', () => {
  it('round-trips', () => {
    const r = { week: '2026-W35', score: 4230 };
    expect(decodeResult(encodeResult(r))).toEqual(r);
    expect(decodeResult(encodeResult({ week: '2025-W01', score: 0 })))
      .toEqual({ week: '2025-W01', score: 0 });
    expect(decodeResult(encodeResult({ week: '2027-W53', score: 999999 })))
      .toEqual({ week: '2027-W53', score: 999999 });
  });
  it('rejects tampering and garbage without throwing', () => {
    const code = encodeResult({ week: '2026-W35', score: 4230 });
    expect(decodeResult(code.replace(/.$/, (c) => (c === '0' ? '1' : '0')))).toBeNull();
    expect(decodeResult('')).toBeNull();
    expect(decodeResult('hello world')).toBeNull();
    expect(decodeResult('OP--')).toBeNull();
    for (let i = 0; i < 200; i++) {
      const junk = Math.random().toString(36).slice(2);
      expect(() => decodeResult(junk)).not.toThrow();
    }
  });
});
```

Run FAIL.

- [ ] **Step 2: Implement**

```ts
// src/core/calendar.ts
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Monday-first week rows covering the month; null-padded at the edges. */
export function monthGrid(year: number, month0: number): (string | null)[][] {
  const first = new Date(year, month0, 1);
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Mon=0..Sun=6
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${pad(month0 + 1)}-${pad(d)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}
```

```ts
// src/core/compare.ts
/** week '2026-W35' → packed int (year*54 + week) for compact base36. */
function packWeek(week: string): number | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!m) return null;
  return Number(m[1]) * 54 + Number(m[2]);
}

function unpackWeek(n: number): string {
  const year = Math.floor(n / 54);
  const wk = n % 54;
  return `${year}-W${String(wk).padStart(2, '0')}`;
}

function checksum(payload: string): string {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) sum = (sum * 36 + payload.charCodeAt(i)) % 97;
  return String(sum).padStart(2, '0');
}

export function encodeResult(r: { week: string; score: number }): string {
  const w = packWeek(r.week);
  if (w === null || !Number.isInteger(r.score) || r.score < 0) return '';
  const payload = `${w.toString(36)}-${r.score.toString(36)}`;
  return `OP-${payload}-${checksum(payload)}`.toUpperCase();
}

export function decodeResult(code: string): { week: string; score: number } | null {
  const m = /^OP-([0-9A-Z]+)-([0-9A-Z]+)-(\d{2})$/.exec(code.trim().toUpperCase());
  if (!m) return null;
  const payload = `${m[1]}-${m[2]}`.toLowerCase();
  if (checksum(payload) !== m[3]) return null;
  const w = parseInt(m[1], 36);
  const score = parseInt(m[2], 36);
  if (!Number.isFinite(w) || !Number.isFinite(score)) return null;
  const week = unpackWeek(w);
  if (packWeek(week) !== w) return null;
  return { week, score };
}
```

CHECKSUM NOTE: `encodeResult` uppercases the whole string but `checksum` is computed over the lowercase payload — `decodeResult` lowercases before checking, so the round-trip is consistent. Keep that pairing exactly.

```ts
// src/stores/weekly-history.ts
import { persisted } from './persisted';

export const weeklyHistory = persisted<Record<string, number>>('op.weekly-history', {});
```

- [ ] **Step 3: PASS + suite + check + build; commit**

```bash
git add src/core/calendar.ts src/core/compare.ts src/stores/weekly-history.ts tests/core
git commit -m "feat: calendar grid, compare codes, weekly archive store"
```

---

### Task 3: badges 13-20 (core)

**Files:**
- Modify: `src/core/badges.ts`, `src/i18n/en.ts`, `src/i18n/de.ts`
- Test: `tests/core/badges.test.ts` (extend)

New ids appended: `weekly-first, weekly-3, level-40, tips-10, tips-100, stars-10, rounds-100, career-wirt`. `BadgeContext` gains:

```ts
  weeklyWeeks: number;      // distinct weeks in op.weekly-history AFTER this session's write
  lifetimeTips: number;     // stats.tipsEarnedCents
  lifetimeRounds: number;   // stats.rounds
  threeStarLevels: number;  // count of levels with stars === 3
  titleRank: number;        // 0 aushilfe .. 4 legende
```

Rules: `weekly-first` = mode 'weekly' && finished !== null; `weekly-3` = weeklyWeeks >= 3; `level-40` = level-mode win with level >= 40; `tips-10` = lifetimeTips >= 1000; `tips-100` = >= 10000; `stars-10` = threeStarLevels >= 10; `rounds-100` = lifetimeRounds >= 100; `career-wirt` = titleRank >= 3. All mechanic-style (fire regardless of practice? NO — practice keeps earning only the original mechanic badges; the new eight are progression badges and never fire from practice EXCEPT tips-10/tips-100/rounds-100 which are lifetime counters and DO fire from any mode including practice).

- [ ] **Step 1: extend the test file** — new describe with: each rule's boundary (999/1000 tips etc.), practice-mode matrix (tips-10 fires in practice; weekly-first/level-40/stars-10/career-wirt do not fire from practice — level-40 additionally requires level mode), owned filtering still works across all 20, `BADGE_IDS` length 20 with the original 12 first (assert `BADGE_IDS.slice(0, 12)` equals the old list verbatim). Update existing tests ONLY by adding the new required ctx fields to the `base` fixture (zeros/false) — assertions untouched. Run FAIL.
- [ ] **Step 2: implement** — extend `BadgeContext`, append ids, add the eight rules in `newBadges` (practice guard: `ctx.mode !== 'practice'` on weekly-first/weekly-3/level-40/stars-10/career-wirt; lifetime counters unguarded). i18n EN: 'First weekly done', 'Three weekly weeks', 'Level 40 conquered', 'Ten euros in tips', 'A hundred in tips', 'Ten perfect levels', 'A hundred rounds poured', 'Landlord'. DE: 'Erste Woche geschafft', 'Drei Wochen dabei', 'Level 40 bezwungen', 'Zehn Euro Trinkgeld', 'Hundert Euro Trinkgeld', 'Zehn perfekte Level', 'Hundert Runden gezapft', 'Wirt geworden'.
- [ ] **Step 3: PASS + gates; commit** `feat: eight career badges join the wall`

---

### Task 4: theme, accent, font scale, left-hand — plumbing + controls

**Files:**
- Modify: `src/app.css`, `src/App.svelte`, `src/stores/settings.ts`, `src/routes/Settings.svelte`, `src/lib/PauseOverlay.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`

- [ ] **Step 1: settings fields** — `theme: 'dark' | 'light'` (default 'dark'), `fontScale: number` (default 1), `leftHand: boolean` (default false), `accent: string` (default 'default'). (persisted merge fills legacy saves automatically.)
- [ ] **Step 2: app.css light palette** — append:

```css
:root[data-theme='light'] {
  --wood: #f2e7d0;
  --wood-light: #e0cba6;
  --cream: #3a2c1c;
  --ink: #f7f1e3;
  --accent: #b57614;
  --danger: #a93226;
  --ok: #1e6b3f;
  color-scheme: light;
}
:root[data-accent='copper'] { --accent: #b8622d; }
:root[data-accent='forest'] { --accent: #4a7c59; }
:root[data-theme='light'][data-accent='copper'] { --accent: #9c4f1e; }
:root[data-theme='light'][data-accent='forest'] { --accent: #35603f; }
```

NOTE the light theme SWAPS the roles: `--wood*` become light surfaces, `--cream` becomes dark text — every existing `background: var(--wood)` / `color: var(--cream)` pairing then reads correctly without touching components. `--ink` flips to light so `background: var(--cream); color: var(--ink)` chips (flash, numpad output, key-caps) stay readable (dark chip, light text in light mode — verify visually; if a chip looks wrong, THAT component gets an explicit fix, the variables stay).

- [ ] **Step 3: App effects** — extend the existing `$effect`s:

```ts
  $effect(() => {
    document.documentElement.dataset.theme = $settings.theme ?? 'dark';
    document.documentElement.dataset.accent = $settings.accent ?? 'default';
    document.documentElement.style.fontSize = `${16 * ($settings.fontScale ?? 1)}px`;
  });
```

- [ ] **Step 4: controls** — Settings: light-mode checkbox (`checked = theme === 'light'`, toggling sets 'light'/'dark'), font-size select (1/1.15/1.3 with the spec labels), left-hand checkbox. Pause quick settings: light-mode checkbox only (space). i18n keys: `settings.theme-label` 'Light mode'/'Heller Modus', `settings.font-size` 'Font size'/'Schriftgröße', `settings.font-normal|large|xlarge` 'Normal'/'Large'/'Extra large' — DE 'Normal'/'Groß'/'Sehr groß', `settings.left-hand` 'Left-handed layout'/'Linkshänder-Modus'.
- [ ] **Step 5: gates; commit** `feat: light theme, accent hooks, font scale, left-hand setting`

---

### Task 5: money legibility + left-hand mirroring

**Files:**
- Modify: `src/lib/Money.svelte`, `src/lib/ChangePhase.svelte`, `src/lib/Numpad.svelte`, `src/routes/Game.svelte` (prop pass-through if needed)

- [ ] **Step 1: Money borders by class** — read Money.svelte; add value-class borders: coins (< 500) `border: 2px solid rgb(0 0 0 / 0.35)`; 5€/10€ notes `border: 2px dashed rgb(0 0 0 / 0.35)`; 20€/50€ notes `border: 3px double rgb(0 0 0 / 0.45)` (or closest that renders on the existing chip markup — the DISTINCTION solid/dashed/double must survive, exact colors may adapt to the chip design). Both themes checked.
- [ ] **Step 2: left-hand mirroring** — ChangePhase only: new prop `leftHand: boolean` default false; when set, the `.secondary` row and the `.ask-row` get `flex-direction: row-reverse` (the confirm button stays full-width on top). The Numpad is deliberately NOT mirrored — digit layout is a fixed convention and flipping it would hurt, not help. Game passes `leftHand={$settings.leftHand ?? false}` to ChangePhase.
- [ ] **Step 3: gates; commit** `feat: money value borders and left-handed layout`

---

### Task 6: Bar screen + wallet earn + upgrade effects in play

**Files:**
- Create: `src/routes/Bar.svelte`
- Modify: `src/App.svelte`, `src/routes/Home.svelte`, `src/routes/Game.svelte`, `src/routes/Settings.svelte` (reset), `src/i18n/en.ts`, `src/i18n/de.ts`

- [ ] **Step 1: earn + effects in Game** — imports career store + `boostTip`, `freeFirstHint`, `applyUpgrades`:
  - `newSession()`: in `newSession()` compute `const upgraded = (p: DifficultyParams) => applyUpgrades(p, get(career).upgrades, mode);` and pass `override ? upgraded(override) : mode === 'level' ? upgraded(paramsForLevel(level)) : undefined` as the paramsOverride. (Level mode previously passed undefined — the explicit upgraded params are equivalent for vanilla players since createSession derives the same.) Scope note: rush re-derives params every tick via `paramsForRush`, so coffee-machine applies to level and practice only — the Bar copy says exactly that.
  - Tip earn block: `const tip = boostTip(tipFor(groupTotal), get(career).upgrades, mode); ... career.update((c) => ({ ...c, walletCents: c.walletCents + tip }));` alongside the existing stats/history accumulation (tipJar and tipsEarnedSession use the boosted value).
  - `onTipp()`: first hint per session free with cheat-sheet: add `let hintsUsedSession = 0;` (reset in restart); in onTipp, `const free = hintsUsedSession === 0 && freeFirstHint(get(career).upgrades, mode); hintsUsedSession += 1;` — when free, neither jar deduction nor debt (skip both), and the tippHint label logic is untouched (acceptable).
- [ ] **Step 2: Bar.svelte** — route 'bar'; header back button; wallet balance big (`formatEuro`); upgrade cards from UPGRADES: name+description (i18n `bar.<id>.name` / `bar.<id>.desc`), cost, states owned/affordable/locked; buy: `career.update` subtract cost + push id (guard double-buy + insufficient). Cosmetics owned → accent radio (default/copper/forest) writing `settings.accent`. Note under gameplay upgrades: `bar.ranked-note` ('Not active in daily & weekly' / 'In Tages- & Wochen-Challenge nicht aktiv'). Style: card list like Stats badges, keynav on main.
- [ ] **Step 3: wiring** — App route branch; Home minor row 5th button `bar.title` ('Bar' both languages — row grid `repeat(4, 1fr)` stays, 5th wraps; verify it looks sane, else switch the row to `repeat(auto-fit, minmax(72px, 1fr))`). Settings resetAll adds `career.set({ walletCents: 0, upgrades: [] });` and `settings.update` accent → 'default'. i18n: `bar.title` 'Bar', `bar.wallet` 'Tip wallet'/'Trinkgeld-Kasse', `bar.buy` 'Buy'/'Kaufen', `bar.owned` 'Owned'/'Gekauft', per-upgrade names/descs EN+DE (jar-xl 'XL tip jar'/'XL-Trinkgeldglas' — '+10% tips'/'+10% Trinkgeld'; coffee-machine 'Coffee machine'/'Kaffeemaschine' — 'Guests wait a second longer (levels & practice)'/'Gäste warten eine Sekunde länger (Level & Training)'; cheat-sheet 'Cheat sheet'/'Spickzettel' — 'First hint per shift is free'/'Erster Tipp pro Schicht ist gratis'; accent-copper 'Copper counter'/'Kupfertheke' — 'Copper accent color'/'Kupfer-Akzentfarbe'; accent-forest 'Forest counter'/'Waldtheke' — 'Green accent color'/'Grüne Akzentfarbe'), `bar.accent` 'Accent color'/'Akzentfarbe', `bar.accent-default` 'Amber (default)'/'Bernstein (Standard)'.
- [ ] **Step 4: gates; commit** `feat: the bar — spend tips on upgrades and looks`

---

### Task 7: titles on Home/Stats + badge wiring + weekly archive write

**Files:**
- Modify: `src/routes/Home.svelte`, `src/routes/Stats.svelte`, `src/routes/Game.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`

- [ ] **Step 1: title display** — pure inputs from progress store: `totalStars = sum of $progress.stars values`, `maxLevelWon = max key of $progress.stars` (0 when empty). Home: `<p class="career">{$t(\`career.${title}\`)}</p>` under the h1 (accent, small). Stats: same line in the dl grid as a card. i18n `career.aushilfe|barkeeper|schichtleiter|wirt|legende` EN 'Trainee|Bartender|Shift Lead|Landlord|Bar Legend' DE 'Aushilfe|Barkeeper|Schichtleiter|Wirt|Bar-Legende'.
- [ ] **Step 2: weekly archive write** — Game `finalize()`, weekly block: alongside `weekly.update(...)` add `weeklyHistory.update((h) => ({ ...h, [weekKey(new Date())]: Math.max(h[weekKey(new Date())] ?? 0, session.score) }));` (import store + weekKey).
- [ ] **Step 3: badge ctx wiring** — `finalize()` newBadges call gains the five new fields: `weeklyWeeks: Object.keys(get(weeklyHistory)).length`, `lifetimeTips: get(stats).tipsEarnedCents ?? 0`, `lifetimeRounds: get(stats).rounds`, `threeStarLevels: Object.values(get(progress).stars).filter((s) => s === 3).length`, `titleRank: ['aushilfe','barkeeper','schichtleiter','wirt','legende'].indexOf(careerTitle(totalStars, maxLevelWon))` (compute the two inputs from get(progress) in place). ORDER: the weekly-archive update (step 2) must run BEFORE newBadges so weekly-3 sees the fresh week (place accordingly).
- [ ] **Step 4: gates; commit** `feat: career titles shown and badges see the whole career`

---

### Task 8: calendar + weekly archive list + compare UI

**Files:**
- Modify: `src/routes/Stats.svelte`, `src/lib/EndOverlay.svelte` OR Game share flow, `src/i18n/en.ts`, `src/i18n/de.ts`

- [ ] **Step 1: calendar on Stats** — state `viewYear/viewMonth` (init today), `monthGrid` render: month header with ‹ › buttons, weekday row (Mo..So / Mo..Su via i18n `cal.days` single string 'Mon,Tue,…'/'Mo,Di,…' split on comma), day cells: class by `$history[key]` (played → accent intensity: rounds ≥ 10 strong, ≥1 soft), daily-record dot when `$stats.days[key]` exists (that store field tracks played days — verify field shape; if unsuitable use history presence only and drop the dot), click sets `selectedDay` → detail line (rounds, accuracy %, tips via formatEuro). i18n `cal.title` 'Calendar'/'Kalender'.
- [ ] **Step 2: weekly archive list** — under the calendar: `weeklyHistory` entries sorted desc by week key, max 12, `week — score` rows, current week accent. Title `weekly.archive` 'Weekly results'/'Wochen-Ergebnisse'.
- [ ] **Step 3: compare** — weekly END overlay: when mode weekly, under the share button show the code (`encodeResult({ week: weekKey(new Date()), score: session.score })`) in a copyable line (click copies via clipboard, same pattern as share). Stats archive section gains an input + button (`compare.paste` 'Paste code'/'Code einfügen', `compare.go` 'Compare'/'Vergleichen'): decode → null → `compare.invalid` 'Invalid code'/'Ungültiger Code'; else look up own `weeklyHistory[week]` → missing → `compare.no-own` "You haven't played week {week}"/'Du hast Woche {week} nicht gespielt'; else verdict line `compare.result` 'You {mine} · Friend {theirs}'/'Du {mine} · Freund {theirs}' + win/lose/tie suffix (`compare.win` '— you win! 🏆'/'— du gewinnst! 🏆', `compare.lose` '— they win'/'— Freund gewinnt', `compare.tie` '— tie'/'— unentschieden').
- [ ] **Step 4: gates; commit** `feat: calendar, weekly archive and friend compare codes`

---

### Task 9: ledger cleanup batch

**Files:**
- Create: `src/lib/GameToasts.svelte`
- Modify: `src/routes/Stats.svelte`, `src/routes/Settings.svelte`, `src/routes/Game.svelte`, `src/lib/EndOverlay.svelte`

- [ ] **Step 1:** Stats chart dot guard: the dot inside the days each-block renders only when `entry.rounds > 0` (same as the line guard).
- [ ] **Step 2:** Settings: delete the dead volume normalizer line (persisted merge fills defaults).
- [ ] **Step 3:** Game `finishRound()`: add `errorFlash = null; errT.clear();` next to the other timer clears.
- [ ] **Step 4:** EndOverlay: wrap the overlay content (everything except `.shower`) in `<div class="panel">` with `.panel { margin: auto 0; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; text-align: center; }` and remove `justify-content: center; justify-content: safe center;` from `.overlay` (margin-auto centering works in ALL browsers and scrolls correctly when tall — this replaces the safe-center dance).
- [ ] **Step 5:** GameToasts extraction: presentational component with props `{ flash, errorFlash, badgeToast }` rendering the three `{#if}` divs with the existing classes/styles moved over; Game renders `<GameToasts {flash} {errorFlash} {badgeToast} />` in the same DOM position (flash before EndOverlay, badgeToast after — CHECK the current DOM order and preserve it exactly: flash sits before EndOverlay, badge-toast after EndOverlay. If a single component cannot preserve that split ordering, extract ONLY flash+errorFlash into GameToasts and leave badge-toast in place — DOM order beats consolidation).
- [ ] **Step 6:** gates + report Game.svelte line count; commit `chore: ledger cleanup — guards, dead code, overlay centering, toast extraction`

---

### Task 10: component tests

**Files:**
- Modify: `package.json` (dev-deps), `vite.config.ts` (test env config)
- Create: `tests/components/numpad.test.ts`, `tests/components/change-phase.test.ts`, `tests/components/sum-phase.test.ts`, `tests/components/round-details.test.ts`

- [ ] **Step 1: infra** — `npm i -D @testing-library/svelte jsdom`. vite.config.ts test block gains:

```ts
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    environmentMatchGlobs: [['tests/components/**', 'jsdom']],
  },
```

(If `environmentMatchGlobs` is removed in the installed vitest major, use `projects`/workspace config equivalent — check the installed version's API and use the supported mechanism; the requirement is: components/jsdom, everything else node. Svelte 5 component testing needs the browser-conditions resolve — add `resolve: { conditions: ['browser'] }` scoped to test if mount errors demand it.)
- [ ] **Step 2: tests** — using `render` from @testing-library/svelte + `fireEvent`:
  - Numpad: tap 4,5,comma,5 → display '45,5…' formatted; OK calls onsubmit with 4550; C clears display to 0,00.
  - SumPhase: `locked: true` renders the tab-wait prompt and no numpad; `locked: false` + tipp click fires ontipp.
  - ChangePhase: confirm click fires onconfirm; ask click fires ontoggleask; `askOpen: true` renders 5 ask buttons and clicking the first fires onask(200); `typedDisplay: '2,00 €'` renders the chip; `showExtras: false` hides not-enough/tipp.
  - RoundDetails: log of 3 entries (2 success incl 1 perfect, 1 fail) → summary '✓ 2/3', verdict text = the 'good' verdict (2/3 ≈ 0.667, ≥ 0.6), ⭐ present exactly once, the failed row's error text rendered.
  Each test file self-contained; craft minimal props; no store mocking needed (components are presentational).
- [ ] **Step 3: full suite green** (node + jsdom both), check 0/0, build clean; commit `test: component coverage for the play surfaces`

---

### Task 11: CI smoke + final verification + version

**Files:**
- Create: `tests-e2e/smoke.spec.ts`, `playwright.config.ts`
- Modify: `.github/workflows/deploy.yml`, `package.json`

- [ ] **Step 1: Playwright** — `npm i -D @playwright/test`. playwright.config.ts: testDir 'tests-e2e', single chromium project, `webServer: { command: 'npm run preview', port: 4173, reuseExistingServer: true }` with a prior build (script `e2e`: `npm run build && playwright test`). smoke.spec.ts: goto '/', expect title 'Orders, Please', play button visible; goto '/#/tutorial', coach text visible (`.coach` non-empty). Keep vitest's `include` from picking up tests-e2e (path outside tests/ — verify).
- [ ] **Step 2: CI job** — deploy.yml gains `smoke` job (needs: test, runs on push+PR): checkout/setup-node v5, npm ci, `npx playwright install --with-deps chromium`, `npm run e2e`. Deploy job unchanged (still needs: test only — smoke failures block nothing but visibility? NO: make deploy `needs: [test, smoke]` so a broken boot never ships).
- [ ] **Step 3: final gates** — vitest all green; check 0/0; both builds; `npm run e2e` locally green; grep sweeps (z-index absent, i18n parity via the python key-set check, no new session.rng).
- [ ] **Step 4: version** — package.json 1.8.0 + lockfile; commit `chore: bump version to 1.8.0`

---

## Verification checklist (whole plan)

- All gates green incl. e2e; CI smoke passes on the PR/branch push.
- Manual: buy jar-xl → tips visibly +10% in a level, wallet drops; daily/weekly unaffected; light mode readable everywhere incl. money chips, flash, numpad; font 130% doesn't break the till grid; left-hand mirrors the action row + numpad; calendar shows the current month with played days; weekly code round-trips between two browser profiles; badge wall shows 20 tiles.
