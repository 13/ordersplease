# Orders, Please — Round 7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement round 7 per `docs/superpowers/specs/2026-08-26-orders-please-round7-design.md`: typed change amounts, top-positioned success flash, always-visible motivating round details, Einstellungen overflow fix, Game menu button, vim keys, and the deferred polish items.

**Architecture:** No new core logic — `makeChange` composes typed amounts. Changes are lib polish (keynav/focus), Game keyboard rework for the change phase, and presentational upgrades (RoundDetails, Home, header).

**Tech Stack:** unchanged — Svelte 5 (runes), Vite, TypeScript, Vitest.

## Global Constraints

- All prior constraints hold: integer cents, core purity, EN+DE via `t()` for every UI string, svelte-check 0 errors 0 warnings, build clean, suite green, no z-index, determinism (no new session.rng consumption anywhere this round).
- Typed change parse semantics identical to the sum Numpad (`parseEntry`): `5`→500, `50`→5000, `0,5`→50. Enter with empty entry keeps current confirm behavior. Typed-correct-but-uncomposable opens the ask row WITHOUT burning a try. Typing clears the clicked pile; clicking clears the typed entry; Escape clears the entry before ask-row/pause handling.
- Change-phase digit keys no longer quick-take denominations; TillGrid gets `showKeys={false}` from Game (Money key-cap code stays).
- Vim keys h/j/k/l only translate inside `keynav` containers and ignore events from INPUT/SELECT/TEXTAREA targets.
- Every commit message ends with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01BFFLt2muz8HfETCzn4N1ok`

---

### Task 1: lib polish — vim keynav + focusFirst fallback

**Files:**
- Modify: `src/lib/keynav.ts`, `src/lib/focus.ts`

- [ ] **Step 1: keynav vim translation + input guard**

In `src/lib/keynav.ts`, replace the `onKeydown` function inside `keynav` (the pure `nextIndex` is untouched):

```ts
  const VIM: Record<string, string> = {
    h: 'ArrowLeft', j: 'ArrowDown', k: 'ArrowUp', l: 'ArrowRight',
  };
  function onKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
    const key = VIM[e.key] ?? e.key;
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(key)) return;
    const all = [...node.querySelectorAll<HTMLButtonElement>('button')];
    const current = all.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;
    const next = nextIndex(all.map((b) => !b.disabled), current, key, cols());
    if (next === null) return;
    e.preventDefault();
    all[next].focus();
  }
```

(`VIM` is declared inside `keynav`, above `onKeydown`.)

- [ ] **Step 2: focusFirst container fallback**

`src/lib/focus.ts` becomes:

```ts
/** Focus the first enabled interactive control inside a container.
 *  Falls back to focusing the container itself so keyboard focus never
 *  drops to <body> when a region has no focusable children. */
export function focusFirst(container: HTMLElement | null): void {
  if (!container) return;
  const el = container.querySelector<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled)',
  );
  if (el) {
    el.focus();
    return;
  }
  container.tabIndex = -1;
  container.focus();
}
```

- [ ] **Step 3: Verify + commit**

Run: `npx vitest run` green (186); `npm run check` 0/0; `npm run build` clean.

```bash
git add src/lib/keynav.ts src/lib/focus.ts
git commit -m "feat: vim keys in menus and a focus fallback for empty regions"
```

---

### Task 2: typed change amounts

**Files:**
- Modify: `src/routes/Game.svelte`, `src/lib/ChangePhase.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`

- [ ] **Step 1: Game state + helpers**

In `src/routes/Game.svelte`:

Imports: add `parseEntry` to the `../core/money` import; add `makeChange` to the `../core/change` import (which currently imports `canMakeChange`).

State (near `askOpen`): `let typedChange = $state('');`

Helpers (near `onTipp`):

```ts
  function typeChange(d: string) {
    if (typedChange === '') pile = []; // typing replaces the clicked pile
    if (d === ',') {
      if (typedChange.includes(',')) return;
      typedChange = typedChange === '' ? '0,' : typedChange + ',';
      return;
    }
    const [euros, cents] = typedChange.split(',');
    if (cents !== undefined) {
      if (cents.length >= 2) return;
    } else if (euros.length >= 4) return;
    typedChange += d;
  }

  function submitTyped() {
    if (!round) return;
    if (typedChange === '') {
      confirmChange();
      return;
    }
    const amount = parseEntry(typedChange);
    typedChange = '';
    const pieces = makeChange(round.till, amount);
    if (pieces === null && amount === round.changeDue) {
      // computed correctly but the till cannot pay — steer into the ask flow
      errorBuzz($settings.sound);
      askOpen = true;
      return;
    }
    pile = pieces ?? [];
    confirmChange();
  }
