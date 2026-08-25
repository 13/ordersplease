# Orders, Please — Design Spec

Date: 2026-08-25
Status: approved design, pre-implementation

## Purpose

Mental-arithmetic trainer for bar work. Player receives drink orders, computes the sum,
takes payment, and gives correct change from a finite till — under time pressure. Goal:
transferable head-math skill for real bar shifts.

## Platform & Stack

- **PWA** (installable on Android via browser; optional TWA wrap for Play Store later).
- **Svelte 5 + Vite + TypeScript**, `vite-plugin-pwa` for offline + install.
- No backend, no accounts. All persistence in `localStorage`.
- i18n: English + German, own tiny JSON loader (no library).
- Money is **integer cents everywhere**. No floats. Display format: `4,50 €`.

## Architecture

```
src/
  core/            # pure TS, zero Svelte imports, unit-tested with Vitest
    money.ts       # cents math, formatting "4,50 €"
    menu.ts        # MenuItem {id, name, priceCents}; default menu + custom menu CRUD
    order.ts       # order generator: items/quantities from difficulty params
    till.ts        # till model: denominations 5c..50€ with counts, canMakeChange(), shortage detection
    change.ts      # change solver: optimal coin set; alternates when short ("ask for 1€ more")
    round.ts       # round state machine: ORDER_SHOWN → SUM_INPUT → PAYMENT → CHANGE_INPUT → RESULT
    difficulty.ts  # single param table driving all difficulty (see Difficulty section)
    scoring.ts     # score, streaks, star thresholds, error classification
    text-order.ts  # natural-sentence order rendering (EN/DE), quantity words
  lib/             # Svelte components (till grid, numpad, patience bar, menu card, ...)
  routes/          # screens: Home, Game, Rush, Stats, MenuEditor, Settings
  i18n/            # en.json, de.json
  stores/          # settings, stats, progress — persisted to localStorage
```

Rule: `core/` must be importable without DOM. All game rules tested headless.
Svelte layer is a thin renderer of the round state machine.

## Round Mechanics

One round = one customer:

1. **Order shown** — natural sentence ("Two beers and a veneziano, please").
   Menu card visible on screen; on higher levels prices hide after a few seconds
   (memory training).
2. **Sum input** — numpad; player types total. Wrong answer: patience penalty + retry,
   max 2 tries, then round failed and correct answer shown.
3. **Payment** — customer hands money, rendered as actual notes/coins ("gives you 20 €").
   Generator picks: exact / round note / awkward mix (e.g. 5 € note + 50c coin).
4. **Change via till** — player taps coins/notes from the till grid to build a change
   pile, then confirms. Till counts are finite and drain over the session.
   Wrong pile: penalty + retry (same 2-try rule).
5. **Shortage branch** — when the till cannot make exact change with available
   denominations, two valid moves:
   (a) an alternate combination, if one exists;
   (b) "Ask customer" button → dialog requesting an extra coin
       ("Do you have 50 cents?") so change becomes makeable. Correct ask = bonus.
6. **Result flash** — time, correctness, patience bonus. Next customer.

**Patience / queue:** customers queue visibly; each has a draining patience bar.
Empty bar = customer walks out (lost points / life). Fast correct rounds earn a speed
multiplier.

## Modes

- **Levels** (1..~30): fixed number of orders per level; difficulty from the param
  table; 3 failed rounds allowed per level; 1–3 stars by score.
- **Rush** (endless): difficulty ramps continuously; 3 walked-out customers ends the
  night; highscore tracked.

## Difficulty

One table in `difficulty.ts` drives everything; Rush interpolates it continuously.

| Param | L1 | ~L10 | ~L20 | ~L30 |
|---|---|---|---|---|
| Items per order | 1 | 2-3 | 3-5 | 4-6 |
| Price style | round € | ,50 steps | ,10/,20 steps | mixed ugly |
| Payment | exact/round note | round note | awkward mix | awkward + tip talk |
| Patience (s) | 45 | 30 | 20 | 15 |
| Menu prices visible | always | 5s then hide | 3s | hidden |
| Till scarcity | full | 1 denom low | 2 low | rotating shortages |
| Mid-order change | – | – | 20% | 35% |
| Change-pile total shown | yes | yes | no | no |

Mid-order change: after the order is shown, customer amends it
("actually, make that three beers") before sum input.

## Scoring

- Base 100 per round × speed multiplier (1–3×, from patience remaining)
  × first-try bonus (1.5× when no retries).
- Shortage solved via correct ask: +50.
- Streak: consecutive perfect rounds +10% each, capped at 2×.
- Stars: 1 = level survived, 2 = ≥70% of max score, 3 = ≥90%.

**Error taxonomy** (feeds stats): `sum-wrong`, `change-wrong`, `shortage-missed`
(gave suboptimal/impossible change), `parse-wrong` (sum wrong on multi-item order —
heuristic attribution), `timeout`.

## Screens

- **Game** (portrait, one-handed): header (lives, level, score), queue with patience
  bars, order sentence, collapsible menu card, phase area (numpad / payment view +
  till grid), change pile + Confirm + Ask-customer buttons.
- **Till grid**: 2 rows notes (5/10/20/50 €), 2 rows coins (5c/10c/20c/50c/1€/2€);
  each cell = coin image + count badge; tap adds to pile, tap pile coin returns it;
  greyed at 0. Pile running total shown only on easy levels.
- **Home**: Play (levels map), Rush, Stats, Menu editor, Settings.
- **Levels map**: vertical scroll, stars per level.
- **Stats**: error rate per error type, average seconds per order, daily streak
  calendar, rush highscore, training hint ("train change-giving").
- **Menu editor**: list, add/edit/delete drink (name + price); toggle default vs
  custom menu. Default menu ships with e.g. beer 4,00 €, veneziano 5,00 €,
  water 2,50 €.
- **Settings**: language EN/DE, sound on/off, currency symbol position,
  reset progress.

**Style**: warm bar aesthetic — dark wood background, cream menu card with serif
prices, flat SVG coin sprites, minimum 48px touch targets, animation + click-sound
feedback.

## Persistence

`localStorage` keys: settings, custom menu, level progress + stars, stats, rush
highscore. Versioned schema field for future migration.

## Testing

- `core/` fully unit-tested with Vitest (money math, change solver incl. shortage
  cases, order generator bounds, state machine transitions, scoring).
- Svelte components: smoke tests where cheap; manual play-testing for feel.

## Out of Scope (v1)

Multiplayer, drink-making minigame, inventory simulation, accounts/backend, iOS,
running tabs, split-bill rounds, tips-splitting math beyond "make it 20" recognition,
additional languages. Candidates for v2: running tabs, split bill, happy-hour price
changes, distraction events, wrong-change traps.
