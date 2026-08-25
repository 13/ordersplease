# Orders, Please — Round 5 Design Spec

Date: 2026-08-25
Status: approved design, pre-implementation
Builds on: round 4 (shipped, v1.2.0)

## Purpose

Make the game fully keyboard-operable with real focus management and an
unambiguous till layout; ship it (CI + GitHub Pages + PWA audit); teach new
players via first-encounter explainers; deepen progression (best scores,
streak flame, 12 achievements); add an "always show prices" assist; and pay
down tech debt (Game.svelte split, deferred minors, a11y sweep).

## 1. Keyboard & Focus

- **Focus management** — `src/lib/focus.ts`: `focusFirst(container: HTMLElement)`
  focuses the first enabled button/input/select. Applied:
  - when any overlay opens (EndOverlay → its primary action, PauseOverlay →
    Resume, DisputeDialog → first option, ExplainerCard → its dismiss button)
    via `$effect` in each component;
  - on every route change (App focuses the new screen's first control after
    render);
  - when an overlay closes, focus returns to the game main region.
- **Till button redesign** (`Money.svelte`): amount big center (unchanged);
  count = filled circle top-right (unchanged); hotkey = bottom-left
  **key-cap**: bordered square, monospace, subtle inset shadow, cream-on-dark
  — reads as a keyboard key, never as money. Key-caps always visible at
  viewport width ≥ 700px (media query); below that, current behavior
  (appear after first physical keydown).
- **Dispute dialog**: options answerable with keys 1/2; Enter activates the
  focused option.
- **Ask row**: when open, its coins are pickable with keys 1-5 (coin
  denominations in DENOMS order); Esc closes the ask row (consuming that Esc
  before the pause menu sees it).
- **Audit**: MenuEditor and Settings fully tabbable; pause-menu actions
  arrow-navigable (keynav on the actions column); all overlay actions
  reachable by Tab with visible focus.

## 2. Ship It (CI + Pages + PWA audit)

- **Base-path awareness**: vite `base` becomes `'/ordersplease/'` in
  production builds (env-controlled: `base: process.env.OP_BASE ?? '/'` so
  local dev/preview stay at `/`). All asset references become base-aware:
  `index.html` icon link, Home's logo `src`, manifest icons (vite-plugin-pwa
  handles manifest/asset URLs under `base` automatically; hand-written
  absolute `/icon.svg` references switch to relative or
  `import.meta.env.BASE_URL`).
- **GitHub Actions** (`.github/workflows/deploy.yml`): on every push and PR —
  `npm ci`, `npx vitest run`, `npm run check`, `npm run build`; on push to
  `main` additionally build with `OP_BASE=/ordersplease/` and deploy `dist/`
  to GitHub Pages (actions/upload-pages-artifact + actions/deploy-pages,
  `pages: write` + `id-token: write` permissions).
- **Lighthouse/PWA polish**: `<meta name="description">`, `apple-touch-icon`
  link (reuses pwa-192.png), `lang` already dynamic. No other head changes.
- **TWA prep**: `docs/twa.md` — step notes for wrapping the Pages URL with
  Bubblewrap for Play Store later (docs only, no store work).

## 3. Onboarding Explainers

- `ExplainerCard.svelte`: modal card (title, 2-3 sentence body, one dismiss
  button "Got it"/"Alles klar"); pauses the game while open using the
  existing pause infrastructure (patience + timers frozen, order text NOT
  hidden — the card overlays anyway); Enter/Space/click dismisses; focus
  lands on the dismiss button.
- Shown ONCE per mechanic, persisted in `op.seen` (`persisted<string[]>`),
  triggered the first time each occurs in any mode:
  - `tipp` — first round of the player's first session (the Tipp button
    exists);
  - `shortage` — the first time the till cannot make exact change (ask flow);
  - `trap` — the first time an underpaid payment is revealed (change phase
    entered with paymentCents < total);
  - `tab` — first tab round start;
  - `dispute` — first dispute dialog (card shows BEFORE the dialog);
  - `split` — first split round start.
- i18n: `explain.<id>.title` and `explain.<id>.body` × 6 × EN/DE, plus
  `explain.dismiss`.

## 4. Progression Depth

- **Best per level**: `progress` store gains
  `best: Record<number, { score: number; ms: number }>` (score-first
  comparison, ms tiebreak; ms = sum of the level's round times). Recorded on
  level win in `finalize()`. Levels map shows the best score under the name
  (small, accent).
- **Streak flame**: Game header shows `🔥n` when the current streak ≥ 3.
- **Achievements**: `src/core/badges.ts` — pure
  `newBadges(ctx: BadgeContext, owned: string[]): string[]` evaluated in
  `finalize()`; `BadgeContext` carries mode, finished, stars, level reached,
  session flags (trapCaught, disputeWon, tabServed, splitServed — collected
  during play), rush elapsedMs, daily streak. 12 ids:
  `first-win, three-star, streak-10, trap-caught, dispute-won, tab-served,
  split-served, level-10, level-20, level-30, rush-5min, daily-7`.
  Persisted `op.badges` (`persisted<string[]>`). Unlock toast (reuses the
  flash styling, badge icon + name, 2s). Stats screen gains a badge wall:
  12 tiles, locked ones greyed with 🔒, each with i18n name
  (`badge.<id>` × EN/DE).
- **Stats history**: skipped this round (YAGNI — the badge wall and best
  scores cover progression visibility).

## 5. Always Show Prices (assist)

- `settings.alwaysShowPrices: boolean` (default false); Settings checkbox
  (`settings.show-prices`: 'Always show prices' / 'Preise immer zeigen').
- When on: the Game never hides menu prices — `menuHidden` stays false and
  the menu-hide timer is not armed, regardless of difficulty params. Pure
  display assist: no scoring change, applies in every mode (daily ranked
  included — it is the player's own choice).

## 6. Tech Debt

- **Game.svelte split**: extract `src/lib/SumPhase.svelte` (prompt, Numpad,
  Tipp button) and `src/lib/ChangePhase.svelte` (payment chips, till, pile,
  ask row, action bar) as thin presentational components taking props +
  callbacks; orchestration, timers, and key handling stay in Game.svelte
  (target ≤ ~450 lines).
- **Deferred minors** (from the ledger): `migrateMenuItems` spreads instead
  of rebuilding; `matchMedia` idiom unified (bare `matchMedia`); comment on
  keynav's unreachable clamp guard; `game.correct` orphaned key removed.
- **A11y sweep**: every icon-only button has an aria-label; overlays carry
  `role="dialog"`/`aria-label`; final axe-style manual pass noted in the
  plan's verification.

## Testing

- Core TDD: `newBadges` (each of the 12 trigger conditions + no-duplicates +
  already-owned filtering), progress `best` recording (better score wins,
  tiebreak ms, worse discarded), explainer seen-list persistence helpers.
- UI gates: svelte-check 0/0, build clean, suite green; CI workflow proves
  itself on the first push; manual keyboard-only walkthrough (no mouse) as
  the round's acceptance test.

## Out of Scope

Play Store publishing, guided tutorial round, stats history charts,
leaderboards, additional languages.