```

- [ ] **Step 2: onKey change-phase branch**

Replace the current change-phase key handling in `onKey`:

```ts
    } else if (round.phase === 'change') {
      if (askOpen && /^[1-5]$/.test(k)) {
        onAsk(COIN_DENOMS[Number(k) - 1]);
        e.preventDefault();
        return;
      }
      if (/^[0-9]$/.test(k) || k === ',' || k === '.') {
        if (round.changeDue === 0) return; // Finish rounds: nothing to type
        typeChange(k === '.' ? ',' : k);
        e.preventDefault();
      } else if (k === 'Backspace') {
        typedChange = typedChange.slice(0, -1);
        e.preventDefault();
      } else if (k === 'Enter') { submitTyped(); e.preventDefault(); }
      else if (k === 'a' || k === 'A') { askOpen = !askOpen; e.preventDefault(); }
      else if (k === 'n' || k === 'N') { onNotEnough(); e.preventDefault(); }
      else if (k === 't' || k === 'T') { onTipp(); e.preventDefault(); }
    }
```

(The old `take(DENOMS[Number(k) - 1])` digit mapping is deleted; `DENOMS` may become unused in Game.svelte — check with grep and drop it from the import if so.)

In the Escape branch, ABOVE the askOpen check:

```ts
      if (typedChange !== '') {
        typedChange = '';
        e.preventDefault();
        return;
      }
