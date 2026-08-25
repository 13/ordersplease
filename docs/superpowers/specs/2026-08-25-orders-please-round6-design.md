# Orders, Please — Round 6 Design Spec

Date: 2026-08-25
Status: approved design, pre-implementation
Builds on: round 5 (shipped, v1.3.0)

## Purpose

Package the game for the Play Store (TWA), teach new players with a coached
"First Day" tutorial, surface long-term progress with per-day history and
charts, and deepen play with three mechanics: happy hour, a tip jar, and
rowdy customers.

## 1. Play Store Packaging (TWA)

- **Maskable icons**: generate `public/pwa-512-maskable.png` (and 192
  variant) from `icon.svg` with safe-zone padding (icon content within the
  central 80%); manifest gains entries with `purpose: 'maskable'`.
  Existing `purpose: 'any'` icons stay.
- **`twa-manifest.json`** (repo root): Bubblewrap project config — package id
  `de.egger.ordersplease`, host `13.github.io`, start path `/ordersplease/`,
  app name "Orders, Please", theme/background colors matching the manifest,
  launcher name "Orders".
- **`public/.well-known/assetlinks.json`**: digital asset links statement
  with `REPLACE_WITH_SHA256_FINGERPRINT` placeholder; deployed with the app
  so the TWA verifies once the user swaps in their keystore fingerprint.
- **`docs/twa.md`**: expand into a full walkthrough — install Bubblewrap,
  `bubblewrap init --manifest`, keystore creation, fingerprint extraction
  (`keytool -list -v`), replacing the assetlinks placeholder, `bubblewrap
  build`, testing the AAB, Play Console upload. Signing itself stays on the
  user's machine (needs their keystore); no store work in this round.

## 2. Coached Tutorial — "First Day" (level 0)

- **`src/core/tutorial.ts`**: pure fixed script, no rng, exported as
  `TUTORIAL_STEPS`: three scripted orders with fixed menu prices (default
  menu), fixed payments, and per-phase coach text keys:
  1. one item (Beer 4,00), exact payment 4,00 — teaches reading the order
     and entering the sum;
  2. two items (Water 2,50 + Cola 3,00), pays 10,00 — teaches till clicks,
     the pile, and Confirm;
  3. one item (Wine 4,50), pays 5,00 — teaches the Ask flow: the till is
     pre-seeded with only 1€-and-larger denominations (no 50c/20c/10c), so
     50c change is impossible; the player asks for 50c, payment becomes
     5,50, and change is a single 1€ coin.
- **`src/routes/Tutorial.svelte`**: new route reusing `SumPhase`,
  `ChangePhase`, `TillGrid`, `MenuCard` presentational components. No
  timers, no walkouts, no score. A coach bar (accent background, top of
  screen) shows the current step's instruction; a wrong sum or wrong
  confirm shows a gentle correction line and lets the player retry
  (unlimited). Completing step 3 shows a "ready for your first shift"
  finish card with a button to level 1.
- **Entry points**: Levels map shows "0 · First Day" tile before level 1
  (own icon, no stars); first app launch with no progress routes the Play
  button through a suggestion to start with the tutorial (dismissable);
  Settings gains a "Replay tutorial" button.
- **Persistence**: completion recorded in `op.seen` as `tutorial` (reuses
  the round-5 seen store).
- **i18n**: all coach texts, corrections, finish card, map/settings labels
  in EN+DE (`tutorial.*` keys).

## 3. Stats History + Charts

- **`src/stores/history.ts`**: `op.history` persisted envelope —
  `Record<string /* yyyy-mm-dd local */, { rounds: number; correct: number;
  ms: number; tips: number }>`. Pure helpers `recordDay(history, key,
  delta)` and `pruneHistory(history, todayKey, keepDays=60)` (drops entries
  older than 60 days), unit-tested.
- **Recording**: in `finalize()`, aggregate the session's roundLog (rounds
  played, successes, summed ms, tips earned) into today's entry, then
  prune. All modes count (practice included — it is real training).
