# Orders, Please — Round 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement round 4 per `docs/superpowers/specs/2026-08-25-orders-please-round4-design.md`: keynav geometry fix, 5-cent removal (10c grid), menu expansion with level-gated food, faster five-anchor difficulty with a real endgame, named levels, and coin-burst/coin-shower celebrations.

**Architecture:** Core-first: pure `nextIndex` navigation math, 9-denomination re-anchor across till/change/order, `MenuItem.category` + `menuForLevel` + `effectiveLevel`, five-anchor difficulty table, all TDD. UI: keynav wrapper, keyboard 1-9 map, menu-card food divider, editor category toggle, level names across map/header/overlay, `CoinBurst.svelte` + EndOverlay shower + `fanfare()`.

**Tech Stack:** unchanged — Svelte 5 (runes), Vite, TypeScript, Vitest, vite-plugin-pwa. No new runtime dependencies.

## Global Constraints

- All prior constraints hold: integer cents, core purity (no Svelte/DOM in `src/core/`), EN+DE for every UI string via `t()`, svelte-check 0 errors 0 warnings, build clean, suite green.
- DENOMS = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10] exactly; COIN_DENOMS = [200, 100, 50, 20, 10]. Prices are multiples of 10 (validateItem), minimum 10c; `'any'` price style step = 10.
- Saved custom menus migrate on load: `priceCents` → nearest 10 (min 10), missing `category` → `'drink'`; idempotent.
- Keyboard till map: keys 1-9 = DENOMS indices 0-8; key 0 inert in change phase; badges label 1-9.
- keynav navigates the FULL button list; disabled targets skipped in-direction; off-grid steps clamp to the farthest enabled button in that direction; Home/End go to first/last enabled.
- Default menu = the spec's 12-item table exactly (ids, EN/DE names, prices, categories). Food gate: `menuForLevel` includes food only when `level >= 10`; daily uses `dailyLevelFor(roundsDone)`; practice includes food only for sums/parsing drills.
- Difficulty anchors at 1/6/14/22/30 exactly per the spec table; gates underpay 6, tab 8, dispute 9, split 11 (exact 0 strictly below); practice base `paramsForLevel(12)`.
- Level names: i18n `level.name.1`..`level.name.30` in BOTH dictionaries, exactly the spec's table.
- Celebrations use `Math.random` only (NEVER `session.rng`); zero particles under `prefers-reduced-motion`; coin-burst trigger = success AND sumTries 0 AND changeTries 0 AND !usedHint AND patienceFrac > 0.5; shower trigger = 3-star win OR new rush high OR perfect daily.
- Every commit message ends with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01BFFLt2muz8HfETCzn4N1ok`

---

### Task 1: keynav geometry — pure nextIndex + wrapper

**Files:**
- Modify: `src/lib/keynav.ts`
- Test: `tests/lib/keynav.test.ts` (new)

**Interfaces:**
- Produces:

```ts
export function nextIndex(
  enabled: boolean[], current: number, key: string, cols: number,
): number | null;
// Arrow steps by ±1/±cols over the FULL grid; disabled targets are skipped
// by continuing in the same direction; off-grid steps clamp to the farthest
// enabled index in that direction; Home/End = first/last enabled; null = no move.
export function keynav(node: HTMLElement): { destroy(): void }; // unchanged signature
```

- [ ] **Step 1: Write failing tests**

```ts
// tests/lib/keynav.test.ts
import { describe, it, expect } from 'vitest';
import { nextIndex } from '../../src/lib/keynav';

const en = (n: number, disabledFrom = n) =>
  Array.from({ length: n }, (_, i) => i < disabledFrom);

