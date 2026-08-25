# Orders, Please — Round 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement round 5 per `docs/superpowers/specs/2026-08-25-orders-please-round5-design.md`: full keyboard operability with focus management and an unambiguous till layout, CI + GitHub Pages deployment, first-encounter explainers, progression depth (best scores, streak flame, 12 badges), an always-show-prices assist, and a tech-debt pass (Game.svelte split + deferred minors).

**Architecture:** Small pure/testable units first (`focusFirst`, badge evaluation, best-score merge), then UI wiring per feature. The Game.svelte split happens LAST, after all features are in, extracting `SumPhase`/`ChangePhase` presentational components. CI is a plain GitHub Actions workflow; the PWA becomes base-path-aware for Pages.

**Tech Stack:** unchanged — Svelte 5 (runes), Vite, TypeScript, Vitest, vite-plugin-pwa; GitHub Actions for CI/Pages. No new runtime dependencies.

## Global Constraints

- All prior constraints hold: integer cents, core purity, EN+DE for every UI string via `t()`, svelte-check 0 errors 0 warnings, build clean, suite green, celebrations/praise use `Math.random` never `session.rng`.
- Focus: every overlay focuses its primary control on open (EndOverlay primary action, PauseOverlay Resume, DisputeDialog first option, ExplainerCard dismiss); route changes focus the new screen's first control; closing pause/dispute returns focus to the game main region.
- Till key-caps: bordered monospace key-cap bottom-left, count circle top-right, amount center; key-caps always visible at viewport ≥ 700px, else after first keydown (current behavior).
- Keys: dispute options 1/2; ask-row coins 1-5 while open; Esc closes an open ask row BEFORE the pause menu sees it.
- Deploy: vite `base` = `process.env.OP_BASE ?? '/'`; workflow tests+checks+builds on every push/PR and deploys `dist/` (built with `OP_BASE=/ordersplease/`) to GitHub Pages on pushes to main; component-level asset URLs use `import.meta.env.BASE_URL`.
- Explainers: ids `tipp, shortage, trap, tab, dispute, split`; shown once ever (persisted `op.seen`); game frozen while shown (timers paused, interval skipped); Enter/Space/Escape/click dismiss; dispute card shows BEFORE the dispute dialog.
- Progression: `progress.best[level] = { score, ms }` (higher score wins, lower ms tiebreak); flame `🔥n` in header at streak ≥ 3; 12 badges exactly `first-win, three-star, streak-10, trap-caught, dispute-won, tab-served, split-served, level-10, level-20, level-30, rush-5min, daily-7`, persisted `op.badges`, toast on unlock, wall on Stats.
- Assist: `settings.alwaysShowPrices` (default false) — when on, menu prices are never hidden in any mode; no scoring change.
- Game.svelte after the split ≤ ~450 lines; SumPhase/ChangePhase are presentational (props + callbacks only).
- Every commit message ends with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01BFFLt2muz8HfETCzn4N1ok`

---

### Task 1: focus management

**Files:**
- Create: `src/lib/focus.ts`
- Modify: `src/lib/EndOverlay.svelte`, `src/lib/PauseOverlay.svelte`, `src/lib/DisputeDialog.svelte`, `src/App.svelte`, `src/routes/Game.svelte`

**Interfaces:**
- Produces:

```ts
// focus.ts
export function focusFirst(container: HTMLElement | null): void;
// focuses the first enabled button/input/select inside container; no-op on null/empty
```

- [ ] **Step 1: Implement focus.ts**

```ts
// src/lib/focus.ts
/** Focus the first enabled interactive control inside a container. */
export function focusFirst(container: HTMLElement | null): void {
  if (!container) return;
  container
    .querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')
    ?.focus();
}
```

- [ ] **Step 2: Overlay autofocus**

In each of `EndOverlay.svelte`, `PauseOverlay.svelte`, `DisputeDialog.svelte`:

```ts
  import { focusFirst } from './focus';
  let rootEl = $state<HTMLElement | null>(null);
  $effect(() => {
    focusFirst(rootEl);
  });
```

and add `bind:this={rootEl}` to the component's root `<div>` (the `.overlay` / `.pause` / `.dispute` element). Because these components mount fresh each time they open, the effect runs exactly once per open. (EndOverlay's first button is Share or Next/Retry — acceptable primary; PauseOverlay's is Resume in menu mode and the tapzone in plain mode; DisputeDialog's is the first option.)

- [ ] **Step 3: Route-change focus in App**

In `src/App.svelte`:

```ts
  import { tick } from 'svelte';
  import { focusFirst } from './lib/focus';

  $effect(() => {
    $route; // track
    tick().then(() => focusFirst(document.querySelector('main')));
  });
```

- [ ] **Step 4: Focus return in Game**

In `src/routes/Game.svelte`: add `let mainEl = $state<HTMLElement | null>(null);`, `bind:this={mainEl}` on `<main class="game">`, import `focusFirst`, and:
- in `setPaused`, after un-pausing (the `on === false` path finishes): `if (!on) focusFirst(mainEl);`
- at the end of `resolveDispute` (after `finishRound()` and the penalty block): `focusFirst(mainEl);`

- [ ] **Step 5: Verify + commit**

Run: `npm run check` 0/0; `npx vitest run` green (158); `npm run build` ok.

```bash
git add src/lib/focus.ts src/lib/EndOverlay.svelte src/lib/PauseOverlay.svelte src/lib/DisputeDialog.svelte src/App.svelte src/routes/Game.svelte
git commit -m "feat: focus lands on the primary control everywhere"
```

---

### Task 2: till key-caps — unmistakable hotkey vs amount vs count

**Files:**
- Modify: `src/lib/Money.svelte`, `src/routes/Game.svelte`

- [ ] **Step 1: Key-cap styling in Money.svelte**

Replace the `.keybadge` style with:

```css
  .keybadge {
    position: absolute; bottom: -7px; left: -7px;
    min-width: 16px; height: 16px; line-height: 14px;
    background: var(--cream); color: var(--ink);
    border: 1px solid var(--ink); border-bottom-width: 2px;
    border-radius: 4px; font-size: 0.65rem; text-align: center;
    font-family: ui-monospace, 'Cascadia Mono', monospace; padding: 0 3px;
    box-shadow: inset 0 -1px 0 rgb(0 0 0 / 0.2);
  }
