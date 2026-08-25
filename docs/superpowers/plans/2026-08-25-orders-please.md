# Orders, Please — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "Orders, Please" — a PWA bar mental-math game (sum orders, give change from a finite till) per the approved spec at `docs/superpowers/specs/2026-08-25-orders-please-design.md`.

**Architecture:** Pure-TypeScript game core in `src/core/` (money, till, change solver, order generator, round + session state machines — all headless, Vitest-tested), thin Svelte 5 rendering layer in `src/lib/` + `src/routes/`, localStorage persistence, hash-based routing, `vite-plugin-pwa` for offline/install.

**Tech Stack:** Svelte 5 (runes), Vite, TypeScript, Vitest, vite-plugin-pwa. No other runtime dependencies.

## Global Constraints

- Money is **integer cents everywhere**. Floats never touch money values.
- Display format: `4,50 €` (comma decimal, symbol after; symbol-first variant via settings).
- `src/core/` files must not import Svelte or touch DOM. All core behavior unit-tested.
- Languages: English + German. All UI strings through the i18n `t()` helper; core returns locale-parameterized text only via `text-order.ts`.
- Denominations (cents): notes 5000, 2000, 1000, 500; coins 200, 100, 50, 20, 10, 5. No 1c/2c coins (bar rounding reality) — all prices are multiples of 5 cents.
- Persistence: localStorage only, JSON envelope `{ v: 1, data }`.
- Touch targets ≥ 48px. Portrait-first layout.
- Test runner: `npx vitest run <file>`. Dev server: `npm run dev`.
- Every commit message ends with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01BFFLt2muz8HfETCzn4N1ok`

---

### Task 1: Project scaffold

**Files:**
- Create: Vite Svelte-TS scaffold at repo root, `vite.config.ts`, `src/app.css`
- Test: none (scaffold verified by build + test-runner smoke)

**Interfaces:**
- Produces: working `npm run dev`, `npm run build`, `npx vitest run`; alias `$core` → `src/core`, `$lib` → `src/lib`.

- [ ] **Step 1: Scaffold Vite + Svelte 5 + TS in current directory**

```bash
cd /home/ben/repo/ordersplease
npm create vite@latest . -- --template svelte-ts
npm install
npm install -D vitest vite-plugin-pwa
```

If `npm create vite` refuses a non-empty directory, answer "Ignore files and continue" (existing content is only `docs/` and `.git`).

- [ ] **Step 2: Configure vite + vitest + aliases**

Replace `vite.config.ts` with:

```ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Orders, Please',
        short_name: 'Orders',
        description: 'Bar mental-math trainer: sum orders, give change.',
        theme_color: '#2b1d12',
        background_color: '#2b1d12',
        display: 'standalone',
        orientation: 'portrait',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  resolve: {
    alias: {
      $core: path.resolve(__dirname, 'src/core'),
      $lib: path.resolve(__dirname, 'src/lib'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

Add to `tsconfig.json` `compilerOptions`:

```json
"paths": { "$core/*": ["./src/core/*"], "$lib/*": ["./src/lib/*"] }
```

Add scripts to `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Strip demo content, add base styles**

Delete `src/lib/Counter.svelte`, `src/assets/svelte.svg`, `public/vite.svg`. Replace `src/App.svelte` with:

```svelte
<main>
  <h1>Orders, Please</h1>
</main>
```

Replace `src/app.css` with:

```css
:root {
  --wood: #2b1d12;
  --wood-light: #4a3320;
  --cream: #f5ecd7;
  --ink: #2a2118;
  --accent: #d99a2b;
  --danger: #c0392b;
  --ok: #2e7d4f;
  --radius: 12px;
  font-family: system-ui, sans-serif;
  color-scheme: dark;
}
* { box-sizing: border-box; margin: 0; }
html, body { height: 100%; }
body {
  background: var(--wood);
  color: var(--cream);
  overscroll-behavior: none;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
button {
  font: inherit;
  min-width: 48px;
  min-height: 48px;
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
}
```

Create `public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#2b1d12"/>
  <circle cx="256" cy="256" r="150" fill="#d99a2b"/>
  <text x="256" y="300" font-size="140" text-anchor="middle" fill="#2b1d12" font-family="serif">€</text>
</svg>
```

- [ ] **Step 4: Verify build + test runner**

Run: `npm run build`
Expected: build succeeds, `dist/` produced.

Run: `npx vitest run`
Expected: "No test files found" (exit ok with `--passWithNoTests`? No — just confirm the runner starts; the message is acceptable at this stage).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Svelte 5 + Vite + TS PWA project"
```

---

### Task 2: core/money

**Files:**
- Create: `src/core/money.ts`
- Test: `tests/core/money.test.ts`

**Interfaces:**
- Produces: `type Cents = number`; `formatEuro(cents: Cents, symbolFirst?: boolean): string`.

- [ ] **Step 1: Write failing tests**

```ts
// tests/core/money.test.ts
import { describe, it, expect } from 'vitest';
import { formatEuro } from '$core/money';

describe('formatEuro', () => {
  it('formats euros and cents with comma', () => {
    expect(formatEuro(450)).toBe('4,50 €');
  });
  it('pads cents', () => {
    expect(formatEuro(1005)).toBe('10,05 €');
  });
  it('formats zero', () => {
    expect(formatEuro(0)).toBe('0,00 €');
  });
  it('formats negative', () => {
    expect(formatEuro(-125)).toBe('-1,25 €');
  });
  it('symbol-first variant', () => {
    expect(formatEuro(450, true)).toBe('€ 4,50');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/money.test.ts`
Expected: FAIL — cannot resolve `$core/money`.

- [ ] **Step 3: Implement**

```ts
// src/core/money.ts
export type Cents = number;

export function formatEuro(cents: Cents, symbolFirst = false): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const num = `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
  return symbolFirst ? `€ ${num}` : `${num} €`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/money.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/money.ts tests/core/money.test.ts
git commit -m "feat: money formatting in integer cents"
```

---

### Task 3: core/menu

**Files:**
- Create: `src/core/menu.ts`
- Test: `tests/core/menu.test.ts`

**Interfaces:**
- Consumes: `Cents` from `$core/money`.
- Produces: `interface MenuItem { id: string; name: string; priceCents: Cents }`; `DEFAULT_MENU: MenuItem[]`; `validateItem(name: string, priceCents: number): string | null` (null = valid, else error key); `applyPriceStyle(menu: MenuItem[], style: PriceStyle): MenuItem[]` where `type PriceStyle = 'round' | 'half' | 'tens' | 'any'`.

- [ ] **Step 1: Write failing tests**

```ts
// tests/core/menu.test.ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_MENU, validateItem, applyPriceStyle } from '$core/menu';

describe('menu', () => {
  it('default menu has the spec drinks', () => {
    const byId = Object.fromEntries(DEFAULT_MENU.map((m) => [m.id, m.priceCents]));
    expect(byId['beer']).toBe(400);
    expect(byId['veneziano']).toBe(500);
    expect(byId['water']).toBe(250);
    expect(DEFAULT_MENU.length).toBeGreaterThanOrEqual(6);
  });
  it('all default prices are multiples of 5 cents', () => {
    for (const m of DEFAULT_MENU) expect(m.priceCents % 5).toBe(0);
  });
  it('validates name and price', () => {
    expect(validateItem('Beer', 400)).toBeNull();
    expect(validateItem('', 400)).toBe('error.name-empty');
    expect(validateItem('Beer', 0)).toBe('error.price-invalid');
    expect(validateItem('Beer', 401)).toBe('error.price-invalid'); // not multiple of 5
  });
  it('applyPriceStyle rounds to style step', () => {
    const menu = [{ id: 'x', name: 'X', priceCents: 430 }];
    expect(applyPriceStyle(menu, 'round')[0].priceCents).toBe(400);
    expect(applyPriceStyle(menu, 'half')[0].priceCents).toBe(450);
    expect(applyPriceStyle(menu, 'tens')[0].priceCents).toBe(430);
    expect(applyPriceStyle(menu, 'any')[0].priceCents).toBe(430);
  });
  it('applyPriceStyle never returns zero price', () => {
    const menu = [{ id: 'x', name: 'X', priceCents: 40 }];
    expect(applyPriceStyle(menu, 'round')[0].priceCents).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/menu.test.ts`
Expected: FAIL — cannot resolve `$core/menu`.

- [ ] **Step 3: Implement**

```ts
// src/core/menu.ts
import type { Cents } from './money';

export interface MenuItem {
  id: string;
  name: string;
  priceCents: Cents;
}

export type PriceStyle = 'round' | 'half' | 'tens' | 'any';

export const DEFAULT_MENU: MenuItem[] = [
  { id: 'beer', name: 'Beer', priceCents: 400 },
  { id: 'veneziano', name: 'Veneziano', priceCents: 500 },
  { id: 'water', name: 'Water', priceCents: 250 },
  { id: 'cola', name: 'Cola', priceCents: 300 },
  { id: 'wine', name: 'Wine', priceCents: 450 },
  { id: 'coffee', name: 'Coffee', priceCents: 200 },
];

export function validateItem(name: string, priceCents: number): string | null {
  if (name.trim() === '') return 'error.name-empty';
  if (!Number.isInteger(priceCents) || priceCents <= 0 || priceCents % 5 !== 0)
    return 'error.price-invalid';
  return null;
}

const STEP: Record<PriceStyle, number> = { round: 100, half: 50, tens: 10, any: 5 };

/** Round menu prices to the difficulty's step. Used with the default menu only;
 *  custom menus keep real prices (priceStyle ignored by callers). */
export function applyPriceStyle(menu: MenuItem[], style: PriceStyle): MenuItem[] {
  const step = STEP[style];
  return menu.map((m) => ({
    ...m,
    priceCents: Math.max(step, Math.round(m.priceCents / step) * step),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/menu.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/menu.ts tests/core/menu.test.ts
git commit -m "feat: menu model, default menu, price-style rounding"
```

---

### Task 4: core/till

**Files:**
- Create: `src/core/till.ts`
- Test: `tests/core/till.test.ts`

**Interfaces:**
- Produces: `DENOMS: readonly number[]` (descending: 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5); `COIN_DENOMS` (200..5); `type Denom = number`; `type Till = Record<number, number>`; `fullTill(): Till`; `scarceTill(rng: () => number, lowDenomCount: number): Till`; `tillTotal(till: Till): number`; `removeFromTill(till: Till, pieces: Denom[]): Till` (throws `Error('insufficient')` if not available); `addToTill(till: Till, pieces: Denom[]): Till`; `hasPieces(till: Till, pieces: Denom[]): boolean`.

- [ ] **Step 1: Write failing tests**

```ts
// tests/core/till.test.ts
import { describe, it, expect } from 'vitest';
import {
  DENOMS, COIN_DENOMS, fullTill, scarceTill, tillTotal,
  removeFromTill, addToTill, hasPieces,
} from '$core/till';

describe('till', () => {
  it('denominations are descending and complete', () => {
    expect([...DENOMS]).toEqual([5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5]);
    expect([...COIN_DENOMS]).toEqual([200, 100, 50, 20, 10, 5]);
  });
  it('fullTill has stock of every denom', () => {
    const t = fullTill();
    for (const d of DENOMS) expect(t[d]).toBeGreaterThan(0);
  });
  it('tillTotal sums denom * count', () => {
    expect(tillTotal({ 200: 2, 5: 3 })).toBe(415);
  });
  it('remove and add are immutable and consistent', () => {
    const t = fullTill();
    const t2 = removeFromTill(t, [200, 200, 5]);
    expect(t2[200]).toBe(t[200] - 2);
    expect(t2[5]).toBe(t[5] - 1);
    expect(t[200]).not.toBe(t2[200]); // original untouched
    const t3 = addToTill(t2, [200, 200, 5]);
    expect(t3).toEqual(t);
  });
  it('remove throws when insufficient', () => {
    expect(() => removeFromTill({ 100: 1 }, [100, 100])).toThrow('insufficient');
  });
  it('hasPieces checks availability without mutating', () => {
    expect(hasPieces({ 100: 1, 50: 2 }, [100, 50])).toBe(true);
    expect(hasPieces({ 100: 1 }, [100, 100])).toBe(false);
  });
  it('scarceTill zeroes/lowers exactly N coin denoms, never notes', () => {
    let seed = 0;
    const rng = () => ((seed = (seed * 9301 + 49297) % 233280), seed / 233280);
    const t = scarceTill(rng, 2);
    const low = COIN_DENOMS.filter((d) => t[d] <= 1);
    expect(low.length).toBe(2);
    expect(t[5000]).toBeGreaterThan(0);
    expect(t[500]).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/till.test.ts`
Expected: FAIL — cannot resolve `$core/till`.

- [ ] **Step 3: Implement**

```ts
// src/core/till.ts
export const DENOMS = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5] as const;
export const NOTE_DENOMS = [5000, 2000, 1000, 500] as const;
export const COIN_DENOMS = [200, 100, 50, 20, 10, 5] as const;
export type Denom = number;
export type Till = Record<number, number>;

const FULL_NOTE_COUNT = 5;
const FULL_COIN_COUNT = 10;

export function fullTill(): Till {
  const t: Till = {};
  for (const d of NOTE_DENOMS) t[d] = FULL_NOTE_COUNT;
  for (const d of COIN_DENOMS) t[d] = FULL_COIN_COUNT;
  return t;
}

/** Full till with `lowDenomCount` random coin denominations at 0 or 1 pieces. */
export function scarceTill(rng: () => number, lowDenomCount: number): Till {
  const t = fullTill();
  const coins = [...COIN_DENOMS];
  for (let i = 0; i < Math.min(lowDenomCount, coins.length); i++) {
    const idx = Math.floor(rng() * coins.length);
    const d = coins.splice(idx, 1)[0];
    t[d] = Math.floor(rng() * 2); // 0 or 1
  }
  return t;
}

export function tillTotal(till: Till): number {
  return Object.entries(till).reduce((sum, [d, n]) => sum + Number(d) * n, 0);
}

export function hasPieces(till: Till, pieces: Denom[]): boolean {
  const need: Till = {};
  for (const p of pieces) need[p] = (need[p] ?? 0) + 1;
  return Object.entries(need).every(([d, n]) => (till[Number(d)] ?? 0) >= n);
}

export function removeFromTill(till: Till, pieces: Denom[]): Till {
  if (!hasPieces(till, pieces)) throw new Error('insufficient');
  const t = { ...till };
  for (const p of pieces) t[p] -= 1;
  return t;
}

export function addToTill(till: Till, pieces: Denom[]): Till {
  const t = { ...till };
  for (const p of pieces) t[p] = (t[p] ?? 0) + 1;
  return t;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/till.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/till.ts tests/core/till.test.ts
git commit -m "feat: till model with finite denomination counts"
```

---

### Task 5: core/change — solver + ask options

**Files:**
- Create: `src/core/change.ts`
- Test: `tests/core/change.test.ts`

**Interfaces:**
- Consumes: `Till`, `Denom`, `DENOMS`, `COIN_DENOMS` from `$core/till`.
- Produces: `makeChange(till: Till, amount: number): Denom[] | null` (fewest pieces, descending order, respects counts; `[]` for amount 0; null if impossible); `canMakeChange(till: Till, amount: number): boolean`; `askOptions(till: Till, changeDue: number): Denom[]` — coin denominations `d` the player may ask the customer for, valid when change for `changeDue` is impossible but `changeDue + d` is makeable.

- [ ] **Step 1: Write failing tests**

```ts
// tests/core/change.test.ts
import { describe, it, expect } from 'vitest';
import { makeChange, canMakeChange, askOptions } from '$core/change';
import { fullTill } from '$core/till';

describe('makeChange', () => {
  it('returns [] for zero', () => {
    expect(makeChange(fullTill(), 0)).toEqual([]);
  });
  it('uses fewest pieces', () => {
    expect(makeChange(fullTill(), 380)).toEqual([200, 100, 50, 20, 10]);
    expect(makeChange(fullTill(), 1500)).toEqual([1000, 500]);
  });
  it('works around missing denominations (non-greedy)', () => {
    // no 1€ coins: 300 = 200 + 50 + 50 must be found
    const till = { 200: 1, 100: 0, 50: 3 };
    expect(makeChange(till, 300)).toEqual([200, 50, 50]);
  });
  it('respects counts', () => {
    expect(makeChange({ 100: 1 }, 200)).toBeNull();
    expect(makeChange({ 100: 2 }, 200)).toEqual([100, 100]);
  });
  it('returns null when impossible', () => {
    expect(makeChange({ 200: 5 }, 150)).toBeNull();
    expect(canMakeChange({ 200: 5 }, 150)).toBe(false);
  });
});

describe('askOptions', () => {
  it('empty when change already makeable', () => {
    expect(askOptions(fullTill(), 100)).toEqual([]);
  });
  it('finds the coin that unlocks change', () => {
    // due 1,00 change, till only has 2€ coins: ask for 1,00 → give 2,00
    const till = { 200: 5 };
    expect(askOptions(till, 100)).toEqual([100]);
  });
  it('lists all unlocking coins ascending', () => {
    // change due 150; till has only 2€: +50c → 200 ✓
    const till = { 200: 5 };
    expect(askOptions(till, 150)).toEqual([50]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/change.test.ts`
Expected: FAIL — cannot resolve `$core/change`.

- [ ] **Step 3: Implement**

Bounded min-coin DP over amount; backtrack for pieces.

```ts
// src/core/change.ts
import { COIN_DENOMS, DENOMS, type Denom, type Till } from './till';

/** Fewest-piece change for `amount` from available till counts.
 *  DP over cents (amounts are small: change rarely exceeds ~50€). */
export function makeChange(till: Till, amount: number): Denom[] | null {
  if (amount === 0) return [];
  if (amount < 0) return null;
  const INF = Number.POSITIVE_INFINITY;
  // best[a] = fewest pieces to make a; from[a] = denom used to reach a
  const best = new Array<number>(amount + 1).fill(INF);
  best[0] = 0;
  const from = new Array<number>(amount + 1).fill(0);
  // bounded knapsack: iterate denoms, expand each count as repeated single items
  // (counts are small — ≤10 per denom — so this stays tiny)
  for (const d of DENOMS) {
    const count = till[d] ?? 0;
    for (let c = 0; c < count; c++) {
      // one extra piece of d: relax amounts descending so each piece used once
      for (let a = amount; a >= d; a--) {
        if (best[a - d] + 1 < best[a]) {
          best[a] = best[a - d] + 1;
          from[a] = d;
        }
      }
    }
  }
  if (best[amount] === INF) return null;
  const pieces: Denom[] = [];
  for (let a = amount; a > 0; a -= from[a]) pieces.push(from[a]);
  return pieces.sort((x, y) => y - x);
}

export function canMakeChange(till: Till, amount: number): boolean {
  return makeChange(till, amount) !== null;
}

/** Coins the player may ask the customer for when exact change is impossible:
 *  each returned d makes changeDue + d makeable. Ascending, smallest ask first. */
export function askOptions(till: Till, changeDue: number): Denom[] {
  if (canMakeChange(till, changeDue)) return [];
  return [...COIN_DENOMS]
    .filter((d) => canMakeChange(till, changeDue + d))
    .sort((a, b) => a - b);
}
```

Note the DP piece-loop relaxes descending per piece — that is what makes counts bounded correctly; do not "optimize" it into the unbounded ascending form.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/change.test.ts`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/change.ts tests/core/change.test.ts
git commit -m "feat: change solver with bounded counts and ask-customer options"
```

---

### Task 6: core/difficulty

**Files:**
- Create: `src/core/difficulty.ts`
- Test: `tests/core/difficulty.test.ts`

**Interfaces:**
- Consumes: `PriceStyle` from `$core/menu`.
- Produces:

```ts
export type PaymentStyle = 'exact-or-round' | 'round' | 'awkward';
export interface DifficultyParams {
  itemsMin: number;
  itemsMax: number;
  priceStyle: PriceStyle;
  paymentStyle: PaymentStyle;
  patienceSeconds: number;
  menuVisibleSeconds: number | null; // null = always visible, 0 = never
  scarceDenoms: number;              // coin denoms running low
  midOrderChangeProb: number;        // 0..1
  showPileTotal: boolean;
  ordersPerLevel: number;
}
export const MAX_LEVEL = 30;
export function paramsForLevel(level: number): DifficultyParams;
export function paramsForRush(elapsedSeconds: number): DifficultyParams; // 30s of rush ≈ 1 level, capped at MAX_LEVEL curve
```

- [ ] **Step 1: Write failing tests**

```ts
// tests/core/difficulty.test.ts
import { describe, it, expect } from 'vitest';
import { paramsForLevel, paramsForRush, MAX_LEVEL } from '$core/difficulty';

describe('difficulty', () => {
  it('level 1 matches spec anchors', () => {
    const p = paramsForLevel(1);
    expect(p.itemsMin).toBe(1);
    expect(p.itemsMax).toBe(1);
    expect(p.priceStyle).toBe('round');
    expect(p.paymentStyle).toBe('exact-or-round');
    expect(p.patienceSeconds).toBe(45);
    expect(p.menuVisibleSeconds).toBeNull();
    expect(p.scarceDenoms).toBe(0);
    expect(p.midOrderChangeProb).toBe(0);
    expect(p.showPileTotal).toBe(true);
  });
  it('level 30 matches spec anchors', () => {
    const p = paramsForLevel(MAX_LEVEL);
    expect(p.itemsMax).toBe(6);
    expect(p.priceStyle).toBe('any');
    expect(p.paymentStyle).toBe('awkward');
    expect(p.patienceSeconds).toBe(15);
    expect(p.menuVisibleSeconds).toBe(0);
    expect(p.midOrderChangeProb).toBeCloseTo(0.35);
    expect(p.showPileTotal).toBe(false);
  });
  it('difficulty is monotone: patience never increases with level', () => {
    for (let l = 2; l <= MAX_LEVEL; l++) {
      expect(paramsForLevel(l).patienceSeconds).toBeLessThanOrEqual(
        paramsForLevel(l - 1).patienceSeconds,
      );
    }
  });
  it('rush interpolates over time and caps', () => {
    expect(paramsForRush(0)).toEqual(paramsForLevel(1));
    expect(paramsForRush(10_000)).toEqual(paramsForLevel(MAX_LEVEL));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/difficulty.test.ts`
Expected: FAIL — cannot resolve `$core/difficulty`.

- [ ] **Step 3: Implement**

Anchor rows at levels 1, 10, 20, 30 from the spec table; numeric fields linearly interpolated, enum/step fields switch at the anchor.

```ts
// src/core/difficulty.ts
import type { PriceStyle } from './menu';

export type PaymentStyle = 'exact-or-round' | 'round' | 'awkward';

export interface DifficultyParams {
  itemsMin: number;
  itemsMax: number;
  priceStyle: PriceStyle;
  paymentStyle: PaymentStyle;
  patienceSeconds: number;
  menuVisibleSeconds: number | null;
  scarceDenoms: number;
  midOrderChangeProb: number;
  showPileTotal: boolean;
  ordersPerLevel: number;
}

export const MAX_LEVEL = 30;

interface Anchor extends DifficultyParams { level: number; }

const ANCHORS: Anchor[] = [
  { level: 1,  itemsMin: 1, itemsMax: 1, priceStyle: 'round', paymentStyle: 'exact-or-round',
    patienceSeconds: 45, menuVisibleSeconds: null, scarceDenoms: 0, midOrderChangeProb: 0,
    showPileTotal: true,  ordersPerLevel: 8 },
  { level: 10, itemsMin: 2, itemsMax: 3, priceStyle: 'half',  paymentStyle: 'round',
    patienceSeconds: 30, menuVisibleSeconds: 5,    scarceDenoms: 1, midOrderChangeProb: 0,
    showPileTotal: true,  ordersPerLevel: 10 },
  { level: 20, itemsMin: 3, itemsMax: 5, priceStyle: 'tens',  paymentStyle: 'awkward',
    patienceSeconds: 20, menuVisibleSeconds: 3,    scarceDenoms: 2, midOrderChangeProb: 0.2,
    showPileTotal: false, ordersPerLevel: 12 },
  { level: 30, itemsMin: 4, itemsMax: 6, priceStyle: 'any',   paymentStyle: 'awkward',
    patienceSeconds: 15, menuVisibleSeconds: 0,    scarceDenoms: 3, midOrderChangeProb: 0.35,
    showPileTotal: false, ordersPerLevel: 12 },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function paramsForLevel(level: number): DifficultyParams {
  const l = Math.min(Math.max(level, 1), MAX_LEVEL);
  let lo = ANCHORS[0];
  let hi = ANCHORS[ANCHORS.length - 1];
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    if (l >= ANCHORS[i].level && l <= ANCHORS[i + 1].level) {
      lo = ANCHORS[i];
      hi = ANCHORS[i + 1];
      break;
    }
  }
  const t = hi.level === lo.level ? 0 : (l - lo.level) / (hi.level - lo.level);
  // enum/step fields switch when we pass the halfway point to the next anchor
  const stepSrc = t < 0.5 ? lo : hi;
  return {
    itemsMin: Math.round(lerp(lo.itemsMin, hi.itemsMin, t)),
    itemsMax: Math.round(lerp(lo.itemsMax, hi.itemsMax, t)),
    priceStyle: stepSrc.priceStyle,
    paymentStyle: stepSrc.paymentStyle,
    patienceSeconds: Math.round(lerp(lo.patienceSeconds, hi.patienceSeconds, t)),
    menuVisibleSeconds:
      lo.menuVisibleSeconds === null && t === 0
        ? null
        : stepSrc.menuVisibleSeconds,
    scarceDenoms: Math.round(lerp(lo.scarceDenoms, hi.scarceDenoms, t)),
    midOrderChangeProb: lerp(lo.midOrderChangeProb, hi.midOrderChangeProb, t),
    showPileTotal: stepSrc.showPileTotal,
    ordersPerLevel: Math.round(lerp(lo.ordersPerLevel, hi.ordersPerLevel, t)),
  };
}

const RUSH_SECONDS_PER_LEVEL = 30;

export function paramsForRush(elapsedSeconds: number): DifficultyParams {
  const virtualLevel = 1 + elapsedSeconds / RUSH_SECONDS_PER_LEVEL;
  return paramsForLevel(Math.min(virtualLevel, MAX_LEVEL));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/difficulty.test.ts`
Expected: 4 passed. If the level-1 `menuVisibleSeconds: null` assertion fails, check the `t === 0` guard in `paramsForLevel`.

- [ ] **Step 5: Commit**

```bash
git add src/core/difficulty.ts tests/core/difficulty.test.ts
git commit -m "feat: difficulty parameter table with interpolation and rush curve"
```

---

### Task 7: core/order — seeded RNG, order + payment generation, amendments

**Files:**
- Create: `src/core/order.ts`
- Test: `tests/core/order.test.ts`

**Interfaces:**
- Consumes: `MenuItem` from `$core/menu`; `Denom`, `NOTE_DENOMS`, `COIN_DENOMS`, `DENOMS` from `$core/till`; `Cents` from `$core/money`; `DifficultyParams`, `PaymentStyle` from `$core/difficulty`.
- Produces:

```ts
export function mulberry32(seed: number): () => number;
export interface OrderLine { item: MenuItem; qty: number }
export interface Order { lines: OrderLine[]; totalCents: Cents }
export function orderTotal(lines: OrderLine[]): Cents;
export function generateOrder(menu: MenuItem[], params: DifficultyParams, rng: () => number): Order;
export function amendOrder(order: Order, rng: () => number): { order: Order; amendedLine: OrderLine };
export function generatePayment(totalCents: Cents, style: PaymentStyle, rng: () => number): Denom[];
export function piecesTotal(pieces: Denom[]): Cents;
```

- [ ] **Step 1: Write failing tests**

```ts
// tests/core/order.test.ts
import { describe, it, expect } from 'vitest';
import {
  mulberry32, generateOrder, amendOrder, generatePayment, orderTotal, piecesTotal,
} from '$core/order';
import { DEFAULT_MENU } from '$core/menu';
import { paramsForLevel } from '$core/difficulty';

describe('mulberry32', () => {
  it('is deterministic and in [0,1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('generateOrder', () => {
  it('respects item quantity bounds and computes total', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const p = paramsForLevel(10); // itemsMin 2, itemsMax 3
      const o = generateOrder(DEFAULT_MENU, p, rng);
      const totalQty = o.lines.reduce((s, l) => s + l.qty, 0);
      expect(totalQty).toBeGreaterThanOrEqual(2);
      expect(totalQty).toBeLessThanOrEqual(3);
      expect(o.totalCents).toBe(orderTotal(o.lines));
      expect(o.totalCents).toBeGreaterThan(0);
    }
  });
});

describe('amendOrder', () => {
  it('bumps one line by one and recomputes total', () => {
    const rng = mulberry32(3);
    const base = generateOrder(DEFAULT_MENU, paramsForLevel(10), rng);
    const { order, amendedLine } = amendOrder(base, rng);
    const beforeQty = base.lines.reduce((s, l) => s + l.qty, 0);
    const afterQty = order.lines.reduce((s, l) => s + l.qty, 0);
    expect(afterQty).toBe(beforeQty + 1);
    expect(order.totalCents).toBe(base.totalCents + amendedLine.item.priceCents);
    expect(amendedLine.qty).toBeGreaterThanOrEqual(2);
  });
});

describe('generatePayment', () => {
  it('always covers the total', () => {
    const rng = mulberry32(11);
    for (const style of ['exact-or-round', 'round', 'awkward'] as const) {
      for (let i = 0; i < 50; i++) {
        const total = 5 * (1 + Math.floor(rng() * 400)); // 0,05..20,00
        const pieces = generatePayment(total, style, rng);
        expect(piecesTotal(pieces)).toBeGreaterThanOrEqual(total);
      }
    }
  });
  it('round style pays with notes only', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 30; i++) {
      const pieces = generatePayment(430, 'round', rng);
      expect(pieces.every((p) => p >= 500)).toBe(true);
    }
  });
  it('awkward style adds at least one coin on top of a note', () => {
    const rng = mulberry32(9);
    const pieces = generatePayment(430, 'awkward', rng);
    expect(pieces.some((p) => p >= 500)).toBe(true);
    expect(pieces.some((p) => p <= 200)).toBe(true);
    expect(piecesTotal(pieces)).toBeGreaterThan(430);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/order.test.ts`
Expected: FAIL — cannot resolve `$core/order`.

- [ ] **Step 3: Implement**

```ts
// src/core/order.ts
import type { MenuItem } from './menu';
import type { Cents } from './money';
import { COIN_DENOMS, DENOMS, NOTE_DENOMS, type Denom } from './till';
import type { DifficultyParams, PaymentStyle } from './difficulty';

export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface OrderLine { item: MenuItem; qty: number }
export interface Order { lines: OrderLine[]; totalCents: Cents }

export function orderTotal(lines: OrderLine[]): Cents {
  return lines.reduce((s, l) => s + l.item.priceCents * l.qty, 0);
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Total quantity itemsMin..itemsMax, spread over 1..3 distinct menu items. */
export function generateOrder(
  menu: MenuItem[], params: DifficultyParams, rng: () => number,
): Order {
  const totalQty =
    params.itemsMin + Math.floor(rng() * (params.itemsMax - params.itemsMin + 1));
  const distinct = Math.min(1 + Math.floor(rng() * 3), totalQty, menu.length);
  const items = [...menu].sort(() => rng() - 0.5).slice(0, distinct);
  const lines: OrderLine[] = items.map((item) => ({ item, qty: 1 }));
  for (let q = distinct; q < totalQty; q++) pick(lines, rng).qty += 1;
  return { lines, totalCents: orderTotal(lines) };
}

/** Mid-order change: one line gains one more unit. */
export function amendOrder(
  order: Order, rng: () => number,
): { order: Order; amendedLine: OrderLine } {
  const idx = Math.floor(rng() * order.lines.length);
  const lines = order.lines.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l));
  return {
    order: { lines, totalCents: orderTotal(lines) },
    amendedLine: lines[idx],
  };
}

export function piecesTotal(pieces: Denom[]): Cents {
  return pieces.reduce((s, p) => s + p, 0);
}

/** Smallest note-combination ≥ amount (greedy from largest note). */
function roundNotes(amount: Cents): Denom[] {
  const pieces: Denom[] = [];
  let remaining = amount;
  for (const n of NOTE_DENOMS) {
    while (remaining > n) {
      pieces.push(n);
      remaining -= n;
    }
  }
  pieces.push(NOTE_DENOMS[NOTE_DENOMS.length - 1] <= remaining ? smallestNoteAtLeast(remaining) : 500);
  return pieces;
}

function smallestNoteAtLeast(amount: Cents): Denom {
  const asc = [...NOTE_DENOMS].sort((a, b) => a - b);
  for (const n of asc) if (n >= amount) return n;
  return asc[asc.length - 1];
}

/** Exact decomposition into denominations (always possible: amounts are 5c multiples). */
function exactPieces(amount: Cents): Denom[] {
  const pieces: Denom[] = [];
  let remaining = amount;
  for (const d of DENOMS) {
    while (remaining >= d) {
      pieces.push(d);
      remaining -= d;
    }
  }
  return pieces;
}

export function generatePayment(
  totalCents: Cents, style: PaymentStyle, rng: () => number,
): Denom[] {
  if (style === 'exact-or-round') {
    return rng() < 0.5 ? exactPieces(totalCents) : roundNotes(totalCents);
  }
  if (style === 'round') return roundNotes(totalCents);
  // awkward: round note(s) plus one random small coin on top
  return [...roundNotes(totalCents), pick(COIN_DENOMS, rng)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/order.test.ts`
Expected: 6 passed. If `roundNotes` produces totals below the amount for values > 50 €, fix the greedy loop before proceeding (the `while (remaining > n)` strictly-greater is intentional: it leaves the last note to `smallestNoteAtLeast`).

- [ ] **Step 5: Commit**

```bash
git add src/core/order.ts tests/core/order.test.ts
git commit -m "feat: seeded order and payment generation with amendments"
```

---

### Task 8: core/text-order — natural-language order rendering (EN/DE)

**Files:**
- Create: `src/core/text-order.ts`
- Test: `tests/core/text-order.test.ts`

**Interfaces:**
- Consumes: `Order`, `OrderLine` from `$core/order`.
- Produces: `renderOrder(order: Order, locale: 'en' | 'de'): string`; `renderAmendment(line: OrderLine, locale: 'en' | 'de'): string`.

- [ ] **Step 1: Write failing tests**

```ts
// tests/core/text-order.test.ts
import { describe, it, expect } from 'vitest';
import { renderOrder, renderAmendment } from '$core/text-order';

const beer = { id: 'beer', name: 'Beer', priceCents: 400 };
const ven = { id: 'veneziano', name: 'Veneziano', priceCents: 500 };

describe('renderOrder EN', () => {
  it('single item, qty 1', () => {
    expect(renderOrder({ lines: [{ item: beer, qty: 1 }], totalCents: 400 }, 'en'))
      .toBe('A Beer, please.');
  });
  it('plural and conjunction', () => {
    expect(renderOrder(
      { lines: [{ item: beer, qty: 2 }, { item: ven, qty: 1 }], totalCents: 1300 }, 'en'))
      .toBe('Two Beers and a Veneziano, please.');
  });
  it('three lines use commas', () => {
    const water = { id: 'water', name: 'Water', priceCents: 250 };
    expect(renderOrder(
      { lines: [{ item: beer, qty: 2 }, { item: ven, qty: 1 }, { item: water, qty: 3 }], totalCents: 0 }, 'en'))
      .toBe('Two Beers, a Veneziano and three Waters, please.');
  });
});

describe('renderOrder DE', () => {
  it('single item, qty 1', () => {
    expect(renderOrder({ lines: [{ item: beer, qty: 1 }], totalCents: 400 }, 'de'))
      .toBe('Ein Beer, bitte.');
  });
  it('no plural mutation in German', () => {
    expect(renderOrder(
      { lines: [{ item: beer, qty: 2 }, { item: ven, qty: 1 }], totalCents: 1300 }, 'de'))
      .toBe('Zwei Beer und ein Veneziano, bitte.');
  });
});

describe('renderAmendment', () => {
  it('EN', () => {
    expect(renderAmendment({ item: beer, qty: 3 }, 'en'))
      .toBe('Actually, make that three Beers.');
  });
  it('DE', () => {
    expect(renderAmendment({ item: beer, qty: 3 }, 'de'))
      .toBe('Ach, machen Sie doch drei Beer.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/text-order.test.ts`
Expected: FAIL — cannot resolve `$core/text-order`.

- [ ] **Step 3: Implement**

```ts
// src/core/text-order.ts
import type { Order, OrderLine } from './order';

type Locale = 'en' | 'de';

const QTY: Record<Locale, string[]> = {
  en: ['', 'a', 'two', 'three', 'four', 'five', 'six', 'seven'],
  de: ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben'],
};

function lineText(line: OrderLine, locale: Locale): string {
  const qtyWord = QTY[locale][line.qty] ?? String(line.qty);
  let name = line.item.name;
  if (locale === 'en' && line.qty > 1 && !name.endsWith('s')) name += 's';
  return `${qtyWord} ${name}`;
}

function joinLines(parts: string[], locale: Locale): string {
  const and = locale === 'en' ? 'and' : 'und';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} ${and} ${parts[parts.length - 1]}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function renderOrder(order: Order, locale: Locale): string {
  const please = locale === 'en' ? 'please' : 'bitte';
  const body = joinLines(order.lines.map((l) => lineText(l, locale)), locale);
  return `${capitalize(body)}, ${please}.`;
}

// EN amendments say "one", not "a" ("make that one Beer" — never "make that a Beer")
export function renderAmendment(line: OrderLine, locale: Locale): string {
  const qtyWordsEn = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
  if (locale === 'en') {
    let name = line.item.name;
    if (line.qty > 1 && !name.endsWith('s')) name += 's';
    return `Actually, make that ${qtyWordsEn[line.qty] ?? line.qty} ${name}.`;
  }
  return `Ach, machen Sie doch ${lineText(line, 'de')}.`;
}

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/text-order.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/text-order.ts tests/core/text-order.test.ts
git commit -m "feat: natural-language order rendering EN/DE"
```

---

### Task 9: core/round — round state machine

**Files:**
- Create: `src/core/round.ts`
- Test: `tests/core/round.test.ts`

**Interfaces:**
- Consumes: `Order` from `$core/order`; `Till`, `Denom`, `addToTill`, `removeFromTill`, `hasPieces` from `$core/till`; `canMakeChange`, `askOptions` from `$core/change`; `piecesTotal` from `$core/order`.
- Produces:

```ts
export type Phase = 'sum' | 'change' | 'done';
export type RoundError = 'sum-wrong' | 'change-wrong' | 'shortage-missed' | 'parse-wrong' | 'timeout';
export const MAX_TRIES = 2;
export interface RoundState {
  phase: Phase;
  order: Order;
  paymentPieces: Denom[];
  paymentCents: number;
  till: Till;              // on success: payment (and asked coin) added, change removed
  changeDue: number;       // meaningful from 'change' phase; includes asked coin
  sumTries: number;
  changeTries: number;
  usedAsk: boolean;
  success: boolean | null; // null while phase !== 'done'
  errors: RoundError[];
}
export function createRound(order: Order, paymentPieces: Denom[], till: Till): RoundState;
export function submitSum(s: RoundState, cents: number): RoundState;
export function submitChange(s: RoundState, pile: Denom[]): RoundState;
export function askCustomer(s: RoundState, denom: Denom): RoundState;
export function timeoutRound(s: RoundState): RoundState;
```

Rules the implementation must satisfy (all tested below):
- `submitSum` with the correct total moves to `change` phase and sets `changeDue = paymentCents - totalCents`. Wrong sum increments `sumTries`; on the 2nd wrong try the round fails with `sum-wrong` (plus `parse-wrong` when the order has more than one line — the heuristic from the spec).
- `submitChange` succeeds when the pile sums to `changeDue` and the till holds those pieces; the returned state's till has the pile removed and payment pieces (plus any asked coin) added. Wrong pile: 2 tries then fail with `change-wrong`; additionally `shortage-missed` when exact change was impossible from the till and the player never asked.
- `askCustomer(denom)`: when `denom` is in `askOptions(till, changeDue)`, the customer hands the coin over — `changeDue += denom`, `paymentCents += denom`, `usedAsk = true`. An invalid ask counts as a change try.
- `timeoutRound` from any live phase fails the round with `timeout`.
- Zero change (`changeDue === 0`): confirming an empty pile succeeds.

- [ ] **Step 1: Write failing tests**

```ts
// tests/core/round.test.ts
import { describe, it, expect } from 'vitest';
import {
  createRound, submitSum, submitChange, askCustomer, timeoutRound, MAX_TRIES,
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
});

describe('timeout', () => {
  it('fails from any live phase', () => {
    const s = timeoutRound(createRound(order2beer, [1000], fullTill()));
    expect(s.success).toBe(false);
    expect(s.errors).toEqual(['timeout']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/round.test.ts`
Expected: FAIL — cannot resolve `$core/round`.

- [ ] **Step 3: Implement**

```ts
// src/core/round.ts
import type { Order } from './order';
import { piecesTotal } from './order';
import {
  addToTill, hasPieces, removeFromTill, type Denom, type Till,
} from './till';
import { askOptions, canMakeChange } from './change';

export type Phase = 'sum' | 'change' | 'done';
export type RoundError =
  | 'sum-wrong' | 'change-wrong' | 'shortage-missed' | 'parse-wrong' | 'timeout';

export const MAX_TRIES = 2;

export interface RoundState {
  phase: Phase;
  order: Order;
  paymentPieces: Denom[];
  paymentCents: number;
  till: Till;
  changeDue: number;
  sumTries: number;
  changeTries: number;
  usedAsk: boolean;
  success: boolean | null;
  errors: RoundError[];
}

export function createRound(order: Order, paymentPieces: Denom[], till: Till): RoundState {
  return {
    phase: 'sum',
    order,
    paymentPieces,
    paymentCents: piecesTotal(paymentPieces),
    till,
    changeDue: 0,
    sumTries: 0,
    changeTries: 0,
    usedAsk: false,
    success: null,
    errors: [],
  };
}

function fail(s: RoundState, errors: RoundError[]): RoundState {
  return { ...s, phase: 'done', success: false, errors };
}

export function submitSum(s: RoundState, cents: number): RoundState {
  if (s.phase !== 'sum') return s;
  if (cents === s.order.totalCents) {
    return { ...s, phase: 'change', changeDue: s.paymentCents - s.order.totalCents };
  }
  const tries = s.sumTries + 1;
  if (tries >= MAX_TRIES) {
    const errors: RoundError[] = ['sum-wrong'];
    if (s.order.lines.length > 1) errors.push('parse-wrong');
    return fail({ ...s, sumTries: tries }, errors);
  }
  return { ...s, sumTries: tries };
}

function failChange(s: RoundState): RoundState {
  const errors: RoundError[] = ['change-wrong'];
  if (!s.usedAsk && !canMakeChange(s.till, s.paymentCents - s.order.totalCents))
    errors.push('shortage-missed');
  return fail(s, errors);
}

function bumpChangeTry(s: RoundState): RoundState {
  const tries = s.changeTries + 1;
  const next = { ...s, changeTries: tries };
  return tries >= MAX_TRIES ? failChange(next) : next;
}

export function submitChange(s: RoundState, pile: Denom[]): RoundState {
  if (s.phase !== 'change') return s;
  if (piecesTotal(pile) === s.changeDue && hasPieces(s.till, pile)) {
    const incoming = s.usedAsk
      ? [...s.paymentPieces, s.paymentCents - piecesTotal(s.paymentPieces)]
      : s.paymentPieces;
    const till = addToTill(removeFromTill(s.till, pile), incoming);
    return { ...s, phase: 'done', success: true, till };
  }
  return bumpChangeTry(s);
}

export function askCustomer(s: RoundState, denom: Denom): RoundState {
  if (s.phase !== 'change') return s;
  if (askOptions(s.till, s.changeDue).includes(denom)) {
    return {
      ...s,
      usedAsk: true,
      changeDue: s.changeDue + denom,
      paymentCents: s.paymentCents + denom,
    };
  }
  return bumpChangeTry(s);
}

export function timeoutRound(s: RoundState): RoundState {
  if (s.phase === 'done') return s;
  return fail(s, ['timeout']);
}
```

Note on the `incoming` line in `submitChange`: after a successful ask, `paymentCents - piecesTotal(paymentPieces)` is exactly the asked coin's denomination (asks happen at most once per round because `askOptions` returns `[]` once change is makeable). If a second ask ever becomes possible, this must become an explicit `askedPieces: Denom[]` array — leave a plain array if you prefer that from the start.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/round.test.ts`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/round.ts tests/core/round.test.ts
git commit -m "feat: round state machine with retries, shortage asks, timeouts"
```

---

### Task 10: core/scoring

**Files:**
- Create: `src/core/scoring.ts`
- Test: `tests/core/scoring.test.ts`

**Interfaces:**
- Produces:

```ts
export interface RoundScoreInput {
  success: boolean;
  firstTry: boolean;      // no sum or change retries
  usedAsk: boolean;       // solved a shortage via correct ask
  patienceFrac: number;   // 0..1 patience remaining at completion
  streakBefore: number;   // consecutive perfect rounds before this one
}
export function streakMultiplier(streak: number): number; // min(1 + 0.1 * streak, 2)
export function scoreRound(i: RoundScoreInput): number;   // integer
export function maxRoundScore(): number;                  // 450 (100 * 3 * 1.5)
export function starsFor(totalScore: number, orders: number): 1 | 2 | 3;
```

Scoring rules (from spec): fail → 0. Base 100 × speed multiplier `(1 + 2 * patienceFrac)` × first-try bonus (1.5 when no retries) × streak multiplier, plus flat +50 for a correct ask. Stars: survived = 1; ≥ 70% of `orders * maxRoundScore()` = 2; ≥ 90% = 3 (streak/ask bonuses ignored in the perfect-score denominator so 100% stays reachable).

- [ ] **Step 1: Write failing tests**

```ts
// tests/core/scoring.test.ts
import { describe, it, expect } from 'vitest';
import { scoreRound, streakMultiplier, starsFor, maxRoundScore } from '$core/scoring';

describe('scoring', () => {
  it('failed round scores zero', () => {
    expect(scoreRound({ success: false, firstTry: false, usedAsk: false, patienceFrac: 1, streakBefore: 5 })).toBe(0);
  });
  it('perfect fast round: 100 * 3 * 1.5 = 450', () => {
    expect(scoreRound({ success: true, firstTry: true, usedAsk: false, patienceFrac: 1, streakBefore: 0 })).toBe(450);
    expect(maxRoundScore()).toBe(450);
  });
  it('slow non-first-try round: base only', () => {
    expect(scoreRound({ success: true, firstTry: false, usedAsk: false, patienceFrac: 0, streakBefore: 0 })).toBe(100);
  });
  it('ask bonus adds 50', () => {
    expect(scoreRound({ success: true, firstTry: true, usedAsk: true, patienceFrac: 1, streakBefore: 0 })).toBe(500);
  });
  it('streak multiplier grows 10% per round, caps at 2x', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(5)).toBeCloseTo(1.5);
    expect(streakMultiplier(20)).toBe(2);
    expect(scoreRound({ success: true, firstTry: true, usedAsk: false, patienceFrac: 1, streakBefore: 10 })).toBe(900);
  });
  it('stars thresholds', () => {
    const orders = 10; // perfect = 4500
    expect(starsFor(4200, orders)).toBe(3); // ≥ 90%
    expect(starsFor(3200, orders)).toBe(2); // ≥ 70%
    expect(starsFor(1000, orders)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/scoring.test.ts`
Expected: FAIL — cannot resolve `$core/scoring`.

- [ ] **Step 3: Implement**

```ts
// src/core/scoring.ts
export interface RoundScoreInput {
  success: boolean;
  firstTry: boolean;
  usedAsk: boolean;
  patienceFrac: number;
  streakBefore: number;
}

const BASE = 100;
const FIRST_TRY_BONUS = 1.5;
const ASK_BONUS = 50;

export function streakMultiplier(streak: number): number {
  return Math.min(1 + 0.1 * streak, 2);
}

export function scoreRound(i: RoundScoreInput): number {
  if (!i.success) return 0;
  const speed = 1 + 2 * Math.min(Math.max(i.patienceFrac, 0), 1);
  const firstTry = i.firstTry ? FIRST_TRY_BONUS : 1;
  const raw = BASE * speed * firstTry * streakMultiplier(i.streakBefore);
  return Math.round(raw) + (i.usedAsk ? ASK_BONUS : 0);
}

export function maxRoundScore(): number {
  return BASE * 3 * FIRST_TRY_BONUS;
}

export function starsFor(totalScore: number, orders: number): 1 | 2 | 3 {
  const perfect = orders * maxRoundScore();
  if (totalScore >= 0.9 * perfect) return 3;
  if (totalScore >= 0.7 * perfect) return 2;
  return 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/scoring.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/scoring.ts tests/core/scoring.test.ts
git commit -m "feat: round scoring, streaks, star thresholds"
```

---

### Task 11: core/session — level/rush session state

**Files:**
- Create: `src/core/session.ts`
- Test: `tests/core/session.test.ts`

**Interfaces:**
- Consumes: `MenuItem`, `applyPriceStyle` from `$core/menu`; `DifficultyParams`, `paramsForLevel`, `paramsForRush` from `$core/difficulty`; `Till`, `fullTill`, `scarceTill` from `$core/till`; `mulberry32` from `$core/order`; `RoundState`, `RoundError` from `$core/round`; `scoreRound`, `starsFor` from `$core/scoring`.
- Produces:

```ts
export interface Customer { id: number; patienceMs: number; maxPatienceMs: number; }
export const MAX_LIVES = 3;
export interface SessionState {
  mode: 'level' | 'rush';
  level: number;                 // level mode: fixed; rush: current virtual level (display)
  elapsedMs: number;
  menu: MenuItem[];
  till: Till;
  queue: Customer[];             // head = customer being served
  livesLost: number;
  score: number;
  streak: number;
  roundsDone: number;
  finished: 'won' | 'lost' | null;
  params: DifficultyParams;
  rng: () => number;
  nextCustomerId: number;
  spawnCooldownMs: number;       // rush only
}
export function createSession(
  mode: 'level' | 'rush', level: number,
  baseMenu: MenuItem[], isCustomMenu: boolean, seed: number,
): SessionState;
export function spawnCustomer(s: SessionState): SessionState;
export function tickSession(s: SessionState, dtMs: number): SessionState;
export function patienceFrac(s: SessionState): number; // head customer, 0 when queue empty
export function completeRound(s: SessionState, round: RoundState): SessionState;
```

Behavior rules (tested below):
- `createSession`: menu = `applyPriceStyle(baseMenu, params.priceStyle)` unless `isCustomMenu` (then untouched). Till = `fullTill()` when `scarceDenoms` is 0, else `scarceTill(rng, scarceDenoms)`. Level mode starts with one spawned customer; rush starts with one and a spawn cooldown.
- `tickSession`: advances `elapsedMs`; head customer drains at full rate, waiting customers at half rate; any customer reaching 0 leaves the queue and costs a life (all modes). Rush: `params` re-derived from `paramsForRush(elapsed)`, spawn cooldown counts down and spawns (queue cap 3) at `patienceSeconds * 0.8 * 1000` intervals. `livesLost >= MAX_LIVES` → `finished: 'lost'`.
- `completeRound`: removes head customer; adds `scoreRound(...)` using head patience fraction; success + no retries + no errors → streak + 1 else streak reset; failed round costs a life; till taken from `round.till` on success (unchanged on fail — customer walks without paying); level mode finishes `'won'` at `params.ordersPerLevel` rounds (if not already lost).

- [ ] **Step 1: Write failing tests**

```ts
// tests/core/session.test.ts
import { describe, it, expect } from 'vitest';
import {
  createSession, tickSession, completeRound, spawnCustomer, patienceFrac, MAX_LIVES,
} from '$core/session';
import { DEFAULT_MENU } from '$core/menu';
import { createRound, submitSum, submitChange, timeoutRound } from '$core/round';

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
    for (const m of s.menu) expect(m.priceCents % 100).toBe(0);
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
    s = completeRound(s, r);
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
    s = completeRound(s, r);
    expect(s.livesLost).toBe(1);
    expect(s.streak).toBe(0);
    expect(s.till).toEqual(tillBefore);
  });
  it('level completes as won after ordersPerLevel rounds', () => {
    let s = freshSession();
    for (let i = 0; i < s.params.ordersPerLevel; i++) {
      if (s.queue.length === 0) s = spawnCustomer(s);
      s = completeRound(s, winRound(s));
    }
    expect(s.finished).toBe('won');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/session.test.ts`
Expected: FAIL — cannot resolve `$core/session`.

- [ ] **Step 3: Implement**

```ts
// src/core/session.ts
import { applyPriceStyle, type MenuItem } from './menu';
import {
  paramsForLevel, paramsForRush, type DifficultyParams,
} from './difficulty';
import { fullTill, scarceTill, type Till } from './till';
import { mulberry32 } from './order';
import type { RoundState } from './round';
import { scoreRound } from './scoring';

export interface Customer { id: number; patienceMs: number; maxPatienceMs: number; }

export const MAX_LIVES = 3;
const QUEUE_CAP = 3;
const WAITING_DRAIN_RATE = 0.5;

export interface SessionState {
  mode: 'level' | 'rush';
  level: number;
  elapsedMs: number;
  menu: MenuItem[];
  till: Till;
  queue: Customer[];
  livesLost: number;
  score: number;
  streak: number;
  roundsDone: number;
  finished: 'won' | 'lost' | null;
  params: DifficultyParams;
  rng: () => number;
  nextCustomerId: number;
  spawnCooldownMs: number;
}

function spawnIntervalMs(params: DifficultyParams): number {
  return params.patienceSeconds * 0.8 * 1000;
}

function newCustomer(s: SessionState): Customer {
  const ms = s.params.patienceSeconds * 1000;
  return { id: s.nextCustomerId, patienceMs: ms, maxPatienceMs: ms };
}

export function createSession(
  mode: 'level' | 'rush', level: number,
  baseMenu: MenuItem[], isCustomMenu: boolean, seed: number,
): SessionState {
  const params = mode === 'level' ? paramsForLevel(level) : paramsForRush(0);
  const rng = mulberry32(seed);
  const till = params.scarceDenoms === 0 ? fullTill() : scarceTill(rng, params.scarceDenoms);
  const menu = isCustomMenu ? baseMenu : applyPriceStyle(baseMenu, params.priceStyle);
  const s: SessionState = {
    mode, level, elapsedMs: 0, menu, till,
    queue: [], livesLost: 0, score: 0, streak: 0, roundsDone: 0,
    finished: null, params, rng, nextCustomerId: 1,
    spawnCooldownMs: spawnIntervalMs(params),
  };
  return spawnCustomer(s);
}

export function spawnCustomer(s: SessionState): SessionState {
  if (s.queue.length >= QUEUE_CAP) return s;
  return {
    ...s,
    queue: [...s.queue, newCustomer(s)],
    nextCustomerId: s.nextCustomerId + 1,
  };
}

function checkLost(s: SessionState): SessionState {
  if (s.finished === null && s.livesLost >= MAX_LIVES) return { ...s, finished: 'lost' };
  return s;
}

export function tickSession(s: SessionState, dtMs: number): SessionState {
  if (s.finished) return s;
  let next: SessionState = { ...s, elapsedMs: s.elapsedMs + dtMs };
  if (next.mode === 'rush') {
    next.params = paramsForRush(next.elapsedMs / 1000);
    next.level = Math.floor(1 + next.elapsedMs / 30_000);
    next.spawnCooldownMs -= dtMs;
    if (next.spawnCooldownMs <= 0) {
      next = spawnCustomer(next);
      next.spawnCooldownMs = spawnIntervalMs(next.params);
    }
  }
  const drained = next.queue.map((c, i) => ({
    ...c,
    patienceMs: c.patienceMs - dtMs * (i === 0 ? 1 : WAITING_DRAIN_RATE),
  }));
  const stayed = drained.filter((c) => c.patienceMs > 0);
  const walkouts = drained.length - stayed.length;
  next.queue = stayed;
  next.livesLost += walkouts;
  if (walkouts > 0) next.streak = 0;
  return checkLost(next);
}

export function patienceFrac(s: SessionState): number {
  const head = s.queue[0];
  return head ? Math.max(head.patienceMs, 0) / head.maxPatienceMs : 0;
}

export function completeRound(s: SessionState, round: RoundState): SessionState {
  if (s.finished) return s;
  const frac = patienceFrac(s);
  const firstTry = round.sumTries === 0 && round.changeTries === 0;
  const success = round.success === true;
  const gained = scoreRound({
    success, firstTry, usedAsk: success && round.usedAsk,
    patienceFrac: frac, streakBefore: s.streak,
  });
  let next: SessionState = {
    ...s,
    queue: s.queue.slice(1),
    score: s.score + gained,
    streak: success && firstTry ? s.streak + 1 : 0,
    roundsDone: s.roundsDone + 1,
    livesLost: s.livesLost + (success ? 0 : 1),
    till: success ? round.till : s.till,
  };
  next = checkLost(next);
  if (next.finished === null && next.mode === 'level'
      && next.roundsDone >= next.params.ordersPerLevel) {
    next.finished = 'won';
  }
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/session.test.ts`
Expected: 8 passed. Then run the whole suite: `npx vitest run` — everything green.

- [ ] **Step 5: Commit**

```bash
git add src/core/session.ts tests/core/session.test.ts
git commit -m "feat: session state for level and rush modes"
```

---

### Task 12: stores, i18n, router

**Files:**
- Create: `src/stores/persisted.ts`, `src/stores/settings.ts`, `src/stores/menu.ts`, `src/stores/progress.ts`, `src/stores/stats.ts`, `src/i18n/en.ts`, `src/i18n/de.ts`, `src/i18n/index.ts`, `src/lib/router.ts`
- Test: `tests/stores/persisted.test.ts`, `tests/stores/stats.test.ts`

**Interfaces:**
- Consumes: `MenuItem`, `DEFAULT_MENU` from `$core/menu`; `RoundError` from `$core/round`.
- Produces:

```ts
// stores/persisted.ts
export function persisted<T>(key: string, initial: T): Writable<T>; // localStorage envelope { v: 1, data }

// stores/settings.ts
export interface Settings { locale: 'en' | 'de'; sound: boolean; symbolFirst: boolean; useCustomMenu: boolean; }
export const settings: Writable<Settings>; // key 'op.settings'

// stores/menu.ts
export const customMenu: Writable<MenuItem[]>;      // key 'op.custom-menu', starts as copy of DEFAULT_MENU
export const activeMenu: Readable<MenuItem[]>;      // customMenu when settings.useCustomMenu else DEFAULT_MENU

// stores/progress.ts
export interface Progress { stars: Record<number, number>; }
export const progress: Writable<Progress>;           // key 'op.progress'
export function unlockedLevel(p: Progress): number;  // 1 + highest level with ≥1 star, capped at MAX_LEVEL

// stores/stats.ts
export interface Stats {
  errors: Record<RoundError, number>;
  rounds: number; roundsFailed: number; totalMs: number;
  days: Record<string, true>;                        // 'YYYY-MM-DD'
  rushHigh: number;
}
export const stats: Writable<Stats>;                 // key 'op.stats'
export function recordRound(s: Stats, errors: RoundError[], ms: number, failed: boolean): Stats;
export function recordDay(s: Stats, date: Date): Stats;
export function dayStreak(s: Stats, today: Date): number; // consecutive days ending today/yesterday

// i18n/index.ts
export const t: Readable<(key: string) => string>;   // derived from settings.locale, falls back to key

// lib/router.ts
export const route: Readable<string>;                // hash without '#/' — 'home' default
export function go(r: string): void;
```

- [ ] **Step 1: Write failing tests**

```ts
// tests/stores/persisted.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

import { persisted } from '../../src/stores/persisted';

describe('persisted', () => {
  beforeEach(() => mem.clear());
  it('starts with initial and writes envelope on set', () => {
    const s = persisted('k', { a: 1 });
    expect(get(s)).toEqual({ a: 1 });
    s.set({ a: 2 });
    expect(JSON.parse(mem.get('k')!)).toEqual({ v: 1, data: { a: 2 } });
  });
  it('restores stored value', () => {
    mem.set('k2', JSON.stringify({ v: 1, data: { a: 9 } }));
    expect(get(persisted('k2', { a: 1 }))).toEqual({ a: 9 });
  });
  it('ignores corrupt json', () => {
    mem.set('k3', '{nope');
    expect(get(persisted('k3', 5))).toBe(5);
  });
});
```

```ts
// tests/stores/stats.test.ts
import { describe, it, expect } from 'vitest';
import { recordRound, recordDay, dayStreak, type Stats } from '../../src/stores/stats';

const empty: Stats = {
  errors: { 'sum-wrong': 0, 'change-wrong': 0, 'shortage-missed': 0, 'parse-wrong': 0, timeout: 0 },
  rounds: 0, roundsFailed: 0, totalMs: 0, days: {}, rushHigh: 0,
};

describe('stats', () => {
  it('recordRound counts errors and time', () => {
    const s = recordRound(empty, ['sum-wrong', 'parse-wrong'], 4200, true);
    expect(s.errors['sum-wrong']).toBe(1);
    expect(s.errors['parse-wrong']).toBe(1);
    expect(s.rounds).toBe(1);
    expect(s.roundsFailed).toBe(1);
    expect(s.totalMs).toBe(4200);
  });
  it('dayStreak counts consecutive days ending today', () => {
    let s = empty;
    s = recordDay(s, new Date('2026-08-23'));
    s = recordDay(s, new Date('2026-08-24'));
    s = recordDay(s, new Date('2026-08-25'));
    expect(dayStreak(s, new Date('2026-08-25'))).toBe(3);
  });
  it('gap breaks the streak', () => {
    let s = empty;
    s = recordDay(s, new Date('2026-08-20'));
    s = recordDay(s, new Date('2026-08-25'));
    expect(dayStreak(s, new Date('2026-08-25'))).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/stores`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement stores**

```ts
// src/stores/persisted.ts
import { writable, type Writable } from 'svelte/store';

export function persisted<T>(key: string, initial: T): Writable<T> {
  let start = initial;
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw) {
      const env = JSON.parse(raw);
      if (env && env.v === 1) start = env.data as T;
    }
  } catch { /* corrupt storage → fall back to initial */ }
  const store = writable<T>(start);
  store.subscribe((data) => {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify({ v: 1, data }));
    } catch { /* storage full/blocked → play on without persistence */ }
  });
  return store;
}
```

```ts
// src/stores/settings.ts
import { persisted } from './persisted';

export interface Settings {
  locale: 'en' | 'de';
  sound: boolean;
  symbolFirst: boolean;
  useCustomMenu: boolean;
}

export const settings = persisted<Settings>('op.settings', {
  locale: 'en', sound: true, symbolFirst: false, useCustomMenu: false,
});
```

```ts
// src/stores/menu.ts
import { derived } from 'svelte/store';
import { persisted } from './persisted';
import { DEFAULT_MENU, type MenuItem } from '../core/menu';
import { settings } from './settings';

export const customMenu = persisted<MenuItem[]>(
  'op.custom-menu',
  DEFAULT_MENU.map((m) => ({ ...m })),
);

export const activeMenu = derived([settings, customMenu], ([$s, $c]) =>
  $s.useCustomMenu ? $c : DEFAULT_MENU,
);
```

```ts
// src/stores/progress.ts
import { persisted } from './persisted';
import { MAX_LEVEL } from '../core/difficulty';

export interface Progress { stars: Record<number, number>; }

export const progress = persisted<Progress>('op.progress', { stars: {} });

export function unlockedLevel(p: Progress): number {
  const starred = Object.keys(p.stars).map(Number).filter((l) => p.stars[l] > 0);
  return Math.min(starred.length === 0 ? 1 : Math.max(...starred) + 1, MAX_LEVEL);
}
```

```ts
// src/stores/stats.ts
import { persisted } from './persisted';
import type { RoundError } from '../core/round';

export interface Stats {
  errors: Record<RoundError, number>;
  rounds: number;
  roundsFailed: number;
  totalMs: number;
  days: Record<string, true>;
  rushHigh: number;
}

const EMPTY: Stats = {
  errors: { 'sum-wrong': 0, 'change-wrong': 0, 'shortage-missed': 0, 'parse-wrong': 0, timeout: 0 },
  rounds: 0, roundsFailed: 0, totalMs: 0, days: {}, rushHigh: 0,
};

export const stats = persisted<Stats>('op.stats', EMPTY);

export function recordRound(s: Stats, errors: RoundError[], ms: number, failed: boolean): Stats {
  const e = { ...s.errors };
  for (const err of errors) e[err] += 1;
  return {
    ...s, errors: e,
    rounds: s.rounds + 1,
    roundsFailed: s.roundsFailed + (failed ? 1 : 0),
    totalMs: s.totalMs + ms,
  };
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function recordDay(s: Stats, date: Date): Stats {
  return { ...s, days: { ...s.days, [dayKey(date)]: true } };
}

export function dayStreak(s: Stats, today: Date): number {
  let streak = 0;
  const d = new Date(today);
  while (s.days[dayKey(d)]) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
```

- [ ] **Step 4: Run store tests to verify they pass**

Run: `npx vitest run tests/stores`
Expected: 6 passed.

- [ ] **Step 5: Implement i18n and router (no unit tests — exercised by every screen)**

```ts
// src/i18n/en.ts
export default {
  'home.title': 'Orders, Please',
  'home.play': 'Play',
  'home.rush': 'Rush night',
  'home.stats': 'Stats',
  'home.menu': 'My menu',
  'home.settings': 'Settings',
  'game.level': 'Level',
  'game.rush': 'Rush',
  'game.score': 'Score',
  'game.sum-prompt': 'What does it cost?',
  'game.pays': 'Customer pays',
  'game.change-prompt': 'Give the change',
  'game.confirm': 'Give change',
  'game.ask': 'Ask customer',
  'game.ask-for': 'Do you have',
  'game.walkout': 'Customer left!',
  'game.correct': 'Correct!',
  'game.wrong': 'Wrong — it was',
  'game.change-was': 'Right change was',
  'result.won': 'Shift done!',
  'result.lost': 'Night over',
  'result.next': 'Next level',
  'result.retry': 'Retry',
  'result.home': 'Home',
  'result.highscore': 'New highscore!',
  'levels.title': 'Levels',
  'stats.title': 'Stats',
  'stats.rounds': 'Orders served',
  'stats.avg': 'Avg. seconds per order',
  'stats.streak': 'Day streak',
  'stats.rush-high': 'Rush highscore',
  'stats.errors': 'Mistakes',
  'stats.hint': 'Weakest skill: train',
  'stats.err.sum-wrong': 'Sums',
  'stats.err.change-wrong': 'Change giving',
  'stats.err.shortage-missed': 'Coin shortages',
  'stats.err.parse-wrong': 'Order parsing',
  'stats.err.timeout': 'Speed',
  'menu.title': 'My menu',
  'menu.use-custom': 'Play with my menu',
  'menu.add': 'Add drink',
  'menu.name': 'Name',
  'menu.price': 'Price',
  'menu.save': 'Save',
  'menu.delete': 'Delete',
  'error.name-empty': 'Name must not be empty',
  'error.price-invalid': 'Price must be a positive multiple of 5 cents',
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.sound': 'Sound',
  'settings.symbol-first': '€ before amount',
  'settings.reset': 'Reset all progress',
  'settings.reset-confirm': 'Really delete all progress and stats?',
} as Record<string, string>;
```

```ts
// src/i18n/de.ts
export default {
  'home.title': 'Orders, Please',
  'home.play': 'Spielen',
  'home.rush': 'Rush-Nacht',
  'home.stats': 'Statistik',
  'home.menu': 'Meine Karte',
  'home.settings': 'Einstellungen',
  'game.level': 'Level',
  'game.rush': 'Rush',
  'game.score': 'Punkte',
  'game.sum-prompt': 'Was kostet das?',
  'game.pays': 'Gast zahlt',
  'game.change-prompt': 'Gib das Wechselgeld',
  'game.confirm': 'Wechselgeld geben',
  'game.ask': 'Gast fragen',
  'game.ask-for': 'Haben Sie',
  'game.walkout': 'Gast ist gegangen!',
  'game.correct': 'Richtig!',
  'game.wrong': 'Falsch — es waren',
  'game.change-was': 'Richtiges Wechselgeld war',
  'result.won': 'Schicht geschafft!',
  'result.lost': 'Nacht vorbei',
  'result.next': 'Nächstes Level',
  'result.retry': 'Nochmal',
  'result.home': 'Start',
  'result.highscore': 'Neuer Rekord!',
  'levels.title': 'Level',
  'stats.title': 'Statistik',
  'stats.rounds': 'Bestellungen serviert',
  'stats.avg': 'Ø Sekunden pro Bestellung',
  'stats.streak': 'Tage-Serie',
  'stats.rush-high': 'Rush-Rekord',
  'stats.errors': 'Fehler',
  'stats.hint': 'Schwächste Fähigkeit: übe',
  'stats.err.sum-wrong': 'Summen',
  'stats.err.change-wrong': 'Wechselgeld',
  'stats.err.shortage-missed': 'Münzmangel',
  'stats.err.parse-wrong': 'Bestellung erfassen',
  'stats.err.timeout': 'Tempo',
  'menu.title': 'Meine Karte',
  'menu.use-custom': 'Mit meiner Karte spielen',
  'menu.add': 'Getränk hinzufügen',
  'menu.name': 'Name',
  'menu.price': 'Preis',
  'menu.save': 'Speichern',
  'menu.delete': 'Löschen',
  'error.name-empty': 'Name darf nicht leer sein',
  'error.price-invalid': 'Preis muss ein positives Vielfaches von 5 Cent sein',
  'settings.title': 'Einstellungen',
  'settings.language': 'Sprache',
  'settings.sound': 'Ton',
  'settings.symbol-first': '€ vor dem Betrag',
  'settings.reset': 'Fortschritt zurücksetzen',
  'settings.reset-confirm': 'Wirklich allen Fortschritt und alle Statistiken löschen?',
} as Record<string, string>;
```

```ts
// src/i18n/index.ts
import { derived } from 'svelte/store';
import { settings } from '../stores/settings';
import en from './en';
import de from './de';

const dicts = { en, de };

export const t = derived(settings, ($s) => (key: string): string =>
  dicts[$s.locale][key] ?? key,
);
```

```ts
// src/lib/router.ts
import { readable } from 'svelte/store';

function getHash(): string {
  return location.hash.replace(/^#\/?/, '') || 'home';
}

export const route = readable<string>(getHash(), (set) => {
  const on = () => set(getHash());
  window.addEventListener('hashchange', on);
  return () => window.removeEventListener('hashchange', on);
});

export function go(r: string): void {
  location.hash = '/' + r;
}
```

- [ ] **Step 6: Full suite + commit**

Run: `npx vitest run`
Expected: all green.

```bash
git add src/stores src/i18n src/lib/router.ts tests/stores
git commit -m "feat: persisted stores, stats, i18n EN/DE, hash router"
```

---

### Task 13: components — Numpad, MenuCard, PatienceBar

**Files:**
- Create: `src/lib/Numpad.svelte`, `src/lib/MenuCard.svelte`, `src/lib/PatienceBar.svelte`
- Test: manual via dev harness (wired into Game in Task 15; a quick temporary render in `App.svelte` is fine and gets removed in Task 15)

**Interfaces:**
- Consumes: `formatEuro` from `$core/money`; `MenuItem` from `$core/menu`.
- Produces (Svelte 5 runes props):
  - `Numpad`: `{ onsubmit: (cents: number) => void; symbolFirst?: boolean }` — register-style cents entry: tapping 4·5·0 shows `4,50 €`.
  - `MenuCard`: `{ menu: MenuItem[]; pricesHidden: boolean; symbolFirst?: boolean }` — collapsible card; hidden prices render `?,??`.
  - `PatienceBar`: `{ frac: number }` — 0..1, green → orange → red.

- [ ] **Step 1: Implement Numpad**

```svelte
<!-- src/lib/Numpad.svelte -->
<script lang="ts">
  import { formatEuro } from '../core/money';

  let { onsubmit, symbolFirst = false }:
    { onsubmit: (cents: number) => void; symbolFirst?: boolean } = $props();

  let digits = $state('');
  const display = $derived(formatEuro(Number(digits || '0'), symbolFirst));

  function tap(d: string) {
    if (digits.length < 6) digits += d;
  }
  function submit() {
    onsubmit(Number(digits || '0'));
    digits = '';
  }
</script>

<div class="numpad">
  <output>{display}</output>
  <div class="keys">
    {#each ['1','2','3','4','5','6','7','8','9'] as k}
      <button onclick={() => tap(k)}>{k}</button>
    {/each}
    <button class="fn" onclick={() => (digits = '')}>C</button>
    <button onclick={() => tap('0')}>0</button>
    <button class="ok" onclick={submit}>OK</button>
  </div>
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
  .fn { background: var(--danger) !important; }
  .ok { background: var(--ok) !important; }
</style>
```

- [ ] **Step 2: Implement MenuCard**

```svelte
<!-- src/lib/MenuCard.svelte -->
<script lang="ts">
  import { formatEuro } from '../core/money';
  import type { MenuItem } from '../core/menu';

  let { menu, pricesHidden, symbolFirst = false }:
    { menu: MenuItem[]; pricesHidden: boolean; symbolFirst?: boolean } = $props();

  let collapsed = $state(false);
</script>

<section class="card" class:collapsed>
  <button class="head" onclick={() => (collapsed = !collapsed)}>
    Menu {collapsed ? '▾' : '▴'}
  </button>
  {#if !collapsed}
    <ul>
      {#each menu as item (item.id)}
        <li>
          <span>{item.name}</span>
          <span class="dots"></span>
          <span class="price">{pricesHidden ? '?,?? €' : formatEuro(item.priceCents, symbolFirst)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .card {
    background: var(--cream); color: var(--ink);
    border-radius: var(--radius); padding: 0.5rem 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
  }
  .head {
    background: none; color: inherit; width: 100%; text-align: left;
    font: inherit; font-weight: bold; min-height: 32px;
  }
  ul { list-style: none; padding: 0; }
  li { display: flex; align-items: baseline; gap: 0.5rem; padding: 0.15rem 0; }
  .dots { flex: 1; border-bottom: 1px dotted var(--ink); }
  .price { font-variant-numeric: tabular-nums; }
</style>
```

- [ ] **Step 3: Implement PatienceBar**

```svelte
<!-- src/lib/PatienceBar.svelte -->
<script lang="ts">
  let { frac }: { frac: number } = $props();
  const clamped = $derived(Math.min(Math.max(frac, 0), 1));
  const color = $derived(clamped > 0.5 ? 'var(--ok)' : clamped > 0.25 ? 'var(--accent)' : 'var(--danger)');
</script>

<div class="track" role="progressbar" aria-valuenow={Math.round(clamped * 100)}>
  <div class="fill" style="width: {clamped * 100}%; background: {color}"></div>
</div>

<style>
  .track {
    height: 8px; border-radius: 4px; background: rgb(0 0 0 / 0.35); overflow: hidden;
  }
  .fill { height: 100%; transition: width 0.2s linear; }
</style>
```

- [ ] **Step 4: Visual check**

Temporarily render all three in `App.svelte` with dummy data, run `npm run dev`, verify: numpad shows `4,50 €` after tapping 4-5-0, menu card collapses and hides prices when `pricesHidden`, patience bar shifts green→orange→red as `frac` drops. Then revert `App.svelte` to the plain heading.

- [ ] **Step 5: Commit**

```bash
git add src/lib/Numpad.svelte src/lib/MenuCard.svelte src/lib/PatienceBar.svelte
git commit -m "feat: numpad, menu card, patience bar components"
```

---

### Task 14: components — TillGrid, ChangePile, payment display

**Files:**
- Create: `src/lib/denom-view.ts`, `src/lib/Money.svelte`, `src/lib/TillGrid.svelte`, `src/lib/ChangePile.svelte`
- Test: `tests/lib/denom-view.test.ts` for the pure helper; components checked visually in Task 15

**Interfaces:**
- Consumes: `Till`, `Denom`, `DENOMS`, `NOTE_DENOMS` from `$core/till`; `formatEuro` from `$core/money`.
- Produces:
  - `denom-view.ts`: `denomLabel(d: Denom): string` (`'50 €'`, `'2 €'`, `'50c'`), `isNote(d: Denom): boolean`, `denomColor(d: Denom): string` (CSS color per denomination).
  - `Money.svelte`: `{ denom: Denom; disabled?: boolean; count?: number | null; onclick?: () => void }` — one coin (circle) or note (rounded rect) with label and optional count badge.
  - `TillGrid.svelte`: `{ till: Till; ontake: (d: Denom) => void }` — full denomination grid, greyed at count 0.
  - `ChangePile.svelte`: `{ pile: Denom[]; showTotal: boolean; onreturn: (index: number) => void }`.

- [ ] **Step 1: Write failing test for denom-view**

```ts
// tests/lib/denom-view.test.ts
import { describe, it, expect } from 'vitest';
import { denomLabel, isNote } from '../../src/lib/denom-view';

describe('denom-view', () => {
  it('labels notes and coins', () => {
    expect(denomLabel(5000)).toBe('50 €');
    expect(denomLabel(500)).toBe('5 €');
    expect(denomLabel(200)).toBe('2 €');
    expect(denomLabel(50)).toBe('50c');
    expect(denomLabel(5)).toBe('5c');
  });
  it('classifies notes', () => {
    expect(isNote(500)).toBe(true);
    expect(isNote(200)).toBe(false);
  });
});
```

Run: `npx vitest run tests/lib/denom-view.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 2: Implement denom-view**

```ts
// src/lib/denom-view.ts
import type { Denom } from '../core/till';

export function isNote(d: Denom): boolean {
  return d >= 500;
}

export function denomLabel(d: Denom): string {
  return d >= 100 ? `${d / 100} €` : `${d}c`;
}

const COLORS: Record<number, string> = {
  5000: '#d98e2b', 2000: '#4d7fbf', 1000: '#bf5b4d', 500: '#7fa65a',
  200: '#d8d3c8', 100: '#cfae5a', 50: '#c9962e', 20: '#c9962e',
  10: '#c9962e', 5: '#a5673f',
};

export function denomColor(d: Denom): string {
  return COLORS[d] ?? '#999';
}
```

Run: `npx vitest run tests/lib/denom-view.test.ts` — Expected: 2 passed.

- [ ] **Step 3: Implement Money, TillGrid, ChangePile**

```svelte
<!-- src/lib/Money.svelte -->
<script lang="ts">
  import type { Denom } from '../core/till';
  import { denomColor, denomLabel, isNote } from './denom-view';

  let { denom, disabled = false, count = null, onclick }:
    { denom: Denom; disabled?: boolean; count?: number | null; onclick?: () => void } = $props();
</script>

<button
  class:note={isNote(denom)} class:coin={!isNote(denom)}
  style="--money-color: {denomColor(denom)}"
  {disabled} onclick={onclick}
>
  {denomLabel(denom)}
  {#if count !== null}<span class="badge">{count}</span>{/if}
</button>

<style>
  button {
    position: relative; background: var(--money-color); color: var(--ink);
    font-weight: bold; font-size: 0.9rem;
    display: grid; place-items: center;
  }
  button:disabled { opacity: 0.3; }
  .coin { width: 52px; height: 52px; border-radius: 50%; border: 3px solid rgb(0 0 0 / 0.25); }
  .note { width: 72px; height: 44px; border-radius: 6px; border: 2px solid rgb(0 0 0 / 0.25); }
  .badge {
    position: absolute; top: -6px; right: -6px;
    background: var(--ink); color: var(--cream);
    border-radius: 999px; font-size: 0.7rem; padding: 1px 6px;
  }
</style>
```

```svelte
<!-- src/lib/TillGrid.svelte -->
<script lang="ts">
  import { DENOMS, type Denom, type Till } from '../core/till';
  import Money from './Money.svelte';

  let { till, ontake }: { till: Till; ontake: (d: Denom) => void } = $props();
</script>

<div class="till">
  {#each DENOMS as d (d)}
    <Money denom={d} count={till[d] ?? 0} disabled={(till[d] ?? 0) === 0} onclick={() => ontake(d)} />
  {/each}
</div>

<style>
  .till {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 0.6rem; justify-items: center;
    padding: 0.6rem; background: rgb(0 0 0 / 0.25); border-radius: var(--radius);
  }
</style>
```

```svelte
<!-- src/lib/ChangePile.svelte -->
<script lang="ts">
  import type { Denom } from '../core/till';
  import { piecesTotal } from '../core/order';
  import { formatEuro } from '../core/money';
  import Money from './Money.svelte';

  let { pile, showTotal, onreturn }:
    { pile: Denom[]; showTotal: boolean; onreturn: (index: number) => void } = $props();
</script>

<div class="pile" class:empty={pile.length === 0}>
  {#each pile as d, i}
    <Money denom={d} onclick={() => onreturn(i)} />
  {/each}
  {#if showTotal && pile.length > 0}
    <span class="total">{formatEuro(piecesTotal(pile))}</span>
  {/if}
</div>

<style>
  .pile {
    min-height: 60px; display: flex; flex-wrap: wrap; gap: 0.4rem;
    align-items: center; padding: 0.4rem;
    border: 2px dashed rgb(245 236 215 / 0.4); border-radius: var(--radius);
  }
  .empty::after { content: '·'; opacity: 0.4; margin: auto; }
  .total { margin-left: auto; font-size: 1.2rem; font-variant-numeric: tabular-nums; }
</style>
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run`
Expected: all green.

```bash
git add src/lib/denom-view.ts src/lib/Money.svelte src/lib/TillGrid.svelte src/lib/ChangePile.svelte tests/lib/denom-view.test.ts
git commit -m "feat: money, till grid, change pile components"
```

---

### Task 15: Game screen — round orchestration

**Files:**
- Create: `src/lib/sound.ts`, `src/routes/Game.svelte`
- Modify: `src/App.svelte` (temporary: render `<Game mode="level" level={1} />` directly for manual testing; real routing lands in Task 16)
- Test: core suite already covers the logic; this task is wiring — verify by playing

**Interfaces:**
- Consumes: everything from Tasks 2–14. Notable: `createSession/tickSession/completeRound/spawnCustomer/patienceFrac/MAX_LIVES` (`$core/session`), `createRound/submitSum/submitChange/askCustomer/timeoutRound` (`$core/round`), `generateOrder/generatePayment/amendOrder/piecesTotal` (`$core/order`), `renderOrder/renderAmendment` (`$core/text-order`), `starsFor` (`$core/scoring`), stores, i18n `t`, `go`.
- Produces: `Game.svelte` with props `{ mode: 'level' | 'rush'; level?: number }`; `beep(ok: boolean, enabled: boolean): void` in `sound.ts`.

Orchestration rules (these encode design decisions — follow them exactly):
- **Tick**: 200ms interval. If a round is live and the head customer's patience would hit 0 this tick, the round is finished as `timeoutRound(...)` FIRST (its `completeRound` removes the head and charges the life), and only then `tickSession` runs — otherwise the walkout would double-charge.
- **Mid-order change**: decided at round start (`rng < params.midOrderChangeProb`). The round is created with the ORIGINAL order; 2.5s later, if still in `sum` phase, the round's `order`, `paymentPieces`, `paymentCents` are swapped to the amended versions and the amendment sentence is shown. If the player already submitted the sum, the amendment silently never happens (fast play beats indecisive customers).
- **Ask flow**: an "Ask customer" button is ALWAYS visible in the change phase (the game must not reveal when a shortage exists). Tapping it opens a row of all coin denominations; picking one calls `askCustomer` — an invalid ask burns a change try (core enforces this).
- **Till view**: pieces in the current pile render as removed from the grid (`tillView = round.till minus pile`), but `round.till` itself only changes on round success.
- **Wrong change try**: pile is cleared so the player rebuilds.
- **Session end**: record day + stats; level won → store `max(existing, starsFor(score, ordersPerLevel))` in progress; rush → update `rushHigh`. Overlay offers next level / retry / home.

- [ ] **Step 1: Implement sound helper**

```ts
// src/lib/sound.ts
let ctx: AudioContext | null = null;

export function beep(ok: boolean, enabled: boolean): void {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 880 : 220;
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.15);
  } catch { /* no audio context (e.g. autoplay policy) → silent game */ }
}
```

- [ ] **Step 2: Implement Game.svelte**

```svelte
<!-- src/routes/Game.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { settings } from '../stores/settings';
  import { activeMenu } from '../stores/menu';
  import { stats, recordRound, recordDay } from '../stores/stats';
  import { progress } from '../stores/progress';
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import {
    createSession, tickSession, completeRound, spawnCustomer, MAX_LIVES,
  } from '../core/session';
  import {
    createRound, submitSum, submitChange, askCustomer, timeoutRound, type RoundState,
  } from '../core/round';
  import { generateOrder, generatePayment, amendOrder, piecesTotal } from '../core/order';
  import { renderOrder, renderAmendment } from '../core/text-order';
  import { starsFor } from '../core/scoring';
  import { formatEuro } from '../core/money';
  import { COIN_DENOMS, type Denom } from '../core/till';
  import { MAX_LEVEL } from '../core/difficulty';
  import { denomLabel } from '../lib/denom-view';
  import { beep } from '../lib/sound';
  import Numpad from '../lib/Numpad.svelte';
  import MenuCard from '../lib/MenuCard.svelte';
  import PatienceBar from '../lib/PatienceBar.svelte';
  import TillGrid from '../lib/TillGrid.svelte';
  import ChangePile from '../lib/ChangePile.svelte';

  let { mode, level = 1 }: { mode: 'level' | 'rush'; level?: number } = $props();

  let session = $state(createSession(
    mode, level, get(activeMenu), get(settings).useCustomMenu, Date.now() % 2 ** 31,
  ));
  let round = $state<RoundState | null>(null);
  let orderText = $state('');
  let amendText = $state<string | null>(null);
  let pile = $state<Denom[]>([]);
  let menuHidden = $state(false);
  let askOpen = $state(false);
  let flash = $state<string | null>(null);
  let finalized = $state(false);
  let roundStartedAt = 0;
  let amendTimer: ReturnType<typeof setTimeout> | undefined;
  let menuTimer: ReturnType<typeof setTimeout> | undefined;

  const symbolFirst = $derived($settings.symbolFirst);
  const tillView = $derived.by(() => {
    if (!round) return session.till;
    const view = { ...round.till };
    for (const p of pile) view[p] -= 1;
    return view;
  });
  const stars = $derived(
    session.finished === 'won' ? starsFor(session.score, session.params.ordersPerLevel) : 0,
  );

  function startRound() {
    if (session.finished || round || flash) return;
    if (session.queue.length === 0) {
      if (session.mode === 'rush') return; // rush waits for the spawn timer
      session = spawnCustomer(session);
    }
    const order = generateOrder(session.menu, session.params, session.rng);
    const payment = generatePayment(order.totalCents, session.params.paymentStyle, session.rng);
    round = createRound(order, payment, session.till);
    orderText = renderOrder(order, $settings.locale);
    amendText = null;
    pile = [];
    askOpen = false;
    roundStartedAt = performance.now();

    if (session.rng() < session.params.midOrderChangeProb) {
      const amended = amendOrder(order, session.rng);
      amendTimer = setTimeout(() => {
        if (round && round.phase === 'sum') {
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

    const vis = session.params.menuVisibleSeconds;
    clearTimeout(menuTimer);
    menuHidden = vis === 0;
    if (vis !== null && vis > 0) {
      menuTimer = setTimeout(() => (menuHidden = true), vis * 1000);
    }
  }

  function finishRound() {
    if (!round) return;
    const done = round;
    const ms = performance.now() - roundStartedAt;
    const failed = done.success !== true;
    stats.update((s) => recordRound(s, done.errors, ms, failed));
    flash = failed
      ? `${$t('game.wrong')} ${formatEuro(done.order.totalCents, symbolFirst)}`
      : $t('game.correct');
    beep(!failed, $settings.sound);
    session = completeRound(session, done);
    round = null;
    pile = [];
    clearTimeout(amendTimer);
    clearTimeout(menuTimer);
    setTimeout(() => {
      flash = null;
      startRound();
    }, 1400);
  }

  function onSum(cents: number) {
    if (!round) return;
    round = submitSum(round, cents);
    if (round.phase === 'done') finishRound();
    else if (round.sumTries > 0 && round.phase === 'sum') beep(false, $settings.sound);
  }

  function take(d: Denom) {
    if ((tillView[d] ?? 0) > 0) pile = [...pile, d];
  }
  function ret(index: number) {
    pile = pile.toSpliced(index, 1);
  }
  function confirmChange() {
    if (!round) return;
    round = submitChange(round, pile);
    if (round.phase === 'done') finishRound();
    else {
      pile = [];
      beep(false, $settings.sound);
    }
  }
  function onAsk(d: Denom) {
    if (!round) return;
    askOpen = false;
    round = askCustomer(round, d);
    if (round.phase === 'done') finishRound();
  }

  // retry keeps the same hash, so {#key $route} never remounts — reset in place
  function restart() {
    session = createSession(
      mode, level, get(activeMenu), get(settings).useCustomMenu, Date.now() % 2 ** 31,
    );
    round = null;
    flash = null;
    finalized = false;
    pile = [];
    startRound();
  }

  function finalize() {
    if (finalized) return;
    finalized = true;
    stats.update((s) => {
      let next = recordDay(s, new Date());
      if (session.mode === 'rush' && session.score > next.rushHigh)
        next = { ...next, rushHigh: session.score };
      return next;
    });
    if (session.mode === 'level' && session.finished === 'won') {
      progress.update((p) => ({
        stars: { ...p.stars, [level]: Math.max(p.stars[level] ?? 0, stars) },
      }));
    }
  }

  onMount(() => {
    startRound();
    const iv = setInterval(() => {
      const dt = 200;
      if (session.finished) {
        finalize();
        return;
      }
      // head walking out during a live round = that round times out (see rules above)
      if (round && session.queue[0] && session.queue[0].patienceMs <= dt) {
        round = timeoutRound(round);
        finishRound();
      }
      session = tickSession(session, dt);
      if (session.finished) finalize();
      else if (!round && !flash && session.queue.length > 0) startRound();
    }, 200);
    return () => {
      clearInterval(iv);
      clearTimeout(amendTimer);
      clearTimeout(menuTimer);
    };
  });
</script>

<main class="game">
  <header>
    <span class="lives">{'♥'.repeat(Math.max(0, MAX_LIVES - session.livesLost))}</span>
    <span>{mode === 'level' ? `${$t('game.level')} ${level}` : `${$t('game.rush')} · ${session.level}`}</span>
    <span>{$t('game.score')}: {session.score}</span>
  </header>

  <div class="queue">
    {#each session.queue as c, i (c.id)}
      <div class="customer" class:active={i === 0}>
        <span class="face">👤</span>
        <PatienceBar frac={c.patienceMs / c.maxPatienceMs} />
      </div>
    {/each}
  </div>

  {#if round}
    <p class="order">“{orderText}”</p>
    {#if amendText}<p class="order amend">“{amendText}”</p>{/if}

    <MenuCard menu={session.menu} pricesHidden={menuHidden} {symbolFirst} />

    {#if round.phase === 'sum'}
      <p class="prompt">{$t('game.sum-prompt')}</p>
      <Numpad onsubmit={onSum} {symbolFirst} />
    {:else if round.phase === 'change'}
      <p class="prompt">
        {$t('game.pays')}:
        {#each [...round.paymentPieces].sort((a, b) => b - a) as p}
          <span class="paid">{denomLabel(p)}</span>
        {/each}
      </p>
      <TillGrid till={tillView} ontake={take} />
      <ChangePile {pile} showTotal={session.params.showPileTotal} onreturn={ret} />
      <div class="actions">
        <button class="confirm" onclick={confirmChange}>{$t('game.confirm')}</button>
        <button class="ask" onclick={() => (askOpen = !askOpen)}>{$t('game.ask')}</button>
      </div>
      {#if askOpen}
        <div class="ask-row">
          {#each COIN_DENOMS as d (d)}
            <button onclick={() => onAsk(d)}>{$t('game.ask-for')} {denomLabel(d)}?</button>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}

  {#if flash}<div class="flash">{flash}</div>{/if}

  {#if session.finished && finalized}
    <div class="overlay">
      <h2>{session.finished === 'won' ? $t('result.won') : $t('result.lost')}</h2>
      {#if session.finished === 'won'}
        <p class="stars">{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</p>
      {/if}
      <p>{$t('game.score')}: {session.score}</p>
      {#if mode === 'rush' && session.score >= $stats.rushHigh && session.score > 0}
        <p>{$t('result.highscore')}</p>
      {/if}
      <div class="overlay-actions">
        {#if mode === 'level' && session.finished === 'won' && level < MAX_LEVEL}
          <button onclick={() => go(`game/${level + 1}`)}>{$t('result.next')}</button>
        {/if}
        <button onclick={restart}>{$t('result.retry')}</button>
        <button onclick={() => go('home')}>{$t('result.home')}</button>
      </div>
    </div>
  {/if}
</main>

<style>
  .game {
    display: flex; flex-direction: column; gap: 0.75rem;
    max-width: 480px; margin: 0 auto; padding: 0.75rem; min-height: 100dvh;
  }
  header { display: flex; justify-content: space-between; align-items: center; }
  .lives { color: var(--danger); }
  .queue { display: flex; gap: 0.75rem; min-height: 40px; }
  .customer { width: 64px; opacity: 0.5; }
  .customer.active { opacity: 1; }
  .face { font-size: 1.4rem; }
  .order { font-size: 1.15rem; font-style: italic; }
  .amend { color: var(--accent); }
  .prompt { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: baseline; }
  .paid {
    background: var(--cream); color: var(--ink);
    padding: 0.1rem 0.5rem; border-radius: 6px; font-weight: bold;
  }
  .actions { display: flex; gap: 0.5rem; }
  .confirm { flex: 1; background: var(--ok); color: var(--cream); font-size: 1.1rem; }
  .ask { background: var(--accent); color: var(--ink); }
  .ask-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .ask-row button { background: var(--wood-light); color: var(--cream); }
  .flash {
    position: fixed; inset: auto 0 30% 0; margin: 0 auto; width: fit-content;
    background: var(--cream); color: var(--ink);
    padding: 0.75rem 1.5rem; border-radius: var(--radius);
    font-size: 1.3rem; font-weight: bold;
  }
  .overlay {
    position: fixed; inset: 0; background: rgb(0 0 0 / 0.75);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0.75rem; text-align: center;
  }
  .stars { font-size: 2.2rem; color: var(--accent); }
  .overlay-actions { display: flex; flex-direction: column; gap: 0.5rem; width: 240px; }
  .overlay-actions button { background: var(--accent); color: var(--ink); font-size: 1.1rem; }
</style>
```

- [ ] **Step 3: Wire temporarily and play**

Set `src/App.svelte` to:

```svelte
<script lang="ts">
  import Game from './routes/Game.svelte';
</script>

<Game mode="level" level={1} />
```

Run: `npm run dev` — play level 1 end to end. Verify: order sentence appears; correct sum advances to payment; wrong sum twice fails the round with the answer shown; change taps drain the grid; confirm with correct pile succeeds; ♥ lost on failure; level completes with stars overlay.

Also verify a shortage manually: temporarily start at level 20 (`level={20}`) — coin scarcity plus awkward payments will produce ask situations within a few rounds. Confirm the ask flow (button → coin row → changeDue grows). Revert to `level={1}` after.

- [ ] **Step 4: Run suite + commit**

Run: `npx vitest run`
Expected: all green.

```bash
git add src/routes/Game.svelte src/lib/sound.ts src/App.svelte
git commit -m "feat: game screen with round orchestration, asks, amendments"
```

---

### Task 16: routing, Home, Levels map, Rush entry

**Files:**
- Create: `src/routes/Home.svelte`, `src/routes/Levels.svelte`
- Modify: `src/App.svelte` (real routing), `src/main.ts` (import app.css if not already)

**Interfaces:**
- Consumes: `route`, `go` from `$lib/router`; `progress`, `unlockedLevel`; `MAX_LEVEL`; `t`.
- Produces: hash routes — `home`, `levels`, `game/<n>`, `rush`, `stats`, `menu`, `settings`.

- [ ] **Step 1: Implement Home**

```svelte
<!-- src/routes/Home.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { go } from '../lib/router';
</script>

<main class="home">
  <h1>{$t('home.title')}</h1>
  <button onclick={() => go('levels')}>{$t('home.play')}</button>
  <button onclick={() => go('rush')}>{$t('home.rush')}</button>
  <button class="minor" onclick={() => go('stats')}>{$t('home.stats')}</button>
  <button class="minor" onclick={() => go('menu')}>{$t('home.menu')}</button>
  <button class="minor" onclick={() => go('settings')}>{$t('home.settings')}</button>
</main>

<style>
  .home {
    min-height: 100dvh; display: flex; flex-direction: column;
    justify-content: center; align-items: stretch; gap: 0.75rem;
    max-width: 320px; margin: 0 auto; padding: 1rem;
  }
  h1 { text-align: center; font-family: Georgia, serif; margin-bottom: 1.5rem; }
  button { background: var(--accent); color: var(--ink); font-size: 1.2rem; padding: 0.9rem; }
  .minor { background: var(--wood-light); color: var(--cream); font-size: 1rem; }
</style>
```

- [ ] **Step 2: Implement Levels**

```svelte
<!-- src/routes/Levels.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import { progress, unlockedLevel } from '../stores/progress';
  import { MAX_LEVEL } from '../core/difficulty';

  const unlocked = $derived(unlockedLevel($progress));
  const levels = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
</script>

<main class="levels">
  <h2><button class="back" onclick={() => go('home')}>←</button> {$t('levels.title')}</h2>
  <div class="grid">
    {#each levels as l (l)}
      <button class="level" disabled={l > unlocked} onclick={() => go(`game/${l}`)}>
        <span class="num">{l}</span>
        <span class="stars">{'★'.repeat($progress.stars[l] ?? 0)}</span>
      </button>
    {/each}
  </div>
</main>

<style>
  .levels { max-width: 480px; margin: 0 auto; padding: 0.75rem; }
  h2 { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
  .back { background: none; color: var(--cream); font-size: 1.4rem; }
  .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; }
  .level {
    aspect-ratio: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: var(--wood-light); color: var(--cream);
  }
  .level:disabled { opacity: 0.35; }
  .num { font-size: 1.2rem; font-weight: bold; }
  .stars { color: var(--accent); font-size: 0.8rem; min-height: 1em; }
</style>
```

- [ ] **Step 3: Real routing in App.svelte**

```svelte
<!-- src/App.svelte -->
<script lang="ts">
  import { route } from './lib/router';
  import Home from './routes/Home.svelte';
  import Levels from './routes/Levels.svelte';
  import Game from './routes/Game.svelte';
  import Stats from './routes/Stats.svelte';
  import MenuEditor from './routes/MenuEditor.svelte';
  import Settings from './routes/Settings.svelte';

  const gameLevel = $derived.by(() => {
    const m = $route.match(/^game\/(\d+)$/);
    return m ? Number(m[1]) : null;
  });
</script>

{#key $route}
  {#if gameLevel !== null}
    <Game mode="level" level={gameLevel} />
  {:else if $route === 'rush'}
    <Game mode="rush" />
  {:else if $route === 'levels'}
    <Levels />
  {:else if $route === 'stats'}
    <Stats />
  {:else if $route === 'menu'}
    <MenuEditor />
  {:else if $route === 'settings'}
    <Settings />
  {:else}
    <Home />
  {/if}
{/key}
```

`{#key $route}` forces a fresh Game instance on retry/next-level navigation.

Until Tasks 17–18 exist, create placeholder `src/routes/Stats.svelte`, `src/routes/MenuEditor.svelte`, `src/routes/Settings.svelte`, each containing only a back button so the build stays green:

```svelte
<script lang="ts">
  import { go } from '../lib/router';
</script>
<main><button onclick={() => go('home')}>←</button></main>
```

- [ ] **Step 4: Verify + commit**

Run: `npm run dev` — navigate Home → Levels → level 1 → play → win → Next level; Rush from Home; back buttons work. Only level `unlocked` and below are tappable.

Run: `npx vitest run` — all green.

```bash
git add src/App.svelte src/routes
git commit -m "feat: hash routing, home screen, levels map"
```

---

### Task 17: MenuEditor + Settings screens

**Files:**
- Modify: `src/core/money.ts` (add `parseEuro`), `src/routes/MenuEditor.svelte`, `src/routes/Settings.svelte` (replace placeholders)
- Test: `tests/core/money.test.ts` (extend)

**Interfaces:**
- Produces: `parseEuro(input: string): Cents | null` — accepts `'4,50'`, `'4.50'`, `'4'`; null for junk/negatives.
- Consumes: `customMenu`, `settings`, `progress`, `stats` stores; `validateItem` from `$core/menu`.

- [ ] **Step 1: Extend money tests (failing)**

Append to `tests/core/money.test.ts`:

```ts
import { parseEuro } from '$core/money';

describe('parseEuro', () => {
  it('parses comma and dot decimals', () => {
    expect(parseEuro('4,50')).toBe(450);
    expect(parseEuro('4.50')).toBe(450);
    expect(parseEuro('4')).toBe(400);
    expect(parseEuro(' 2,5 ')).toBe(250);
  });
  it('rejects junk', () => {
    expect(parseEuro('')).toBeNull();
    expect(parseEuro('abc')).toBeNull();
    expect(parseEuro('-4')).toBeNull();
    expect(parseEuro('4,555')).toBeNull();
  });
});
```

Run: `npx vitest run tests/core/money.test.ts` — Expected: new cases FAIL.

- [ ] **Step 2: Implement parseEuro**

Append to `src/core/money.ts`:

```ts
export function parseEuro(input: string): Cents | null {
  const cleaned = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
```

Run: `npx vitest run tests/core/money.test.ts` — Expected: all pass.

- [ ] **Step 3: Implement MenuEditor**

```svelte
<!-- src/routes/MenuEditor.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import { customMenu } from '../stores/menu';
  import { settings } from '../stores/settings';
  import { validateItem } from '../core/menu';
  import { formatEuro, parseEuro } from '../core/money';

  let newName = $state('');
  let newPrice = $state('');
  let error = $state<string | null>(null);

  function add() {
    const cents = parseEuro(newPrice);
    const err = validateItem(newName, cents ?? -1);
    if (err) {
      error = err;
      return;
    }
    customMenu.update((m) => [
      ...m,
      { id: `custom-${Date.now()}`, name: newName.trim(), priceCents: cents! },
    ]);
    newName = '';
    newPrice = '';
    error = null;
  }

  function remove(id: string) {
    customMenu.update((m) => m.filter((x) => x.id !== id));
  }
</script>

<main class="editor">
  <h2><button class="back" onclick={() => go('home')}>←</button> {$t('menu.title')}</h2>

  <label class="toggle">
    <input type="checkbox" bind:checked={$settings.useCustomMenu} />
    {$t('menu.use-custom')}
  </label>

  <ul>
    {#each $customMenu as item (item.id)}
      <li>
        <span>{item.name}</span>
        <span class="price">{formatEuro(item.priceCents, $settings.symbolFirst)}</span>
        <button class="del" onclick={() => remove(item.id)}>✕</button>
      </li>
    {/each}
  </ul>

  <div class="add">
    <input placeholder={$t('menu.name')} bind:value={newName} />
    <input placeholder="4,50" inputmode="decimal" bind:value={newPrice} />
    <button onclick={add}>{$t('menu.add')}</button>
  </div>
  {#if error}<p class="error">{$t(error)}</p>{/if}
</main>

<style>
  .editor { max-width: 480px; margin: 0 auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.75rem; }
  h2 { display: flex; align-items: center; gap: 0.5rem; }
  .back { background: none; color: var(--cream); font-size: 1.4rem; }
  .toggle { display: flex; gap: 0.5rem; align-items: center; }
  input[type='checkbox'] { width: 24px; height: 24px; }
  ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
  li {
    display: flex; align-items: center; gap: 0.5rem;
    background: var(--wood-light); border-radius: var(--radius); padding: 0.4rem 0.6rem;
  }
  li span:first-child { flex: 1; }
  .price { font-variant-numeric: tabular-nums; }
  .del { background: var(--danger); color: var(--cream); min-width: 40px; min-height: 40px; }
  .add { display: flex; gap: 0.4rem; }
  .add input {
    flex: 1; min-width: 0; padding: 0.6rem; border-radius: var(--radius);
    border: none; font: inherit; background: var(--cream); color: var(--ink);
  }
  .add button { background: var(--ok); color: var(--cream); }
  .error { color: var(--danger); }
</style>
```

- [ ] **Step 4: Implement Settings**

```svelte
<!-- src/routes/Settings.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import { settings } from '../stores/settings';
  import { progress } from '../stores/progress';
  import { stats } from '../stores/stats';
  import { customMenu } from '../stores/menu';
  import { DEFAULT_MENU } from '../core/menu';

  function resetAll() {
    if (!confirm($t('settings.reset-confirm'))) return;
    progress.set({ stars: {} });
    stats.set({
      errors: { 'sum-wrong': 0, 'change-wrong': 0, 'shortage-missed': 0, 'parse-wrong': 0, timeout: 0 },
      rounds: 0, roundsFailed: 0, totalMs: 0, days: {}, rushHigh: 0,
    });
    customMenu.set(DEFAULT_MENU.map((m) => ({ ...m })));
  }
</script>

<main class="settings">
  <h2><button class="back" onclick={() => go('home')}>←</button> {$t('settings.title')}</h2>

  <label>
    {$t('settings.language')}
    <select bind:value={$settings.locale}>
      <option value="en">English</option>
      <option value="de">Deutsch</option>
    </select>
  </label>
  <label><input type="checkbox" bind:checked={$settings.sound} /> {$t('settings.sound')}</label>
  <label><input type="checkbox" bind:checked={$settings.symbolFirst} /> {$t('settings.symbol-first')}</label>

  <button class="danger" onclick={resetAll}>{$t('settings.reset')}</button>
</main>

<style>
  .settings { max-width: 480px; margin: 0 auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 1rem; }
  h2 { display: flex; align-items: center; gap: 0.5rem; }
  .back { background: none; color: var(--cream); font-size: 1.4rem; }
  label { display: flex; align-items: center; gap: 0.6rem; }
  select { font: inherit; padding: 0.4rem; border-radius: var(--radius); }
  input[type='checkbox'] { width: 24px; height: 24px; }
  .danger { background: var(--danger); color: var(--cream); margin-top: 1.5rem; }
</style>
```

- [ ] **Step 5: Verify + commit**

Run: `npm run dev` — add a drink `Spritz` at `3,80`, toggle "Play with my menu", start level 1, confirm the order sentences use the custom menu and prices are NOT rounded (custom menus keep real prices). Switch language to Deutsch, confirm UI + order sentences flip. Reset progress works after confirm dialog.

Run: `npx vitest run` — all green.

```bash
git add src/core/money.ts tests/core/money.test.ts src/routes/MenuEditor.svelte src/routes/Settings.svelte
git commit -m "feat: menu editor with custom prices, settings with reset"
```

---

### Task 18: Stats screen

**Files:**
- Modify: `src/routes/Stats.svelte` (replace placeholder)

**Interfaces:**
- Consumes: `stats`, `dayStreak` from `../stores/stats`; `t`; `go`.

- [ ] **Step 1: Implement Stats**

```svelte
<!-- src/routes/Stats.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { go } from '../lib/router';
  import { stats, dayStreak } from '../stores/stats';
  import type { RoundError } from '../core/round';

  const ERROR_KEYS: RoundError[] = [
    'sum-wrong', 'change-wrong', 'shortage-missed', 'parse-wrong', 'timeout',
  ];

  const avgSeconds = $derived(
    $stats.rounds === 0 ? 0 : Math.round($stats.totalMs / $stats.rounds / 100) / 10,
  );
  const streak = $derived(dayStreak($stats, new Date()));
  const worst = $derived.by(() => {
    const entries = ERROR_KEYS.map((k) => [k, $stats.errors[k]] as const);
    const max = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
    return max[1] > 0 ? max[0] : null;
  });
  const maxCount = $derived(Math.max(1, ...ERROR_KEYS.map((k) => $stats.errors[k])));
</script>

<main class="stats">
  <h2><button class="back" onclick={() => go('home')}>←</button> {$t('stats.title')}</h2>

  <dl>
    <div><dt>{$t('stats.rounds')}</dt><dd>{$stats.rounds}</dd></div>
    <div><dt>{$t('stats.avg')}</dt><dd>{avgSeconds}</dd></div>
    <div><dt>{$t('stats.streak')}</dt><dd>{streak} 🔥</dd></div>
    <div><dt>{$t('stats.rush-high')}</dt><dd>{$stats.rushHigh}</dd></div>
  </dl>

  <h3>{$t('stats.errors')}</h3>
  <ul>
    {#each ERROR_KEYS as k (k)}
      <li>
        <span>{$t(`stats.err.${k}`)}</span>
        <div class="bar"><div style="width: {($stats.errors[k] / maxCount) * 100}%"></div></div>
        <span class="count">{$stats.errors[k]}</span>
      </li>
    {/each}
  </ul>

  {#if worst}
    <p class="hint">{$t('stats.hint')}: <strong>{$t(`stats.err.${worst}`)}</strong></p>
  {/if}
</main>

<style>
  .stats { max-width: 480px; margin: 0 auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.75rem; }
  h2 { display: flex; align-items: center; gap: 0.5rem; }
  .back { background: none; color: var(--cream); font-size: 1.4rem; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
  dl div { background: var(--wood-light); border-radius: var(--radius); padding: 0.6rem; }
  dt { font-size: 0.8rem; opacity: 0.8; }
  dd { font-size: 1.4rem; font-weight: bold; }
  ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
  li { display: grid; grid-template-columns: 8rem 1fr 2rem; gap: 0.5rem; align-items: center; }
  .bar { height: 10px; background: rgb(0 0 0 / 0.35); border-radius: 5px; overflow: hidden; }
  .bar div { height: 100%; background: var(--danger); }
  .count { text-align: right; font-variant-numeric: tabular-nums; }
  .hint { color: var(--accent); }
</style>
```

- [ ] **Step 2: Verify + commit**

Run: `npm run dev` — play a few rounds including deliberate mistakes, open Stats, confirm counts, average, streak of 1, and the "weakest skill" hint match what you did.

```bash
git add src/routes/Stats.svelte
git commit -m "feat: stats screen with error breakdown and training hint"
```

---

### Task 19: PWA finish, README, final verification

**Files:**
- Modify: `src/main.ts`, `index.html`
- Create: `README.md`

- [ ] **Step 1: Register service worker + meta**

In `src/main.ts`, before mounting the app, add:

```ts
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });
```

If TypeScript complains about the virtual module, add to `src/vite-env.d.ts`:

```ts
/// <reference types="vite-plugin-pwa/client" />
```

In `index.html` `<head>`, set:

```html
<title>Orders, Please</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
<meta name="theme-color" content="#2b1d12" />
<link rel="icon" href="/icon.svg" type="image/svg+xml" />
```

- [ ] **Step 2: Write README.md**

```markdown
# Orders, Please

Bar mental-math trainer. Sum drink orders, take payment, give correct change
from a finite till — before the customer walks out.

- **Levels**: 30 levels ramping from single drinks with round prices to
  six-item orders, hidden menus, coin shortages and mid-order changes.
- **Rush**: endless Friday night. Three walkouts end the shift.
- **My menu**: enter your real bar's drinks and prices, train for your job.
- **Stats**: error breakdown per skill (sums, change, shortages, parsing, speed).

## Tech

Svelte 5 + Vite + TypeScript PWA. No backend; progress lives in localStorage.
Install from the browser on Android (or any phone) via "Add to Home Screen".

## Develop

    npm install
    npm run dev       # dev server
    npm test          # core logic test suite (Vitest)
    npm run build     # production build in dist/
    npm run preview   # serve the build (needed for service-worker testing)

Game rules live framework-free in `src/core/` — see
`docs/superpowers/specs/2026-08-25-orders-please-design.md` for the design.
```

- [ ] **Step 3: Full verification**

Run: `npx vitest run`
Expected: all suites green.

Run: `npm run build`
Expected: clean build; `dist/` contains `sw.js` and `manifest.webmanifest`.

Run: `npm run preview` — open on desktop: confirm the app is installable (install icon in the address bar), play one level, reload while offline (DevTools → Network → Offline) and confirm the app still loads.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts src/vite-env.d.ts index.html README.md
git commit -m "feat: PWA registration, meta, README"
```

---

## Verification checklist (whole plan)

- `npx vitest run` — all core + store suites pass.
- `npm run build` — clean production build.
- Manual: level 1 through win, level 20 shortage + ask, rush ends after 3 walkouts, custom menu round-trip, DE locale, offline reload after install.