describe('nextIndex', () => {
  it('moves right/left/down/up on a fully enabled grid', () => {
    const g = en(10); // 5 cols, 2 rows
    expect(nextIndex(g, 0, 'ArrowRight', 5)).toBe(1);
    expect(nextIndex(g, 1, 'ArrowLeft', 5)).toBe(0);
    expect(nextIndex(g, 2, 'ArrowDown', 5)).toBe(7);
    expect(nextIndex(g, 7, 'ArrowUp', 5)).toBe(2);
  });
  it('skips disabled targets in the same direction', () => {
    const g = [true, false, false, true];
    expect(nextIndex(g, 0, 'ArrowRight', 4)).toBe(3);
  });
  it('levels-map case: Down from row 1 clamps to the last enabled button', () => {
    // 30 cells, 5 cols, only first 3 unlocked
    const g = en(30, 3);
    expect(nextIndex(g, 0, 'ArrowDown', 5)).toBe(2);
    expect(nextIndex(g, 2, 'ArrowDown', 5)).toBe(null); // already at the last enabled
  });
  it('Up clamps toward the first enabled button', () => {
    const g = en(30, 3);
    expect(nextIndex(g, 2, 'ArrowUp', 5)).toBe(0); // -5 off-grid → clamp direction up
  });
  it('Home/End jump to first/last enabled', () => {
    const g = [false, true, true, false];
    expect(nextIndex(g, 2, 'Home', 1)).toBe(1);
    expect(nextIndex(g, 1, 'End', 1)).toBe(2);
  });
  it('null when nothing to do', () => {
    expect(nextIndex([true], 0, 'ArrowRight', 1)).toBe(null);
    expect(nextIndex([], 0, 'ArrowDown', 1)).toBe(null);
    expect(nextIndex([true, true], 5, 'ArrowLeft', 1)).toBe(null); // out-of-range current
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/keynav.test.ts`
Expected: FAIL — `nextIndex` not exported.

- [ ] **Step 3: Implement**

Replace `src/lib/keynav.ts`:

```ts
/** Pure grid-navigation math over a full button list (disabled included). */
export function nextIndex(
  enabled: boolean[], current: number, key: string, cols: number,
): number | null {
  const n = enabled.length;
  if (n === 0 || current < 0 || current >= n) return null;
  if (key === 'Home') {
    const i = enabled.indexOf(true);
    return i === -1 || i === current ? null : i;
  }
  if (key === 'End') {
    const i = enabled.lastIndexOf(true);
    return i === -1 || i === current ? null : i;
  }
  const step = key === 'ArrowRight' ? 1
    : key === 'ArrowLeft' ? -1
    : key === 'ArrowDown' ? cols
    : key === 'ArrowUp' ? -cols
    : 0;
  if (step === 0) return null;
  const dir = step > 0 ? 1 : -1;
  let i = current + step;
  while (i >= 0 && i < n && !enabled[i]) i += dir;
  if (i >= 0 && i < n) return i;
  // ran off the grid: clamp to the farthest enabled cell in that direction
  let clamp: number | null = null;
  for (let j = current + dir; j >= 0 && j < n; j += dir) {
    if (enabled[j]) clamp = j;
  }
  return clamp === current ? null : clamp;
}

/** Arrow navigation action; geometry matches the rendered grid. */
export function keynav(node: HTMLElement) {
  function cols(): number {
    const el = (document.activeElement as HTMLElement | null) ?? node;
    const v = getComputedStyle(el).getPropertyValue('--keynav-cols').trim();
    return v ? Number(v) : 1;
  }
  function onKeydown(e: KeyboardEvent) {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const all = [...node.querySelectorAll<HTMLButtonElement>('button')];
    const current = all.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;
    const next = nextIndex(all.map((b) => !b.disabled), current, e.key, cols());
    if (next === null) return;
    e.preventDefault();
    all[next].focus();
  }
  node.addEventListener('keydown', onKeydown);
  return { destroy: () => node.removeEventListener('keydown', onKeydown) };
}
```

- [ ] **Step 4: Run tests, full suite, gates**

Run: `npx vitest run tests/lib/keynav.test.ts` — 6 passed. `npx vitest run` green (149). `npm run check` 0/0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/keynav.ts tests/lib/keynav.test.ts
git commit -m "fix: arrow navigation matches the rendered grid, skips locked levels"
```

---

### Task 2: remove 5-cent coins — core + tests re-anchor

**Files:**
- Modify: `src/core/till.ts`, `src/core/menu.ts` (validateItem, STEP), `src/i18n/en.ts`, `src/i18n/de.ts` (error.price-invalid text), `tests/core/till.test.ts`, `tests/core/order.test.ts`, `tests/core/round.test.ts`, `tests/core/menu.test.ts`
- Test: the re-anchored suites above

**Interfaces:**
- Produces: `DENOMS = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10]`, `COIN_DENOMS = [200, 100, 50, 20, 10]`; `validateItem` requires `% 10 === 0`; `STEP.any = 10`. `generateUnderPayment` needs NO code change (its `below[0] ?? []` fallback is denomination-generic).

- [ ] **Step 1: Re-anchor the tests (RED)**

`tests/core/till.test.ts`:
- denominations test: `expect([...DENOMS]).toEqual([5000, 2000, 1000, 500, 200, 100, 50, 20, 10]);` and `expect([...COIN_DENOMS]).toEqual([200, 100, 50, 20, 10]);`
- tillTotal fixture: `expect(tillTotal({ 200: 2, 10: 3 })).toBe(430);`
- remove/add fixture pieces `[200, 200, 5]` → `[200, 200, 10]` (both occurrences, and the `t2[5]`/`t[5]` index assertions become `[10]`).
- fullTill test loops DENOMS — unchanged.

`tests/core/order.test.ts`:
- fuzz totals: `const total = 10 * (1 + Math.floor(rng() * 1000));` (both the payment-coverage fuzz and any other `5 * (...)` totals).
- underpay minimum test: `generateUnderPayment(10, mulberry32(1))` → expects `[]`; rename title to “minimum-denom total yields an empty (obviously short) payment”.
- underpay fuzz range: `const total = 10 * (1 + Math.floor(rng() * 1000));`.

`tests/core/round.test.ts`:
- shortage-till fixtures `{ ...fullTill(), 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 }` → drop the `5: 0` key (two occurrences).

`tests/core/menu.test.ts`:
- validateItem: `validateItem('Beer', 401)` stays invalid; ADD `expect(validateItem('Beer', 405)).toBe('error.price-invalid');` (5-multiples now invalid) and `expect(validateItem('Beer', 410)).toBeNull();`
- applyPriceStyle `'any'`: `expect(applyPriceStyle(menu, 'any')[0].priceCents).toBe(430);` stays; the zero-clamp test `priceCents: 40` with `'round'` unchanged; ADD `'any'` min-clamp: `expect(applyPriceStyle([{ id: 'x', name: 'X', priceCents: 4 }], 'any')[0].priceCents).toBe(10);`

Run: `npx vitest run tests/core` — re-anchored tests FAIL against the old constants.

- [ ] **Step 2: Implement core changes**

`src/core/till.ts`:

```ts
export const DENOMS = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10] as const;
export const NOTE_DENOMS = [5000, 2000, 1000, 500] as const;
export const COIN_DENOMS = [200, 100, 50, 20, 10] as const;
```

`src/core/menu.ts`:

```ts
  if (!Number.isInteger(priceCents) || priceCents <= 0 || priceCents % 10 !== 0)
    return 'error.price-invalid';
```

```ts
const STEP: Record<PriceStyle, number> = { round: 100, half: 50, tens: 10, any: 10 };
```

i18n: `error.price-invalid` becomes EN `'Price must be a positive multiple of 10 cents'`, DE `'Preis muss ein positives Vielfaches von 10 Cent sein'`.

- [ ] **Step 3: Full suite green + gates**

Run: `npx vitest run` — everything passes (change.test needs no edits: its fixtures use 10+; if anything else fails, it is an overlooked 5c anchor — fix the TEST expectation to the 10c grid, never bend core logic). `npm run check` 0/0; `npm run build` ok.

- [ ] **Step 4: Commit**

```bash
git add src/core/till.ts src/core/menu.ts src/i18n tests/core
git commit -m "feat: remove 5-cent coins, prices on the 10-cent grid"
```

---

### Task 3: keyboard 1-9 till map

**Files:**
- Modify: `src/routes/Game.svelte` (onKey change branch), `src/lib/TillGrid.svelte` (badge label)

**Interfaces:**
- Consumes: 9-entry DENOMS from Task 2.
- Produces: change-phase keys 1-9 → `DENOMS[k-1]`; key 0 inert; badges `String(i + 1)`.

- [ ] **Step 1: Game onKey**

In the change-phase digit branch, replace the index mapping:

```ts
      if (/^[0-9]$/.test(k)) {
        if (round.changeDue === 0) return; // Finish rounds: till is disabled for keys too
        if (k === '0') return; // only 9 denominations
        take(DENOMS[Number(k) - 1]);
        e.preventDefault();
      }
```

(The zero-change guard already exists — keep its position first.)

- [ ] **Step 2: TillGrid badge**

Change `keyBadge={showKeys ? String((i + 1) % 10) : null}` to `keyBadge={showKeys ? String(i + 1) : null}`.

- [ ] **Step 3: Verify + commit**

Run: `npm run check` 0/0; `npx vitest run` green; `npm run build` ok.

```bash
git add src/routes/Game.svelte src/lib/TillGrid.svelte
git commit -m "feat: till keyboard map 1-9 for nine denominations"
```

---

### Task 4: menu expansion core — category, 12-item menu, gating, migration

**Files:**
- Modify: `src/core/menu.ts`, `src/stores/menu.ts`
- Test: `tests/core/menu.test.ts` (extend), `tests/stores/menu.test.ts` (extend)

**Interfaces:**
- Produces:

```ts
// core/menu.ts
export interface MenuItem { id: string; name: string; priceCents: Cents; category?: 'drink' | 'food'; }
// category is OPTIONAL: absent means 'drink'. This keeps every existing test
// fixture and the MenuEditor compiling; menuForLevel and the editor treat
// undefined as 'drink', and migrateMenuItems fills it in for stored menus.
export const DEFAULT_MENU: MenuItem[]; // the spec's 12-item table, in table order
export function localizedDefaultMenu(locale: 'en' | 'de'): MenuItem[]; // DE names incl. Hugo/Hefe/Schnaps/Wurst/Hähnchen/Schnitzel
export function menuForLevel(menu: MenuItem[], level: number): MenuItem[]; // food only when level >= 10
export function migrateMenuItems(items: MenuItem[]): MenuItem[];
// category ?? 'drink'; priceCents → max(10, round(p/10)*10); idempotent

// stores/menu.ts — customMenu runs migrateMenuItems once at module init (persists back)
```

- [ ] **Step 1: Write failing tests**

Append to `tests/core/menu.test.ts`:

```ts
import { menuForLevel, migrateMenuItems } from '$core/menu';

describe('round-4 menu', () => {
  it('default menu has 12 items with the spec prices and categories', () => {
    const byId = Object.fromEntries(DEFAULT_MENU.map((m) => [m.id, m]));
    expect(DEFAULT_MENU.length).toBe(12);
    expect(byId['hugo']).toMatchObject({ priceCents: 450, category: 'drink' });
    expect(byId['hefe']).toMatchObject({ name: 'Wheat Beer', priceCents: 420, category: 'drink' });
    expect(byId['schnaps']).toMatchObject({ name: 'Schnapps', priceCents: 300 });
    expect(byId['wurst']).toMatchObject({ name: 'Sausage', priceCents: 350, category: 'food' });
    expect(byId['haehnchen']).toMatchObject({ priceCents: 850, category: 'food' });
    expect(byId['schnitzel']).toMatchObject({ priceCents: 1050, category: 'food' });
  });
  it('DE names for the new items', () => {
    const de = Object.fromEntries(localizedDefaultMenu('de').map((m) => [m.id, m.name]));
    expect(de['hefe']).toBe('Hefe');
    expect(de['schnaps']).toBe('Schnaps');
    expect(de['wurst']).toBe('Wurst');
    expect(de['haehnchen']).toBe('Hähnchen');
    expect(de['schnitzel']).toBe('Schnitzel');
  });
  it('menuForLevel gates food at level 10', () => {
    expect(menuForLevel(DEFAULT_MENU, 9).every((m) => m.category === 'drink')).toBe(true);
    expect(menuForLevel(DEFAULT_MENU, 9).length).toBe(9);
    expect(menuForLevel(DEFAULT_MENU, 10).length).toBe(12);
  });
  it('migrateMenuItems rounds prices to 10 and defaults category, idempotently', () => {
    const legacy = [{ id: 'x', name: 'X', priceCents: 435 }];
    const once = migrateMenuItems(legacy);
    expect(once[0]).toMatchObject({ priceCents: 440, category: 'drink' });
    expect(migrateMenuItems(once)).toEqual(once);
    expect(migrateMenuItems([{ id: 'y', name: 'Y', priceCents: 4 }])[0].priceCents).toBe(10);
  });
});
```

Append to `tests/stores/menu.test.ts`:

```ts
it('customMenu migrates legacy 5c prices on load', () => {
  customMenu.set([{ id: 'x', name: 'X', priceCents: 435 }]);
  // simulate the module-init migration path
  customMenu.update((items) => migrateMenuItems(items));
  const items = get(customMenu);
  expect(items[0].priceCents).toBe(440);
  expect(items[0].category).toBe('drink');
});
```

(No cast needed — `category` is optional on `MenuItem`.)

with `import { migrateMenuItems } from '../../src/core/menu';` added to that file's imports.

Run: `npx vitest run tests/core/menu.test.ts tests/stores/menu.test.ts` — FAIL.

- [ ] **Step 2: Implement core**

In `src/core/menu.ts`: add `category?: 'drink' | 'food';` (OPTIONAL — see Interfaces) to `MenuItem`; replace `DEFAULT_MENU` with the 12-item table (order per spec):

```ts
export const DEFAULT_MENU: MenuItem[] = [
  { id: 'beer', name: 'Beer', priceCents: 400, category: 'drink' },
  { id: 'veneziano', name: 'Veneziano', priceCents: 500, category: 'drink' },
  { id: 'water', name: 'Water', priceCents: 250, category: 'drink' },
  { id: 'cola', name: 'Cola', priceCents: 300, category: 'drink' },
  { id: 'wine', name: 'Wine', priceCents: 450, category: 'drink' },
  { id: 'coffee', name: 'Coffee', priceCents: 200, category: 'drink' },
  { id: 'hugo', name: 'Hugo', priceCents: 450, category: 'drink' },
  { id: 'hefe', name: 'Wheat Beer', priceCents: 420, category: 'drink' },
  { id: 'schnaps', name: 'Schnapps', priceCents: 300, category: 'drink' },
  { id: 'wurst', name: 'Sausage', priceCents: 350, category: 'food' },
  { id: 'haehnchen', name: 'Roast Chicken', priceCents: 850, category: 'food' },
  { id: 'schnitzel', name: 'Schnitzel', priceCents: 1050, category: 'food' },
];
```

Extend `DE_NAMES`:

```ts
const DE_NAMES: Record<string, string> = {
  beer: 'Bier', veneziano: 'Veneziano', water: 'Wasser',
  cola: 'Cola', wine: 'Wein', coffee: 'Kaffee',
  hugo: 'Hugo', hefe: 'Hefe', schnaps: 'Schnaps',
  wurst: 'Wurst', haehnchen: 'Hähnchen', schnitzel: 'Schnitzel',
};
```

Append:

```ts
/** Food joins the bar from level 10; below that, drinks only. */
export function menuForLevel(menu: MenuItem[], level: number): MenuItem[] {
  return level >= 10 ? menu : menu.filter((m) => m.category !== 'food');
}

/** Legacy stored menus: default category, snap prices to the 10c grid. Idempotent. */
export function migrateMenuItems(items: MenuItem[]): MenuItem[] {
  return items.map((m) => ({
    id: m.id,
    name: m.name,
    priceCents: Math.max(10, Math.round(m.priceCents / 10) * 10),
    category: m.category ?? 'drink',
  }));
}
```

- [ ] **Step 3: Store migration**

In `src/stores/menu.ts`, after the `customMenu` declaration add:

```ts
// one-time, idempotent normalization of legacy saved menus (5c prices, no category)
customMenu.update(migrateMenuItems);
```

with `migrateMenuItems` joining the core-menu import.

- [ ] **Step 4: Full suite + gates + commit**

Run: `npx vitest run` (fix any straggler fixture that assumed a 6-item default: `localizedDefaultMenu('de')` name-list test in menu.test.ts must extend to the 12 names in order — update it: `['Bier','Veneziano','Wasser','Cola','Wein','Kaffee','Hugo','Hefe','Schnaps','Wurst','Hähnchen','Schnitzel']`). `npm run check` 0/0; `npm run build` ok.

```bash
git add src/core/menu.ts src/stores/menu.ts tests/core/menu.test.ts tests/stores/menu.test.ts
git commit -m "feat: 12-item menu with categories, food gate, legacy migration"
```

---

### Task 5: food gating in play + menu card divider + editor toggle

**Files:**
- Modify: `src/core/session.ts` (effectiveLevel), `src/routes/Game.svelte`, `src/lib/MenuCard.svelte`, `src/routes/MenuEditor.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`
- Test: `tests/core/session.test.ts` (extend)

**Interfaces:**
- Produces:

```ts
// session.ts
export function effectiveLevel(s: SessionState): number;
// daily → dailyLevelFor(s.roundsDone); every other mode → s.level

// Game.svelte derived
const visibleMenu = $derived(
  mode === 'practice'
    ? menuForLevel(session.menu, skill === 'sums' || skill === 'parsing' ? 10 : 1)
    : menuForLevel(session.menu, effectiveLevel(session)),
);
// used for ALL order/tab generation AND the MenuCard display.

// MenuCard props gain nothing; it renders a divider row before the first food item.
// MenuEditor: per-item category toggle (🍺/🍽 button cycling drink↔food) + new items via a category select.
```

- [ ] **Step 1: session test + effectiveLevel**

Append to `tests/core/session.test.ts`:

```ts
import { effectiveLevel } from '$core/session';

describe('effectiveLevel', () => {
  it('daily follows the ramp; others report session.level', () => {
    const lvl = createSession('level', 7, DEFAULT_MENU, false, 1);
    expect(effectiveLevel(lvl)).toBe(7);
    const override = { ...paramsForLevel(dailyLevelFor(0)), ordersPerLevel: 10 };
    let d = createSession('daily', 1, DEFAULT_MENU, false, 20260825, override);
    expect(effectiveLevel(d)).toBe(dailyLevelFor(0));
    if (d.queue.length === 0) d = spawnCustomer(d);
    d = completeRound(d, winRound(d), { orderText: 'x', ms: 500 });
    expect(effectiveLevel(d)).toBe(dailyLevelFor(1));
  });
});
```

Run to see it fail, then add to `src/core/session.ts`:

```ts
/** The level that gates content (food) right now. */
export function effectiveLevel(s: SessionState): number {
  return s.mode === 'daily' ? dailyLevelFor(s.roundsDone) : s.level;
}
```

Run: session tests green.

- [ ] **Step 2: Game wiring**

In `src/routes/Game.svelte`: import `menuForLevel` (core/menu) and `effectiveLevel` (core/session); add the `visibleMenu` derived from Interfaces above; replace `session.menu` with `visibleMenu` in BOTH generation call sites (`generateOrder(...)` in `startRound`, `generateTab(...)`) and in the `<MenuCard menu={...}>` prop. (`nextPayer` regenerates nothing menu-based — payer groups come from the already-generated order.)

- [ ] **Step 3: MenuCard divider**

Replace the list body in `src/lib/MenuCard.svelte`:

```svelte
  {#if !collapsed}
    <ul>
      {#each menu as item, i (item.id)}
        {#if item.category === 'food' && (i === 0 || menu[i - 1].category !== 'food')}
          <li class="divider">{$t('menu.food-header')}</li>
        {/if}
        <li>
          <span>{item.name}</span>
          <span class="dots"></span>
          <span class="price">{pricesHidden ? '?,?? €' : formatEuro(item.priceCents, symbolFirst)}</span>
        </li>
      {/each}
    </ul>
  {/if}
```

with `import { t } from '../i18n';` added and style `.divider { font-weight: bold; border-top: 1px solid rgb(42 33 24 / 0.3); margin-top: 0.3rem; padding-top: 0.3rem; }`.

- [ ] **Step 4: MenuEditor category toggle**

In `src/routes/MenuEditor.svelte`:
- List rows gain a toggle before the delete button:

```svelte
        <button class="cat" onclick={() => toggleCategory(item.id)}>
          {item.category === 'food' ? '🍽' : '🍺'}
        </button>
```

```ts
  function toggleCategory(id: string) {
    customMenu.update((m) => m.map((x) =>
      x.id === id ? { ...x, category: x.category === 'food' ? 'drink' : 'food' } : x,
    ));
  }
```

- `add()` creates items with `category: newCategory` where `let newCategory = $state<'drink' | 'food'>('drink');` and the add-row gains a matching toggle button before the Add button:

```svelte
    <button class="cat" onclick={() => (newCategory = newCategory === 'food' ? 'drink' : 'food')}>
      {newCategory === 'food' ? '🍽' : '🍺'}
    </button>
```

Style: `.cat { background: var(--wood-light); min-width: 44px; }`

i18n additions — en: `'menu.food-header': 'Food',`; de: `'menu.food-header': 'Essen',`.

- [ ] **Step 5: Verify + commit**

Run: `npx vitest run` green; `npm run check` 0/0; `npm run build` ok.

```bash
git add src/core/session.ts src/routes/Game.svelte src/lib/MenuCard.svelte src/routes/MenuEditor.svelte src/i18n tests/core/session.test.ts
git commit -m "feat: level-gated food in play, menu divider, editor categories"
```

---

### Task 6: faster difficulty — five anchors + endgame

**Files:**
- Modify: `src/core/difficulty.ts`, `tests/core/difficulty.test.ts`, `tests/core/order.test.ts` (level-10 bounds)

**Interfaces:**
- Produces: ANCHORS at 1/6/14/22/30 per the spec table; gates underpay 6 / dispute 9 / tab 8 / split 11; `practiceParams` base `paramsForLevel(12)`. `paramsForLevel`'s segment scan already handles any anchor list.

- [ ] **Step 1: Rewrite anchored tests (RED)**

In `tests/core/difficulty.test.ts`:
- The L1 test keeps its current values EXCEPT `ordersPerLevel` stays 6 — unchanged, verify.
- Replace the "mid-game arrives earlier" test with:

```ts
  it('anchors at L6 and L22 per spec', () => {
    const p6 = paramsForLevel(6);
    expect(p6.patienceSeconds).toBe(28);
    expect(p6.ordersPerLevel).toBe(8);
    expect(p6.underpayProb).toBeCloseTo(0.08);
    const p22 = paramsForLevel(22);
    expect(p22.patienceSeconds).toBe(15);
    expect(p22.tabProb).toBeCloseTo(0.25);
  });
  it('L30 endgame', () => {
    const p = paramsForLevel(30);
    expect(p.itemsMax).toBe(7);
    expect(p.patienceSeconds).toBe(12);
    expect(p.scarceDenoms).toBe(4);
    expect(p.midOrderChangeProb).toBeCloseTo(0.4);
    expect(p.underpayProb).toBeCloseTo(0.25);
    expect(p.disputeProb).toBeCloseTo(0.25);
    expect(p.tabProb).toBeCloseTo(0.3);
    expect(p.splitProb).toBeCloseTo(0.25);
  });
```

- The old L30 test asserting patience 15 / itemsMax 6 / probs .2/.2/.25/.2 must be DELETED (superseded by the L22+L30 tests above).
- Entry-gate boundaries become:

```ts
    expect(paramsForLevel(5).underpayProb).toBe(0);
    expect(paramsForLevel(6).underpayProb).toBeGreaterThan(0);
    expect(paramsForLevel(8).disputeProb).toBe(0);
    expect(paramsForLevel(9).disputeProb).toBeGreaterThan(0);
    expect(paramsForLevel(7).tabProb).toBe(0);
    expect(paramsForLevel(8).tabProb).toBeGreaterThan(0);
    expect(paramsForLevel(10).splitProb).toBe(0);
    expect(paramsForLevel(11).splitProb).toBeGreaterThan(0);
```

In `tests/core/order.test.ts`, the generateOrder bounds test uses `paramsForLevel(10)` (segment 6→14, t=0.5 → itemsMin round(2.5)=3, itemsMax round(4)=4): change its expectations to `toBeGreaterThanOrEqual(3)` / `toBeLessThanOrEqual(4)` and update its comment.

Run: `npx vitest run tests/core/difficulty.test.ts tests/core/order.test.ts` — FAIL against the old table.

- [ ] **Step 2: Implement**

Replace ANCHORS in `src/core/difficulty.ts`:

```ts
const ANCHORS: Anchor[] = [
  { level: 1,  itemsMin: 1, itemsMax: 2, priceStyle: 'half', paymentStyle: 'exact-or-round',
    patienceSeconds: 35, menuVisibleSeconds: null, scarceDenoms: 0, midOrderChangeProb: 0,
    showPileTotal: true,  ordersPerLevel: 6,
    underpayProb: 0, disputeProb: 0, tabProb: 0, splitProb: 0 },
  { level: 6,  itemsMin: 2, itemsMax: 3, priceStyle: 'tens', paymentStyle: 'round',
    patienceSeconds: 28, menuVisibleSeconds: 5,    scarceDenoms: 1, midOrderChangeProb: 0.1,
    showPileTotal: true,  ordersPerLevel: 8,
    underpayProb: 0.08, disputeProb: 0, tabProb: 0, splitProb: 0 },
  { level: 14, itemsMin: 3, itemsMax: 5, priceStyle: 'any',  paymentStyle: 'awkward',
    patienceSeconds: 20, menuVisibleSeconds: 3,    scarceDenoms: 2, midOrderChangeProb: 0.25,
    showPileTotal: false, ordersPerLevel: 10,
    underpayProb: 0.15, disputeProb: 0.12, tabProb: 0.18, splitProb: 0.12 },
  { level: 22, itemsMin: 4, itemsMax: 6, priceStyle: 'any',  paymentStyle: 'awkward',
    patienceSeconds: 15, menuVisibleSeconds: 0,    scarceDenoms: 3, midOrderChangeProb: 0.35,
    showPileTotal: false, ordersPerLevel: 12,
    underpayProb: 0.2, disputeProb: 0.2, tabProb: 0.25, splitProb: 0.2 },
  { level: 30, itemsMin: 5, itemsMax: 7, priceStyle: 'any',  paymentStyle: 'awkward',
    patienceSeconds: 12, menuVisibleSeconds: 0,    scarceDenoms: 4, midOrderChangeProb: 0.4,
    showPileTotal: false, ordersPerLevel: 12,
    underpayProb: 0.25, disputeProb: 0.25, tabProb: 0.3, splitProb: 0.25 },
];
```

Gates:

```ts
  result.underpayProb = gated(lerp(lo.underpayProb, hi.underpayProb, t), 6);
  result.disputeProb = gated(lerp(lo.disputeProb, hi.disputeProb, t), 9);
  result.tabProb = gated(lerp(lo.tabProb, hi.tabProb, t), 8);
  result.splitProb = gated(lerp(lo.splitProb, hi.splitProb, t), 11);
```

`practiceParams` base: `paramsForLevel(12)`.

- [ ] **Step 3: Whole suite green**

Run: `npx vitest run` — repair any remaining old-anchor expectation by re-deriving from the new table (print the actual value, verify by hand, then assert it — never blind-copy). `npm run check` 0/0.

- [ ] **Step 4: Commit**

```bash
git add src/core/difficulty.ts tests/core/difficulty.test.ts tests/core/order.test.ts
git commit -m "feat: faster five-anchor difficulty with a real endgame"
```

---

### Task 7: level names

**Files:**
- Modify: `src/i18n/en.ts`, `src/i18n/de.ts`, `src/routes/Levels.svelte`, `src/routes/Game.svelte` (header), `src/lib/EndOverlay.svelte`
- Test: `tests/core/level-names.test.ts` (new — dictionary completeness)

**Interfaces:**
- Produces: i18n `level.name.1`..`level.name.30` in both dictionaries (spec table verbatim); Levels map shows the name under the number; Game level-mode header shows `` `${level} · ${$t(`level.name.${level}`)}` ``; EndOverlay gains optional `levelName?: string | null` shown under the title when won.

- [ ] **Step 1: Completeness test (RED)**

```ts
// tests/core/level-names.test.ts
import { describe, it, expect } from 'vitest';
import en from '../../src/i18n/en';
import de from '../../src/i18n/de';

describe('level names', () => {
  it('all 30 names exist in both dictionaries', () => {
    for (let l = 1; l <= 30; l++) {
      expect(en[`level.name.${l}`], `en ${l}`).toBeTruthy();
      expect(de[`level.name.${l}`], `de ${l}`).toBeTruthy();
    }
  });
  it('spot checks match the spec', () => {
    expect(en['level.name.1']).toBe('First Shift');
    expect(de['level.name.7']).toBe('Stammtisch');
    expect(en['level.name.10']).toBe("Kitchen's Open");
    expect(de['level.name.30']).toBe('Barlegende');
  });
});
```

Run: FAIL.

- [ ] **Step 2: Add the 60 keys**

Add to `src/i18n/en.ts` and `src/i18n/de.ts` the full table from the spec (`docs/superpowers/specs/2026-08-25-orders-please-round4-design.md` § Level Names) as `'level.name.<n>': '<name>'` entries — all 30 per file, copied exactly (watch `Freitag der 13.` and `Kitchen's Open`'s apostrophe).

Run: test green.

- [ ] **Step 3: Display wiring**

`src/routes/Levels.svelte` — inside the level button, under the stars span:

```svelte
        <span class="lname">{$t(`level.name.${l}`)}</span>
```

with style `.lname { font-size: 0.55rem; opacity: 0.75; line-height: 1.1; text-align: center; }` (and the button's `aspect-ratio: 1` may become `min-height: 64px` if names clip — implementer judgment, note it in the report).

`src/routes/Game.svelte` header level-mode branch becomes:

```svelte
    <span>{mode === 'level' ? `${level} · ${$t(`level.name.${level}`)}`
```

`src/lib/EndOverlay.svelte`: add `levelName = null` (`levelName?: string | null`) to props; under the `<h2>` add `{#if levelName && session.finished === 'won'}<p class="lvlname">{levelName}</p>{/if}` with style `.lvlname { opacity: 0.8; font-style: italic; }`. Game passes `levelName={mode === 'level' ? $t(`level.name.${level}`) : null}`.

- [ ] **Step 4: Verify + commit**

Run: `npx vitest run` green; `npm run check` 0/0; `npm run build` ok.

```bash
git add src/i18n src/routes/Levels.svelte src/routes/Game.svelte src/lib/EndOverlay.svelte tests/core/level-names.test.ts
git commit -m "feat: every level has a name, shown on map, header, and win screen"
```

---

### Task 8: celebrations — coin burst, coin shower, fanfare

**Files:**
- Create: `src/lib/CoinBurst.svelte`
- Modify: `src/lib/sound.ts` (fanfare), `src/routes/Game.svelte`, `src/lib/EndOverlay.svelte`

**Interfaces:**
- Produces: `CoinBurst` props `{ burstKey: number }` (retriggers on increment; no particles under reduced motion); `fanfare(enabled: boolean)` in sound.ts; EndOverlay prop `celebrate?: boolean` (coin shower behind content when true); Game state `burstKey`, `bigWin`.
- Triggers (Global Constraints): burst = success && sumTries 0 && changeTries 0 && !usedHint && patienceFrac > 0.5; shower/fanfare = stars === 3 (level won) || wasNewHigh (rush) || perfect daily.

- [ ] **Step 1: CoinBurst component**

```svelte
<!-- src/lib/CoinBurst.svelte -->
<script lang="ts">
  let { burstKey }: { burstKey: number } = $props();

  const reduced = typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  interface Particle { id: number; dx: number; dy: number; rot: number; delay: number; }
  let parts = $state<Particle[]>([]);

  $effect(() => {
    if (burstKey === 0 || reduced) return;
    const n = 8 + Math.floor(Math.random() * 5);
    parts = Array.from({ length: n }, (_, i) => ({
      id: burstKey * 100 + i,
      dx: (Math.random() - 0.5) * 240,
      dy: -60 - Math.random() * 140,
      rot: (Math.random() - 0.5) * 540,
      delay: Math.random() * 0.1,
    }));
    const t = setTimeout(() => (parts = []), 1000);
    return () => clearTimeout(t);
  });
</script>

{#each parts as p (p.id)}
  <span class="coin-part"
    style="--dx:{p.dx}px; --dy:{p.dy}px; --rot:{p.rot}deg; animation-delay:{p.delay}s"></span>
{/each}

<style>
  .coin-part {
    position: fixed; left: 50%; bottom: 18%;
    width: 22px; height: 22px; border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #f0c96a, #c9962e);
    border: 2px solid rgb(0 0 0 / 0.25);
    pointer-events: none; z-index: 50;
    animation: coin-burst 0.9s cubic-bezier(0.2, 0.6, 0.3, 1) both;
  }
  @keyframes coin-burst {
    from { transform: translate(0, 0) rotate(0); opacity: 1; }
    70% { opacity: 1; }
    to { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; }
  }
</style>
```

- [ ] **Step 2: fanfare in sound.ts**

Append:

```ts
export function fanfare(enabled: boolean): void {
  if (!enabled) return;
  try {
    tone(1200, 0.1, 0.07, 'square');
    tone(1500, 0.1, 0.07, 'square', 0.1);
    tone(1800, 0.3, 0.08, 'square', 0.2);
  } catch { /* silent */ }
}
```

- [ ] **Step 3: Game triggers**

In `src/routes/Game.svelte`:

```ts
  import CoinBurst from '../lib/CoinBurst.svelte';
  import { patienceFrac } from '../core/session';   // extend the session import
  // fanfare joins the sound import
  let burstKey = $state(0);
  let bigWin = $state(false);
```

In `finishRound()`, before `session = completeRound(...)` capture the patience: `const frac = patienceFrac(session);` — then after the completeRound/hint-debt block:

```ts
    if (!failed && done.sumTries === 0 && done.changeTries === 0
        && !done.usedHint && frac > 0.5) {
      burstKey += 1;
    }
```

In `finalize()`, after the existing branches:

```ts
    bigWin = (session.mode === 'level' && session.finished === 'won' && stars === 3)
      || (session.mode === 'rush' && wasNewHigh)
      || (session.mode === 'daily' && session.roundLog.filter((e) => !e.sub).every((e) => e.success)
          && session.roundLog.filter((e) => !e.sub).length >= DAILY_ORDERS);
    if (bigWin) fanfare($settings.sound);
```

Reset `burstKey = 0; bigWin = false;` in `restart()`. Mount `<CoinBurst {burstKey} />` just before the flash markup, and pass `celebrate={bigWin}` to `<EndOverlay ...>`.

- [ ] **Step 4: EndOverlay shower**

Add `celebrate = false` (`celebrate?: boolean`) to props. Behind the content (first child of `.overlay`):

```svelte
  {#if celebrate && !reduced}
    <div class="shower" aria-hidden="true">
      {#each rain as r (r.id)}
        <span class="drop" style="--x:{r.x}%; --d:{r.delay}s; --t:{r.dur}s"></span>
      {/each}
    </div>
  {/if}
```

```ts
  const reduced = typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rain = Array.from({ length: 20 }, (_, i) => ({
    id: i, x: Math.random() * 100, delay: Math.random() * 0.8, dur: 1 + Math.random() * 0.5,
  }));
```

```css
  .shower { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .drop {
    position: absolute; top: -30px; left: var(--x);
    width: 18px; height: 18px; border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #f0c96a, #c9962e);
    border: 2px solid rgb(0 0 0 / 0.25);
    animation: coin-drop var(--t) linear var(--d) both;
  }
  @keyframes coin-drop {
    to { transform: translateY(110vh) rotate(360deg); }
  }
```

(`.overlay` gains `overflow: hidden;` if not already clipping.)

- [ ] **Step 5: Verify + commit**

Run: `npm run check` 0/0; `npx vitest run` green; `npm run build` ok.

```bash
git add src/lib/CoinBurst.svelte src/lib/sound.ts src/routes/Game.svelte src/lib/EndOverlay.svelte
git commit -m "feat: coin burst on perfect rounds, coin shower and fanfare on big wins"
```

---

### Task 9: final verification + README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README updates**

- The keyboard bullet's till sentence becomes: "number keys 1-9 grab coins from the till".
- Add one bullet after the existing feature list:

```markdown
- **A real menu**: nine drinks plus Wurst, Hähnchen, and Schnitzel once the
  kitchen opens at level 10 — every one of the 30 named shifts, from First
  Shift to Bar Legend, gets harder faster.
```

- [ ] **Step 2: Full verification**

Run: `npx vitest run` — all green (~155). `npm run check` — 0/0. `npm run build` — clean.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: round-4 menu, named levels, key map in README"
```

---

## Verification checklist (whole plan)

- `npx vitest run` green; `npm run check` 0/0; `npm run build` clean.
- Manual: arrows traverse Home/Levels (locked levels skipped, edges clamp); no 5c anywhere (till, badges 1-9, editor rejects 4,35); food appears at L10 with the Essen divider; L30 endgame is brutal; every level shows its name; a perfect round bursts coins; a 3-star win rains coins with a fanfare; reduced-motion shows none of it.