```

(The count `.badge` — filled dark circle top-right — and the centered amount label are unchanged; the three roles now have three distinct shapes/positions.)

- [ ] **Step 2: Always-visible key-caps on wide screens**

In `src/routes/Game.svelte`, add near the `hasKeyboard` state:

```ts
  const wideQuery = matchMedia('(min-width: 700px)');
  let wideScreen = $state(wideQuery.matches);
  $effect(() => {
    const on = (e: MediaQueryListEvent) => (wideScreen = e.matches);
    wideQuery.addEventListener('change', on);
    return () => wideQuery.removeEventListener('change', on);
  });
```

and change the TillGrid usage to `showKeys={hasKeyboard || wideScreen}`.

- [ ] **Step 3: Verify + commit**

Run: `npm run check` 0/0; `npx vitest run` green; `npm run build` ok.

```bash
git add src/lib/Money.svelte src/routes/Game.svelte
git commit -m "feat: key-cap hotkey badges, always visible on wide screens"
```

---

### Task 3: dispute keys, ask-row keys, Esc closes ask

**Files:**
- Modify: `src/routes/Game.svelte`, `src/lib/DisputeDialog.svelte`

- [ ] **Step 1: onKey additions**

In `src/routes/Game.svelte` `onKey`:

1. At the very top of the Escape branch, before the pause toggling:

```ts
    if (k === 'Escape') {
      if (askOpen) {
        askOpen = false;
        e.preventDefault();
        return;
      }
      ...existing pause toggle...
```

2. Replace the plain `if (session.finished || dispute) return;` with:

```ts
    if (session.finished) return;
    if (dispute) {
      if (k === '1' || k === '2') {
        const v = disputeOpts[Number(k) - 1];
        if (v !== undefined) resolveDispute(v);
        e.preventDefault();
      }
      return;
    }
```

3. At the top of the change-phase branch (before the digit-to-till mapping):

```ts
      if (askOpen && /^[1-5]$/.test(k)) {
        onAsk(COIN_DENOMS[Number(k) - 1]);
        e.preventDefault();
        return;
      }
```

- [ ] **Step 2: Visible key hints**

Ask-row buttons gain a leading key-cap:

```svelte
              {#each COIN_DENOMS as d, i (d)}
                <button onclick={() => onAsk(d)}>
                  <kbd>{i + 1}</kbd> {$t('game.ask-for')} {denomLabel(d)}?
                </button>
              {/each}
```

with style `.ask-row kbd { background: var(--cream); color: var(--ink); border-radius: 3px; padding: 0 4px; font-size: 0.7rem; margin-right: 2px; }`.

`src/lib/DisputeDialog.svelte`: options gain the same hint —

```svelte
    {#each options as o, i (o.value)}
      <button onclick={() => onanswer(o.value)}><kbd>{i + 1}</kbd> {o.label}</button>
    {/each}
```

with a matching `kbd` style (`.choices kbd { background: var(--wood); color: var(--cream); border-radius: 3px; padding: 0 4px; font-size: 0.7rem; margin-right: 4px; }`).

- [ ] **Step 3: Verify + commit**

Run: `npm run check` 0/0; `npx vitest run` green; `npm run build` ok.

```bash
git add src/routes/Game.svelte src/lib/DisputeDialog.svelte
git commit -m "feat: number keys answer disputes and asks, Esc closes the ask row"
```

---

### Task 4: ship it — base path, CI workflow, PWA head, TWA notes

**Files:**
- Create: `.github/workflows/deploy.yml`, `docs/twa.md`
- Modify: `vite.config.ts`, `index.html`, `src/routes/Home.svelte`

- [ ] **Step 1: Base-path awareness**

`vite.config.ts` — add to the defineConfig object (top level, alongside `plugins`):

```ts
  base: process.env.OP_BASE ?? '/',
```

`src/routes/Home.svelte` — the logo `src="/icon.svg"` becomes:

```svelte
  <img class="logo" src="{import.meta.env.BASE_URL}icon.svg" alt="" width="96" height="96" />
```

(`index.html`'s absolute `/icon.svg` link IS rewritten by Vite under `base` — no change needed there.)

- [ ] **Step 2: PWA head polish**

In `index.html` `<head>`, after the theme-color meta add:

```html
    <meta name="description" content="Train your bar brain: sum drink orders and give the right change under time pressure. Offline PWA, English & Deutsch." />
    <link rel="apple-touch-icon" href="/pwa-192.png" />
```

- [ ] **Step 3: Workflow**

```yaml
# .github/workflows/deploy.yml
name: CI & Deploy

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx vitest run
      - run: npm run check
      - run: npm run build

  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: test
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          OP_BASE: /ordersplease/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: TWA notes**

```markdown
# docs/twa.md — Play Store wrap (later)

The game is a PWA; wrapping it for the Play Store uses Bubblewrap against
the GitHub Pages URL:

1. Enable Pages for this repo: Settings → Pages → Source: GitHub Actions.
2. After the first main deploy, the app lives at
   https://13.github.io/ordersplease/
3. `npm i -g @bubblewrap/cli && bubblewrap init --manifest \
   https://13.github.io/ordersplease/manifest.webmanifest`
4. `bubblewrap build` produces the signed AAB; upload via Play Console
   (requires a developer account) and host the generated
   `assetlinks.json` under `public/.well-known/`.

Nothing in this file is automated; it is a checklist for when store
distribution becomes worth it.
```

- [ ] **Step 5: Verify + commit**

Run: `npx vitest run` green; `npm run check` 0/0; `npm run build` ok (default base); `OP_BASE=/ordersplease/ npm run build` ok and `grep -r "/ordersplease/" dist/index.html` finds the prefixed assets.

```bash
git add .github/workflows/deploy.yml docs/twa.md vite.config.ts index.html src/routes/Home.svelte
git commit -m "feat: CI workflow with GitHub Pages deploy and base-path support"
```

NOTE for the controller (not the implementer): after this round merges, the user must enable Pages once (repo Settings → Pages → Source: GitHub Actions).

---

### Task 5: onboarding explainers

**Files:**
- Create: `src/stores/seen.ts`, `src/lib/ExplainerCard.svelte`
- Modify: `src/routes/Game.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`
- Test: `tests/stores/seen.test.ts`

**Interfaces:**
- Produces:

```ts
// stores/seen.ts
export const seen: Writable<string[]>;                  // persisted 'op.seen'
export function markSeen(id: string): boolean;          // false if already seen; true = newly marked

// ExplainerCard.svelte props
{ title: string; body: string; ondismiss: () => void }  // autofocuses its dismiss button (uses focusFirst)
```

- Game additions: `explaining: string | null` state; `maybeExplain(id)` freezes the game (pauses the four timers, interval skips, keys blocked except dismiss keys) and shows the card; dismissing resumes. Trigger points: `tipp` at the first `startRound()` ever; `tab` in the tab branch; `split` in the split branch; `trap` and `shortage` when the change phase is entered (`submitSum` success) — trap when `round.paymentCents < round.order.totalCents`, shortage when not underpaid, `round.changeDue > 0`, and `!canMakeChange(round.till, round.changeDue)`; `dispute` in `confirmChange` right after `dispute` is set (card renders above the dialog; the dialog's `{#if}` gains `&& !explaining`).

- [ ] **Step 1: Store + test (TDD)**

```ts
// tests/stores/seen.test.ts
import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { seen, markSeen } from '../../src/stores/seen';

describe('seen store', () => {
  it('marks once and reports repeats', () => {
    seen.set([]);
    expect(markSeen('trap')).toBe(true);
    expect(get(seen)).toContain('trap');
    expect(markSeen('trap')).toBe(false);
  });
});
```

Run to FAIL, then:

```ts
// src/stores/seen.ts
import { get } from 'svelte/store';
import { persisted } from './persisted';

export const seen = persisted<string[]>('op.seen', []);

/** Returns true exactly once per id (and records it). */
export function markSeen(id: string): boolean {
  if (get(seen).includes(id)) return false;
  seen.update((s) => [...s, id]);
  return true;
}
```

Run to PASS.

- [ ] **Step 2: ExplainerCard component**

```svelte
<!-- src/lib/ExplainerCard.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { focusFirst } from './focus';

  let { title, body, ondismiss }: {
    title: string; body: string; ondismiss: () => void;
  } = $props();

  let rootEl = $state<HTMLElement | null>(null);
  $effect(() => focusFirst(rootEl));
</script>

<div class="explain" role="dialog" aria-label={title} bind:this={rootEl}>
  <div class="card">
    <h3>💡 {title}</h3>
    <p>{body}</p>
    <button onclick={ondismiss}>{$t('explain.dismiss')}</button>
  </div>
</div>

<style>
  .explain {
    position: fixed; inset: 0; background: rgb(0 0 0 / 0.8);
    display: flex; align-items: center; justify-content: center; padding: var(--space-4);
  }
  .card {
    background: var(--cream); color: var(--ink);
    border-radius: var(--radius); padding: var(--space-5);
    max-width: 340px; display: flex; flex-direction: column; gap: var(--space-3);
    box-shadow: var(--shadow); animation: op-pop 0.2s ease-out;
  }
  .card button { background: var(--accent); color: var(--ink); font-size: 1.05rem; }
</style>
```

- [ ] **Step 3: Game wiring**

Imports: `ExplainerCard`, `markSeen`, and `canMakeChange` from `../core/change`.

State + helpers:

```ts
  let explaining = $state<string | null>(null);

  function maybeExplain(id: string) {
    if (!markSeen(id)) return;
    explaining = id;
    for (const tm of [amendT, menuT, flashT, waveT]) tm.pause();
  }
  function dismissExplain() {
    explaining = null;
    for (const tm of [amendT, menuT, flashT, waveT]) tm.resume();
    focusFirst(mainEl);
  }
```

Interval: add `if (explaining) return;` directly after the `if (paused) return;` line.

`onKey`: at the very top (after the input-focus guard, before Escape handling):

```ts
    if (explaining) {
      if (k === 'Enter' || k === ' ' || k === 'Escape') {
        dismissExplain();
        e.preventDefault();
      }
      return;
    }
```

Triggers:
- end of `startRound()` (after the menu-visibility block): `maybeExplain('tipp');` — but only when a round actually started (`if (round) maybeExplain('tipp');`).
- tab branch (right after `numpadLocked = true;`): `maybeExplain('tab');`
- split branch (right after `groupBaseText = ...` line): `maybeExplain('split');`
- in `onSum`, when the submit succeeds into the change phase — after `round = submitSum(round, cents);` add:

```ts
    if (round.phase === 'change') {
      if (round.paymentCents < round.order.totalCents) maybeExplain('trap');
      else if (round.changeDue > 0 && !canMakeChange(round.till, round.changeDue)) maybeExplain('shortage');
    }
```

- in `confirmChange`, right after `disputeOpts = ...` is assigned: `maybeExplain('dispute');`
- Dispute dialog render condition becomes `{#if dispute && !paused && !explaining}`.

Markup (before the PauseOverlay block):

```svelte
  {#if explaining}
    <ExplainerCard
      title={$t(`explain.${explaining}.title`)}
      body={$t(`explain.${explaining}.body`)}
      ondismiss={dismissExplain}
    />
  {/if}
```

`restart()` gains `explaining = null;` (timers are cleared there anyway).

- [ ] **Step 4: i18n (12 cards + dismiss)**

en:

```ts
  'explain.dismiss': 'Got it',
  'explain.tipp.title': 'Stuck? Take a Tipp',
  'explain.tipp.body': 'The Tipp button (or T) reveals part of the answer — a line’s subtotal or the change amount. Each Tipp costs 25 points and the round’s first-try bonus.',
  'explain.shortage.title': 'The till is short',
  'explain.shortage.body': 'You can’t make exact change with these coins. Ask the customer for a small coin (A) — the right ask earns a bonus.',
  'explain.trap.title': 'Count the money!',
  'explain.trap.body': 'Customers sometimes hand over too little. If the payment doesn’t cover the bill, press “That’s not enough!” (N) instead of giving change.',
  'explain.tab.title': 'A tab is running',
  'explain.tab.body': 'This customer keeps ordering. Keep the running total in your head — the numpad unlocks when they finish.',
  'explain.dispute.title': 'They’re disputing!',
  'explain.dispute.body': 'The customer claims they paid with a bigger note. Remember what they really handed you and pick it — a good memory earns points.',
  'explain.split.title': 'They’re paying separately',
  'explain.split.body': 'Each person pays their own share. Sum only the items announced, take that payment, give that change — then the next payer steps up.',
```

de:

```ts
  'explain.dismiss': 'Alles klar',
  'explain.tipp.title': 'Hängst du? Nimm einen Tipp',
  'explain.tipp.body': 'Der Tipp-Knopf (oder T) verrät einen Teil der Lösung — eine Zwischensumme oder das Wechselgeld. Jeder Tipp kostet 25 Punkte und den Erstversuch-Bonus.',
  'explain.shortage.title': 'Die Kasse ist knapp',
  'explain.shortage.body': 'Mit diesen Münzen geht kein exaktes Wechselgeld. Frag den Gast nach einer kleinen Münze (A) — die richtige Frage bringt einen Bonus.',
  'explain.trap.title': 'Zähl das Geld!',
  'explain.trap.body': 'Gäste zahlen manchmal zu wenig. Wenn das Geld nicht reicht, drück „Das ist zu wenig!“ (N) statt Wechselgeld zu geben.',
  'explain.tab.title': 'Ein Deckel läuft',
  'explain.tab.body': 'Dieser Gast bestellt weiter. Behalte die Zwischensumme im Kopf — der Ziffernblock öffnet sich, wenn er fertig ist.',
  'explain.dispute.title': 'Reklamation!',
  'explain.dispute.body': 'Der Gast behauptet, mit einem größeren Schein gezahlt zu haben. Erinnere dich, was er wirklich gegeben hat — gutes Gedächtnis bringt Punkte.',
  'explain.split.title': 'Es wird getrennt gezahlt',
  'explain.split.body': 'Jeder zahlt seinen Teil. Rechne nur die angesagten Sachen zusammen, kassiere, gib Wechselgeld — dann kommt der Nächste dran.',
```

- [ ] **Step 5: Verify + commit**

Run: `npx vitest run` green (159); `npm run check` 0/0; `npm run build` ok.

```bash
git add src/stores/seen.ts src/lib/ExplainerCard.svelte src/routes/Game.svelte src/i18n tests/stores/seen.test.ts
git commit -m "feat: one-time mechanic explainers that freeze the game"
```

---

### Task 6: per-level best score + map display

**Files:**
- Modify: `src/stores/progress.ts`, `src/routes/Game.svelte` (finalize), `src/routes/Levels.svelte`
- Test: `tests/stores/progress.test.ts` (new)

**Interfaces:**
- Produces:

```ts
// stores/progress.ts
export interface Best { score: number; ms: number }
export interface Progress { stars: Record<number, number>; best?: Record<number, Best>; }
export function improveBest(
  best: Record<number, Best> | undefined, level: number, score: number, ms: number,
): Record<number, Best>;
// keeps the better entry: higher score wins; equal score → lower ms wins
```

- [ ] **Step 1: TDD improveBest**

```ts
// tests/stores/progress.test.ts
import { describe, it, expect } from 'vitest';
import { improveBest } from '../../src/stores/progress';

describe('improveBest', () => {
  it('records a first best and keeps better ones', () => {
    let b = improveBest(undefined, 3, 1000, 60000);
    expect(b[3]).toEqual({ score: 1000, ms: 60000 });
    b = improveBest(b, 3, 1200, 70000);
    expect(b[3]).toEqual({ score: 1200, ms: 70000 }); // higher score wins despite slower
    b = improveBest(b, 3, 1200, 65000);
    expect(b[3].ms).toBe(65000); // tiebreak: faster
    b = improveBest(b, 3, 900, 10000);
    expect(b[3].score).toBe(1200); // worse discarded
  });
});
```

Run to FAIL, then implement in `src/stores/progress.ts`:

```ts
export interface Best { score: number; ms: number }
```

(add `best?: Record<number, Best>;` to `Progress`), and append:

```ts
export function improveBest(
  best: Record<number, Best> | undefined, level: number, score: number, ms: number,
): Record<number, Best> {
  const prev = best?.[level];
  const better = !prev
    || score > prev.score
    || (score === prev.score && ms < prev.ms);
  if (!better) return best ?? {};
  return { ...(best ?? {}), [level]: { score, ms } };
}
```

Run to PASS.

- [ ] **Step 2: Record in finalize**

In `src/routes/Game.svelte` `finalize()`, extend the level-won branch (`improveBest` joins the progress import):

```ts
    if (session.mode === 'level' && session.finished === 'won') {
      const levelMs = session.roundLog.filter((e) => !e.sub).reduce((s, e) => s + e.ms, 0);
      progress.update((p) => ({
        stars: { ...p.stars, [level]: Math.max(p.stars[level] ?? 0, stars) },
        best: improveBest(p.best, level, session.score, levelMs),
      }));
    }
```

- [ ] **Step 3: Map display**

In `src/routes/Levels.svelte`, under the `.lname` span:

```svelte
        {#if $progress.best?.[l]}
          <span class="best">{$progress.best[l].score}</span>
        {/if}
```

with style `.best { font-size: 0.6rem; color: var(--accent); font-variant-numeric: tabular-nums; }`.

- [ ] **Step 4: Verify + commit**

Run: `npx vitest run` green (160); `npm run check` 0/0; `npm run build` ok.

```bash
git add src/stores/progress.ts src/routes/Game.svelte src/routes/Levels.svelte tests/stores/progress.test.ts
git commit -m "feat: per-level best scores on the map"
```

---

### Task 7: achievements — 12 badges, toast, wall

**Files:**
- Create: `src/core/badges.ts`, `src/stores/badges.ts`
- Modify: `src/routes/Game.svelte`, `src/routes/Stats.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`
- Test: `tests/core/badges.test.ts`

**Interfaces:**
- Produces:

```ts
// core/badges.ts
export const BADGE_IDS = [
  'first-win', 'three-star', 'streak-10', 'trap-caught', 'dispute-won',
  'tab-served', 'split-served', 'level-10', 'level-20', 'level-30',
  'rush-5min', 'daily-7',
] as const;
export type BadgeId = (typeof BADGE_IDS)[number];
export interface BadgeContext {
  mode: 'level' | 'rush' | 'practice' | 'daily';
  finished: 'won' | 'lost' | null;
  stars: number;
  level: number;          // the level just played (level mode)
  maxStreak: number;      // highest streak seen this session
  trapCaught: boolean;    // usedTrapCall succeeded this session
  disputeWon: boolean;
  tabServed: boolean;     // a tab round succeeded
  splitServed: boolean;   // a split group completed successfully
  elapsedMs: number;
  dailyStreak: number;    // AFTER the daily record update
}
export function newBadges(ctx: BadgeContext, owned: readonly string[]): BadgeId[];
// deterministic; never returns owned ids; practice mode earns only mechanic badges
// (trap/dispute/tab/split/streak), never win/level/rush/daily ones.

// stores/badges.ts
export const badges: Writable<string[]>; // persisted 'op.badges'
```

Badge rules: `first-win` any level/daily won or rush ended with score > 0; `three-star` level won with stars === 3; `streak-10` maxStreak ≥ 10; `trap-caught`/`dispute-won`/`tab-served`/`split-served` from flags; `level-10|20|30` level mode won with level ≥ 10/20/30; `rush-5min` rush finished with elapsedMs ≥ 300000; `daily-7` dailyStreak ≥ 7.

- [ ] **Step 1: TDD newBadges**

```ts
// tests/core/badges.test.ts
import { describe, it, expect } from 'vitest';
import { newBadges, BADGE_IDS, type BadgeContext } from '$core/badges';

const base: BadgeContext = {
  mode: 'level', finished: 'lost', stars: 0, level: 1, maxStreak: 0,
  trapCaught: false, disputeWon: false, tabServed: false, splitServed: false,
  elapsedMs: 0, dailyStreak: 0,
};

describe('newBadges', () => {
  it('first win and three-star', () => {
    const got = newBadges({ ...base, finished: 'won', stars: 3 }, []);
    expect(got).toContain('first-win');
    expect(got).toContain('three-star');
  });
  it('level milestones need a WIN at that level', () => {
    expect(newBadges({ ...base, finished: 'won', level: 20 }, [])).toContain('level-20');
    expect(newBadges({ ...base, finished: 'lost', level: 20 }, [])).not.toContain('level-20');
  });
  it('mechanic badges fire regardless of outcome, even in practice', () => {
    const got = newBadges({ ...base, mode: 'practice', trapCaught: true, maxStreak: 10 }, []);
    expect(got).toContain('trap-caught');
    expect(got).toContain('streak-10');
    expect(got).not.toContain('first-win');
  });
  it('rush badges', () => {
    const got = newBadges({ ...base, mode: 'rush', finished: 'lost', elapsedMs: 300000, stars: 0 }, []);
    expect(got).toContain('rush-5min');
  });
  it('rush with at least one served customer counts as a first win', () => {
    expect(newBadges({ ...base, mode: 'rush', finished: 'lost', elapsedMs: 1000, maxStreak: 1 }, []))
      .toContain('first-win');
    expect(newBadges({ ...base, mode: 'rush', finished: 'lost', elapsedMs: 1000, maxStreak: 0 }, []))
      .not.toContain('first-win');
  });
  it('daily badge', () => {
    expect(newBadges({ ...base, mode: 'daily', finished: 'won', dailyStreak: 7 }, [])).toContain('daily-7');
  });
  it('owned badges are filtered and ids are unique', () => {
    const all = newBadges({ ...base, finished: 'won', stars: 3, level: 30, maxStreak: 10,
      trapCaught: true, disputeWon: true, tabServed: true, splitServed: true,
      elapsedMs: 400000, dailyStreak: 8, mode: 'level' }, ['first-win']);
    expect(all).not.toContain('first-win');
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(BADGE_IDS).toContain(id);
  });
});
```

Run to FAIL.

- [ ] **Step 2: Implement**

```ts
// src/core/badges.ts
export const BADGE_IDS = [
  'first-win', 'three-star', 'streak-10', 'trap-caught', 'dispute-won',
  'tab-served', 'split-served', 'level-10', 'level-20', 'level-30',
  'rush-5min', 'daily-7',
] as const;
export type BadgeId = (typeof BADGE_IDS)[number];

export interface BadgeContext {
  mode: 'level' | 'rush' | 'practice' | 'daily';
  finished: 'won' | 'lost' | null;
  stars: number;
  level: number;
  maxStreak: number;
  trapCaught: boolean;
  disputeWon: boolean;
  tabServed: boolean;
  splitServed: boolean;
  elapsedMs: number;
  dailyStreak: number;
}

/** Newly earned badges for a finished session. Pure and deterministic. */
export function newBadges(ctx: BadgeContext, owned: readonly string[]): BadgeId[] {
  const earned = new Set<BadgeId>();
  const levelWon = ctx.mode === 'level' && ctx.finished === 'won';
  const anyWin = levelWon
    || (ctx.mode === 'daily' && ctx.finished === 'won')
    || (ctx.mode === 'rush' && ctx.maxStreak >= 1);

  if (anyWin && ctx.mode !== 'practice') earned.add('first-win');
  if (levelWon && ctx.stars === 3) earned.add('three-star');
  if (ctx.maxStreak >= 10) earned.add('streak-10');
  if (ctx.trapCaught) earned.add('trap-caught');
  if (ctx.disputeWon) earned.add('dispute-won');
  if (ctx.tabServed) earned.add('tab-served');
  if (ctx.splitServed) earned.add('split-served');
  if (levelWon && ctx.level >= 10) earned.add('level-10');
  if (levelWon && ctx.level >= 20) earned.add('level-20');
  if (levelWon && ctx.level >= 30) earned.add('level-30');
  if (ctx.mode === 'rush' && ctx.elapsedMs >= 300_000) earned.add('rush-5min');
  if (ctx.dailyStreak >= 7) earned.add('daily-7');

  return [...earned].filter((id) => !owned.includes(id));
}
```

```ts
// src/stores/badges.ts
import { persisted } from './persisted';

export const badges = persisted<string[]>('op.badges', []);
```

Run tests to PASS.

- [ ] **Step 3: Game wiring — session flags, evaluation, toast**

In `src/routes/Game.svelte`:

State (reset in `restart()` too):

```ts
  let maxStreak = 0;
  let trapCaught = false;
  let disputeWon = false;
  let tabServed = false;
  let splitServed = false;
  let badgeToast = $state<string | null>(null);
```

Flag collection:
- in `finishRound()` after `session = completeRound(...)`: `maxStreak = Math.max(maxStreak, session.streak);` and in the same success region: `if (done.success === true && done.usedTrapCall) trapCaught = true; if (done.success === true && done.kind === 'tab') tabServed = true; if (done.success === true && splitGroups) splitServed = true;` (place BEFORE `splitGroups = null;`).
- in `resolveDispute()`, the correct branch gains `disputeWon = true;`.

Evaluation at the end of `finalize()` (after the bigWin block; imports: `newBadges` from core, `badges` store):

```ts
    const got = newBadges({
      mode: session.mode, finished: session.finished, stars, level,
      maxStreak, trapCaught, disputeWon, tabServed, splitServed,
      elapsedMs: session.elapsedMs,
      dailyStreak: get(daily)?.streak ?? 0,
    }, get(badges));
    if (got.length > 0) {
      badges.update((b) => [...b, ...got]);
      badgeToast = got.map((id) => `🏅 ${get(t)(`badge.${id}`)}`).join('  ');
      setTimeout(() => (badgeToast = null), 3000);
    }
```

Markup (after the EndOverlay block so it paints above it):

```svelte
  {#if badgeToast}<div class="flash badge-toast">{badgeToast}</div>{/if}
```

with style `.badge-toast { bottom: 12%; background: var(--accent); }`.

- [ ] **Step 4: Stats badge wall + i18n**

`src/routes/Stats.svelte` — after the hint block:

```svelte
  <h3>{$t('stats.badges')}</h3>
  <div class="badges">
    {#each BADGE_IDS as id (id)}
      {@const owned = $badges.includes(id)}
      <div class="badge" class:locked={!owned}>
        <span class="icon">{owned ? '🏅' : '🔒'}</span>
        <span>{$t(`badge.${id}`)}</span>
      </div>
    {/each}
  </div>
```

with imports (`BADGE_IDS` from `../core/badges`, `badges` from `../stores/badges`) and styles:

```css
  .badges { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.4rem; }
  .badge {
    display: flex; align-items: center; gap: 0.4rem;
    background: var(--wood-light); border-radius: var(--radius);
    padding: 0.4rem 0.6rem; font-size: 0.85rem;
  }
  .badge.locked { opacity: 0.45; }
  .icon { font-size: 1.1rem; }
```

i18n — en:

```ts
  'stats.badges': 'Achievements',
  'badge.first-win': 'First shift survived',
  'badge.three-star': 'Three stars',
  'badge.streak-10': 'Ten in a row',
  'badge.trap-caught': 'Caught a short payment',
  'badge.dispute-won': 'Won a dispute',
  'badge.tab-served': 'Tab settled',
  'badge.split-served': 'Group served',
  'badge.level-10': 'Kitchen opened',
  'badge.level-20': 'Oktoberfest veteran',
  'badge.level-30': 'Bar legend',
  'badge.rush-5min': 'Five-minute night',
  'badge.daily-7': 'Daily week',
```

de:

```ts
  'stats.badges': 'Erfolge',
  'badge.first-win': 'Erste Schicht geschafft',
  'badge.three-star': 'Drei Sterne',
  'badge.streak-10': 'Zehn am Stück',
  'badge.trap-caught': 'Zahlungsfalle erkannt',
  'badge.dispute-won': 'Reklamation gewonnen',
  'badge.tab-served': 'Deckel abgerechnet',
  'badge.split-served': 'Gruppe bedient',
  'badge.level-10': 'Küche eröffnet',
  'badge.level-20': 'Oktoberfest-Veteran',
  'badge.level-30': 'Barlegende',
  'badge.rush-5min': 'Fünf-Minuten-Nacht',
  'badge.daily-7': 'Tägliche Woche',
```

- [ ] **Step 5: Verify + commit**

Run: `npx vitest run` green (~167); `npm run check` 0/0; `npm run build` ok.

```bash
git add src/core/badges.ts src/stores/badges.ts src/routes/Game.svelte src/routes/Stats.svelte src/i18n tests/core/badges.test.ts
git commit -m "feat: twelve achievements with unlock toasts and a badge wall"
```

---

### Task 8: streak flame + always-show-prices assist

**Files:**
- Modify: `src/routes/Game.svelte`, `src/stores/settings.ts`, `src/routes/Settings.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`

- [ ] **Step 1: Streak flame**

In the Game header, after the level/mode span:

```svelte
    {#if session.streak >= 3}<span class="flame">🔥{session.streak}</span>{/if}
```

with style `.flame { color: var(--accent); font-weight: bold; animation: op-pop 0.3s ease-out; }`.

- [ ] **Step 2: alwaysShowPrices setting**

`src/stores/settings.ts` — add `alwaysShowPrices: boolean;` to the interface and `alwaysShowPrices: false,` to the defaults.

`src/routes/Settings.svelte` — after the symbolFirst checkbox:

```svelte
  <label><input type="checkbox" bind:checked={$settings.alwaysShowPrices} /> {$t('settings.show-prices')}</label>
```

`src/routes/Game.svelte`, in `startRound()`, the menu-visibility block becomes:

```ts
    const vis = session.params.menuVisibleSeconds;
    menuT.clear();
    if (get(settings).alwaysShowPrices) {
      menuHidden = false;
    } else {
      menuHidden = vis === 0;
      if (vis !== null && vis > 0) {
        menuT.start(() => (menuHidden = true), vis * 1000);
      }
    }
```

i18n: en `'settings.show-prices': 'Always show prices',`; de `'settings.show-prices': 'Preise immer zeigen',`.

- [ ] **Step 3: Verify + commit**

Run: `npx vitest run` green; `npm run check` 0/0; `npm run build` ok. (Legacy persisted settings lack the new field — verify Settings still renders: the persisted store restores the stored object wholesale, so `$settings.alwaysShowPrices` is `undefined` → falsy → correct behavior; the first toggle writes it. No migration needed.)

```bash
git add src/routes/Game.svelte src/stores/settings.ts src/routes/Settings.svelte src/i18n
git commit -m "feat: streak flame and always-show-prices assist"
```

---

### Task 9: Game.svelte split — SumPhase / ChangePhase

**Files:**
- Create: `src/lib/SumPhase.svelte`, `src/lib/ChangePhase.svelte`
- Modify: `src/routes/Game.svelte`

**Interfaces:**
- Produces (presentational only — no game logic inside):

```ts
// SumPhase.svelte props
{
  locked: boolean;                       // tab waves still arriving
  symbolFirst: boolean;
  onsum: (cents: number) => void;
  ontipp: () => void;
  bindApi: (api: NumpadApi) => void;
}

// ChangePhase.svelte props
{
  paymentPieces: Denom[];
  tillView: Till;
  pile: Denom[];
  showPileTotal: boolean;
  showKeys: boolean;
  finishMode: boolean;                   // changeDue === 0
  askOpen: boolean;
  ontake: (d: Denom) => void;
  onreturn: (index: number) => void;
  onconfirm: () => void;
  ontoggleask: () => void;
  onask: (d: Denom) => void;
  onnotenough: () => void;
  ontipp: () => void;
}
```

- [ ] **Step 1: Extract SumPhase**

`src/lib/SumPhase.svelte` — move the sum-phase markup (tab-wait prompt, sum prompt, Numpad, Tipp button) verbatim, driven by the props above; bring the `.tipp` and `.prompt` styles it needs. `Numpad`/`t` imports live here now.

```svelte
<!-- src/lib/SumPhase.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import Numpad from './Numpad.svelte';
  import type { NumpadApi } from './Numpad.svelte';

  let { locked, symbolFirst, onsum, ontipp, bindApi }: {
    locked: boolean; symbolFirst: boolean;
    onsum: (cents: number) => void; ontipp: () => void;
    bindApi: (api: NumpadApi) => void;
  } = $props();
</script>

{#if locked}
  <p class="prompt">{$t('game.tab-wait')}</p>
{:else}
  <p class="prompt">{$t('game.sum-prompt')}</p>
  <Numpad onsubmit={onsum} {symbolFirst} {bindApi} />
  <button class="tipp" onclick={ontipp}>{$t('game.tipp')}</button>
{/if}

<style>
  .prompt { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: baseline; }
  .tipp { background: var(--wood-light); color: var(--cream); }
</style>
```

- [ ] **Step 2: Extract ChangePhase**

`src/lib/ChangePhase.svelte` — move the change-phase markup (payment chips, TillGrid, ChangePile, ask row with key hints, sticky actions incl. Finish/Confirm label, Ask, Not-enough, Tipp) verbatim under the props above, bringing the styles it uses (`.prompt`, `.actions`, `.confirm`, `.ask`, `.ask-row` + `kbd`, `.tipp`):

```svelte
<!-- src/lib/ChangePhase.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { COIN_DENOMS, type Denom, type Till } from '../core/till';
  import { denomLabel } from './denom-view';
  import Money from './Money.svelte';
  import TillGrid from './TillGrid.svelte';
  import ChangePile from './ChangePile.svelte';

  let {
    paymentPieces, tillView, pile, showPileTotal, showKeys, finishMode, askOpen,
    ontake, onreturn, onconfirm, ontoggleask, onask, onnotenough, ontipp,
  }: {
    paymentPieces: Denom[]; tillView: Till; pile: Denom[];
    showPileTotal: boolean; showKeys: boolean; finishMode: boolean; askOpen: boolean;
    ontake: (d: Denom) => void; onreturn: (index: number) => void;
    onconfirm: () => void; ontoggleask: () => void; onask: (d: Denom) => void;
    onnotenough: () => void; ontipp: () => void;
  } = $props();
</script>

<p class="prompt">
  {$t('game.pays')}:
  {#each [...paymentPieces].sort((a, b) => b - a) as p, i (i)}
    <Money denom={p} interactive={false} />
  {/each}
</p>
<TillGrid till={tillView} {ontake} disabled={finishMode} {showKeys} />
<ChangePile {pile} showTotal={showPileTotal} {onreturn} />
{#if askOpen}
  <div class="ask-row">
    {#each COIN_DENOMS as d, i (d)}
      <button onclick={() => onask(d)}>
        <kbd>{i + 1}</kbd> {$t('game.ask-for')} {denomLabel(d)}?
      </button>
    {/each}
  </div>
{/if}
<div class="actions">
  <button class="confirm" onclick={onconfirm}>
    {finishMode ? $t('game.finish') : $t('game.confirm')}
  </button>
  <button class="ask" onclick={ontoggleask}>{$t('game.ask')}</button>
  <button class="ask" onclick={onnotenough}>{$t('game.not-enough')}</button>
  <button class="tipp" onclick={ontipp}>{$t('game.tipp')}</button>
</div>

<style>
  .prompt { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: baseline; }
  .actions {
    display: flex; gap: 0.5rem;
    position: sticky; bottom: 0;
    padding: var(--space-2) 0 calc(var(--space-2) + env(safe-area-inset-bottom));
    background: var(--wood);
  }
  .confirm { flex: 1; background: var(--ok); color: var(--cream); font-size: 1.1rem; }
  .ask { background: var(--accent); color: var(--ink); }
  .ask-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .ask-row button { background: var(--wood-light); color: var(--cream); }
  .ask-row kbd { background: var(--cream); color: var(--ink); border-radius: 3px; padding: 0 4px; font-size: 0.7rem; margin-right: 2px; }
  .tipp { background: var(--wood-light); color: var(--cream); }
</style>
```

- [ ] **Step 3: Slim Game.svelte**

Replace the `{#key round.phase}` block's interior with:

```svelte
    {#key round.phase}
      <div class="phase">
        {#if round.phase === 'sum'}
          <SumPhase
            locked={numpadLocked} {symbolFirst}
            onsum={onSum} ontipp={onTipp}
            bindApi={(api) => (numpadApi = api)}
          />
        {:else if round.phase === 'change'}
          <ChangePhase
            paymentPieces={round.paymentPieces}
            {tillView} {pile}
            showPileTotal={session.params.showPileTotal}
            showKeys={hasKeyboard || wideScreen}
            finishMode={round.changeDue === 0}
            {askOpen}
            ontake={take} onreturn={ret} onconfirm={confirmChange}
            ontoggleask={() => (askOpen = !askOpen)}
            onask={onAsk} onnotenough={onNotEnough} ontipp={onTipp}
          />
        {/if}
      </div>
    {/key}
```

Remove from Game.svelte: the now-unused imports (`Numpad`, `TillGrid`, `ChangePile`, `Money`, `COIN_DENOMS` if no longer referenced elsewhere — the ask-key handler still uses `COIN_DENOMS`, keep it; `denomLabel` still used by dispute strings, keep) and the moved styles (`.prompt`, `.actions`, `.confirm`, `.ask`, `.ask-row` + kbd, `.tipp` — verify each is truly unused before deleting; `.tipp` is if SumPhase/ChangePhase own their copies). Target ≤ ~450 lines; report the final line count.

- [ ] **Step 4: Verify + commit**

Run: `npm run check` 0/0; `npx vitest run` green; `npm run build` ok. Play one level via `npm run dev`-equivalent reasoning is NOT possible — instead re-verify svelte-check strictly and confirm all props wire (typecheck covers it).

```bash
git add src/lib/SumPhase.svelte src/lib/ChangePhase.svelte src/routes/Game.svelte
git commit -m "refactor: extract SumPhase and ChangePhase from Game"
```

---

### Task 10: deferred minors + a11y sweep

**Files:**
- Modify: `src/core/menu.ts`, `src/lib/EndOverlay.svelte`, `src/lib/keynav.ts`, `src/i18n/en.ts`, `src/i18n/de.ts`, plus any file the a11y sweep flags

- [ ] **Step 1: The four ledger minors**

1. `src/core/menu.ts` `migrateMenuItems` body becomes spread-based:

```ts
  return items.map((m) => ({
    ...m,
    priceCents: Math.max(10, Math.round(m.priceCents / 10) * 10),
    category: m.category ?? 'drink',
  }));
```

2. `src/lib/EndOverlay.svelte`: unify on bare `matchMedia` — change the count-up effect's `window.matchMedia` to `matchMedia`.
3. `src/lib/keynav.ts`: add above the clamp return: `// clamp === current is unreachable (loop starts at current+dir) — kept as a guard`.
4. i18n: delete `'game.correct'` from both dictionaries; `grep -rn "game.correct" src/` must be empty.

- [ ] **Step 2: A11y sweep**

Run `grep -n "onclick" src/lib/*.svelte src/routes/*.svelte | grep -v aria-label` and inspect each icon-only/emoji-only button; ensure every one has an aria-label (known candidates: MenuEditor `.del` ✕ button — add `aria-label={$t('menu.delete-item')}` with new keys en `'menu.delete-item': 'Delete item'` / de `'menu.delete-item': 'Eintrag löschen'`; anything else found gets the same treatment, named in the report). Confirm every overlay root has `role="dialog"` + `aria-label` (EndOverlay currently lacks role — add `role="dialog"` `aria-label={$t(session.finished === 'won' ? 'result.won' : 'result.lost')}`). Also apply `use:keynav` to PauseOverlay's `.menu-actions` div (import from './keynav') so pause-menu buttons are arrow-navigable, per the spec's keyboard audit.

- [ ] **Step 3: Verify + commit**

Run: `npx vitest run` green; `npm run check` 0/0; `npm run build` ok.

```bash
git add src/core/menu.ts src/lib/EndOverlay.svelte src/lib/keynav.ts src/i18n src/routes/MenuEditor.svelte
git commit -m "chore: deferred cleanups and a11y sweep"
```

---

### Task 11: final verification + README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README**

Under the logo header block, add a play link line:

```markdown
<p align="center"><a href="https://13.github.io/ordersplease/">▶ Play in the browser</a></p>
```

Add one bullet to the feature list:

```markdown
- **Plays entirely without a mouse**: real focus management, key-cap hints on
  every till button, number keys for asks and disputes, and one-time
  explainers the first time each bar situation appears.
```

- [ ] **Step 2: Full verification**

Run: `npx vitest run` all green (~167); `npm run check` 0/0; `npm run build` ok; `OP_BASE=/ordersplease/ npm run build` ok.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: play link and keyboard-first notes"
```

---

## Verification checklist (whole plan)

- Suite green; svelte-check 0/0; both base-path builds clean.
- Keyboard-only manual pass: navigate Home → level → play a full round → pause menu → dispute → results → back, never touching the mouse; focus visibly lands on the right control at every transition.
- After merge: enable GitHub Pages (Settings → Pages → Source: GitHub Actions) — the next push to main deploys; verify https://13.github.io/ordersplease/ installs and works offline.