```

- [ ] **Step 3: Mutual exclusion + resets**

- `take(d)`: first line gains `typedChange = '';`
- `startRound()`: add `typedChange = '';` next to `askOpen = false;`
- `nextPayer()`: add `typedChange = '';` next to `askOpen = false;`
- `finishRound()`: add `typedChange = '';` next to the `askOpen = false;` added last round.
- `setPaused()`: the `if (on) askOpen = false;` line becomes `if (on) { askOpen = false; typedChange = ''; }`.

- [ ] **Step 4: ChangePhase display + Game usage**

`src/lib/ChangePhase.svelte`: add optional prop `typedDisplay: string` default `''` (extend the destructuring + type). Above the `.actions` div:

```svelte
{#if typedDisplay !== ''}
  <div class="typed">⌨ {typedDisplay} <small>{$t('game.typed-hint')}</small></div>
{/if}
```

with style:

```css
  .typed {
    background: var(--cream); color: var(--ink);
    border-radius: var(--radius); padding: 0.4rem 0.8rem;
    font-size: 1.2rem; font-weight: bold; font-variant-numeric: tabular-nums;
    display: flex; align-items: baseline; gap: 0.6rem;
    animation: op-slide-up 0.15s ease-out;
  }
  .typed small { font-weight: normal; font-size: 0.7rem; opacity: 0.7; }
```

Game usage: on the `<ChangePhase>` call change `showKeys={hasKeyboard || wideScreen}` to `showKeys={false}` and add:

```svelte
            typedDisplay={typedChange === '' ? '' : formatEuro(parseEntry(typedChange), symbolFirst)}
```

(`hasKeyboard`/`wideScreen` may now be unused — `hasKeyboard = true` assignment can stay as dead-simple state; if svelte-check flags unused vars, remove `wideQuery`/`wideScreen`/`hasKeyboard` and their effect entirely.)

Also in `src/routes/Tutorial.svelte`: change its ChangePhase usage from `showKeys={true}` to `showKeys={false}` — the digit hotkeys the key-caps advertise no longer exist anywhere.

- [ ] **Step 5: i18n**

en: `'game.typed-hint': 'Enter gives this change',`
de: `'game.typed-hint': 'Enter gibt dieses Wechselgeld',`

- [ ] **Step 6: Verify + commit**

Run: `npx vitest run` green; `npm run check` 0/0; `npm run build` clean.

```bash
git add src/routes/Game.svelte src/lib/ChangePhase.svelte src/i18n
git commit -m "feat: type the change amount and the till pays itself"
```

---

### Task 3: flash on top + always-visible motivating details

**Files:**
- Modify: `src/routes/Game.svelte` (CSS only), `src/lib/RoundDetails.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`

- [ ] **Step 1: Flash position**

In Game.svelte's style block, the positioned `.flash` rule changes `inset: auto 0 30% 0;` to `inset: 16% 0 auto 0;`. The `.badge-toast` override keeps the toast at the bottom — change its rule from `bottom: 12%;` to `inset: auto 0 12% 0;` so it still anchors low.

- [ ] **Step 2: RoundDetails rework**

`src/lib/RoundDetails.svelte` becomes:

```svelte
<!-- src/lib/RoundDetails.svelte -->
<script lang="ts">
  import type { RoundLogEntry } from '../core/session';
  import { t } from '../i18n';

  let { log }: { log: RoundLogEntry[] } = $props();

  const served = $derived(log.filter((e) => e.success).length);
  const bestStreak = $derived.by(() => {
    let cur = 0;
    let best = 0;
    for (const e of log) {
      cur = e.success ? cur + 1 : 0;
      best = Math.max(best, cur);
    }
    return best;
  });
  const avgS = $derived(
    log.length === 0 ? 0 : log.reduce((s, e) => s + e.ms, 0) / log.length / 1000,
  );
  const acc = $derived(log.length === 0 ? 0 : served / log.length);
  const verdictKey = $derived(
    acc >= 0.9 ? 'result.verdict.great' : acc >= 0.6 ? 'result.verdict.good' : 'result.verdict.train',
  );
</script>

<div class="details">
  {#if log.length > 0}
    <div class="summary">
      <span class="ok-n">✓ {served}/{log.length}</span>
      {#if bestStreak >= 2}<span>🔥 {bestStreak}</span>{/if}
      <span>Ø {avgS.toFixed(1)}s</span>
    </div>
    <p class="verdict">{$t(verdictKey)}</p>
    <ol>
      {#each log as e, i (i)}
        <li class:failed={!e.success}>
          <span class="mark">{e.success ? '✓' : '✗'}{#if e.success && e.errors.length === 0}<span class="star">⭐</span>{/if}</span>
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
  .summary {
    display: flex; justify-content: center; gap: 1rem;
    font-weight: bold; font-size: 1.05rem;
  }
  .ok-n { color: var(--ok); }
  .verdict { color: var(--accent); font-size: 0.9rem; margin: 0.25rem 0 0; }
  ol {
    list-style: none; padding: 0.5rem; margin: 0.5rem 0 0;
    max-height: 32dvh; overflow-y: auto;
    background: rgb(0 0 0 / 0.35); border-radius: var(--radius);
    text-align: left; font-size: 0.85rem;
  }
  li {
    display: grid; grid-template-columns: 2rem 1fr auto auto;
    gap: 0.4rem; padding: 0.25rem 0; align-items: baseline;
  }
  li.failed .mark { color: var(--danger); }
  .mark { color: var(--ok); font-weight: bold; }
  .star { font-size: 0.7rem; margin-left: 0.1rem; }
  .time { font-variant-numeric: tabular-nums; opacity: 0.85; }
  .pts { font-variant-numeric: tabular-nums; color: var(--accent); font-weight: bold; }
  .errs { grid-column: 2 / -1; color: var(--danger); font-size: 0.8rem; }
</style>
```

(The toggle and `open` state are gone; the `result.details` i18n key becomes unused — delete it from BOTH dictionaries and grep `result.details` to confirm zero references.)

- [ ] **Step 3: i18n verdicts**

en:

```ts
  'result.verdict.great': 'Sharp as a tack — the regulars love you!',
  'result.verdict.good': 'Solid shift — keep the coins moving!',
  'result.verdict.train': 'Rough night — a round of practice pays off.',
```

de:

```ts
  'result.verdict.great': 'Messerscharf gerechnet — die Stammgäste lieben dich!',
  'result.verdict.good': 'Solide Schicht — weiter so!',
  'result.verdict.train': 'Harte Nacht — eine Runde Training lohnt sich.',
```

- [ ] **Step 4: Verify + commit**

Run: suite green; check 0/0; build clean. (EndOverlay already scrolls; RoundDetails max-height dropped to 32dvh to leave room for the summary.)

```bash
git add src/routes/Game.svelte src/lib/RoundDetails.svelte src/i18n
git commit -m "feat: success flash up top and always-on motivating round details"
```

---

### Task 4: Einstellungen fit + Game menu button

**Files:**
- Modify: `src/routes/Home.svelte`, `src/routes/Game.svelte`, `src/i18n/en.ts`, `src/i18n/de.ts`

- [ ] **Step 1: Home minor row**

Replace the `.row` / `.row .minor` styles:

```css
  .row { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); }
  .row .minor {
    min-width: 0; background: none; color: var(--cream);
    border: 1px solid var(--wood-light); font-size: 0.8rem;
    padding: var(--space-2) var(--space-1);
    overflow-wrap: anywhere; hyphens: auto;
  }
```

- [ ] **Step 2: Game header menu button**

In Game.svelte's header, after the score span:

```svelte
    <button class="menu-btn" aria-label={$t('game.menu')} onclick={() => setPaused(true, true)}>☰</button>
```

with style `.menu-btn { background: none; color: var(--cream); font-size: 1.2rem; padding: 0 0.3rem; min-height: 0; }`.

- [ ] **Step 3: i18n**

en: `'game.menu': 'Menu',`  de: `'game.menu': 'Menü',`

- [ ] **Step 4: Verify + commit**

Run: suite green; check 0/0; build clean.

```bash
git add src/routes/Home.svelte src/routes/Game.svelte src/i18n
git commit -m "fix: settings label fits and the game gets a tappable menu button"
```

---

### Task 5: docs + tutorial wording polish

**Files:**
- Modify: `docs/twa.md`, `src/i18n/en.ts`, `src/i18n/de.ts`

- [ ] **Step 1: twa.md init wording**

Find the `bubblewrap init` step and correct it: `bubblewrap init --manifest https://13.github.io/ordersplease/manifest.webmanifest` takes the WEB manifest URL (never the checked-in `twa-manifest.json`); the checked-in `twa-manifest.json` is the file Bubblewrap generates/maintains — copy it into the init directory to reuse the committed answers instead of re-answering prompts. Also fix any line claiming init "creates a local bubblewrap.json" — the file is `twa-manifest.json`. Keep the rest of the walkthrough as-is.

- [ ] **Step 2: tutorial coach labels**

The coach text must name the buttons as labeled (`game.confirm` = 'Give change' / 'Wechselgeld geben'):

en changes:

```ts
  'tutorial.s2.change': 'They paid more than the total. Click coins and notes from the till until the pile matches the change, then press Give change.',
  'tutorial.s3.after-ask': 'They gave you 50 cents more, so now you owe a full euro. Hand over 1 € and press Give change.',
```

de changes:

```ts
  'tutorial.s2.change': 'Es wurde mehr bezahlt. Klicke Münzen und Scheine aus der Kasse, bis der Stapel dem Rückgeld entspricht, dann drücke Wechselgeld geben.',
  'tutorial.s3.after-ask': 'Du hast 50 Cent extra bekommen, jetzt schuldest du einen ganzen Euro. Gib 1 € und drücke Wechselgeld geben.',
```

- [ ] **Step 3: Verify + commit**

Run: suite green; check 0/0; build clean.

```bash
git add docs/twa.md src/i18n
git commit -m "docs: correct bubblewrap flow and tutorial button wording"
```

---

## Verification checklist (whole plan)

- Suite green; svelte-check 0/0; both base-path builds clean.
- Manual: change phase — type `450` Enter on a 4,50 change → success; type `5` shows 5,00 €; `0,5` shows 0,50 €; wrong typed amount burns a try with the usual feedback; typed-correct on a shortage round opens the ask row without burning a try; Escape clears the entry first; clicking the till clears the entry; Finish rounds ignore digits.
- Flash appears in the upper third; badge toast stays low; details always visible with summary/verdict/⭐; "Einstellungen" fits at 360px; ☰ opens the pause menu; h/j/k/l walk Home/Levels/Practice/pause menus but never fire while typing in MenuEditor inputs.