- **Stats screen**: a "Last 14 days" section with a pure-SVG chart (no
  dependencies): bars = rounds/day, overlaid line = accuracy %; empty days
  render as gaps. Below it one line: most common error type of the last 7
  days (from the session error keys already tracked in `op.stats`) — shown
  only when there is data. Reduced-motion irrelevant (static SVG).

## 4. New Mechanics

Determinism rule (project invariant): every roll consumes `session.rng`
unconditionally at a fixed point; cosmetic randomness uses `Math.random`.

- **Happy hour** (levels ≥ 12, level + rush + daily where the ramp
  reaches 12):
  - Rolled ONCE at session/level start: `happyHourStart` = round index in
    [2, ordersPerLevel-3] with probability `happyHourProb` (anchor values:
    L14 0.3, L22 0.4, L30 0.5, 0 below 12), else null. Rush and daily roll
    the same way ONCE at session start using their starting params (a
    session that starts below level 12 has no happy hour even if the ramp
    later crosses 12 — one roll, fixed point, deterministic).
  - Active for 3 consecutive rounds from `happyHourStart`: every menu price
    is discounted 20%, rounded to the nearest 10c, minimum 10c
    (`happyHourPrice(cents)` pure helper). Order totals, expected sums,
    payments, and change all use discounted prices — the discounted menu IS
    the menu for those rounds.
  - UI: banner chip "Happy Hour!" in the header while active; the menu
    card simply shows the discounted prices (no strikethrough — the banner
    carries the message). Menu visibility rules unchanged.
  - Scoring unchanged (totals are just smaller).
- **Tip jar** (all levels, level/rush/daily modes; not practice):
  - Earn: round success AND first try AND no hints AND patience ≥ 50% →
    tip = 10% of the order total rounded UP to the 10c grid, minimum 10c
    (`tipFor(totalCents)` pure helper). Split rounds: evaluated on the
    final payer completing the group, on the group total.
  - Jar: session-scoped state, resets at level start, shown in the header
    as "🫙 1,20 €" once > 0.
  - Spend: the Tipp button costs 50c from the jar when jar ≥ 50c (no score
    debt); otherwise it falls back to the existing 25-point hint debt.
    Tipp UI shows which price applies.
  - Stats: lifetime tips earned accumulates into `op.stats`
    (`tipsEarnedCents`), and daily tips go into history (§3).
- **Rowdy customer** (levels ≥ 16; level/rush/daily):
  - Pre-rolled per round like disputes: `rowdyProb` anchors L22 0.1,
    L30 0.15, 0 below 16. Mutually exclusive with trap/tab/split/dispute
    rounds — rowdy applies only to plain normal rounds (keeps mechanic
    stacking sane).
  - Effect: patience for that round × 0.5 (rounded down, min 5s), score
    for that round × 2 on success. Banner chip "In a hurry!" / "In Eile!"
    while active.
- **Gate summary**: happy hour 12, rowdy 16 (existing: underpay 6, tab 8,
  dispute 9, split 11). Exact 0 strictly below each gate.

## Testing

- Core TDD: `happyHourPrice` (20% off, 10c rounding, 10c floor),
  happy-hour roll placement + window (params anchors, gate at 12),
  `tipFor` (round-up, minimum), tip eligibility rules, rowdy params
  (anchors, gate at 16, exclusivity with other round kinds),
  `TUTORIAL_STEPS` script shape (3 steps, expected sums/changes
  arithmetically correct, step-3 till really cannot make exact change),
  history `recordDay`/`pruneHistory` (aggregate, 60-day cap, idempotent
  prune).
- Determinism: session generation with a fixed seed produces identical
  round sequences with mechanics enabled (roll order fixed).
- UI gates: svelte-check 0/0, suite green, both builds clean; manual pass:
  tutorial keyboard-only completion, one happy-hour level, one rowdy
  round, tip earn + tip-funded hint.

## Out of Scope

Play Console upload/signing (user's machine), leaderboards, additional
languages, till-refill tip spending, argumentative rowdy variant, stats
export.
