# Orders, Please — Round 3 Design Spec

Date: 2026-08-25
Status: approved design, pre-implementation
Builds on: round 2 (shipped, v1.0.0)

## Purpose

Fix two shipped bugs (rush dead-air, untranslated German menu items), overhaul
input ergonomics (euros-first entry, full physical-keyboard play), add pause /
game menu / keyboard navigation, steepen the early difficulty curve, add a paid
hint ("Tipp") system and streak-scaled praise messages, replace the logo, and
run a UX modernization pass. No new game mechanics; no deploy work.

## Bug Fixes

### Rush continuation (dead-air after first order)
Cause: the rush spawn cooldown (`patienceSeconds * 0.8 * 1000`, ~36 s early)
keeps ticking regardless of queue state; after the first customer is served
the queue sits empty for up to ~25 s.
Fix (core, `session.ts`, tested): whenever a round completes in rush and the
queue is empty, the remaining spawn cooldown is capped:
`spawnCooldownMs = Math.min(spawnCooldownMs, 1500)`. The between-customer
breather remains only while other customers are queued.

### German menu-item names
Default menu names are hardcoded English. Fix: default items carry i18n name
keys (`menu.item.beer`, `menu.item.veneziano`, `menu.item.water`,
`menu.item.cola`, `menu.item.wine`, `menu.item.coffee`). A pure helper
`localizedDefaultMenu(locale)` (core, tested) resolves names at session build:
DE Bier, Veneziano, Wasser, Cola, Wein, Kaffee. Order sentences, the menu
card, and stats all inherit the localized name because they read `item.name`.
Custom menus keep the names the user typed. German plural stays uninflected
(existing rule).

## Input Ergonomics

### Euros-first entry
The numpad becomes `1-9, 0, ',', C, OK`. Typing `5` → `5,00 €`; `4,5` →
`4,50 €`; a second comma is ignored; at most 2 decimals accepted; empty input
keeps OK disabled. A pure `parseEntry(input: string): Cents` helper (core,
tested) converts the typed string; entries that are not a multiple of 5 cents
are still submitted as typed (they will simply be wrong answers).

### Physical keyboard play
A key handler on the Game screen (active only there, never while an input
element is focused):
- Sum phase: digits and comma type into the numpad, Backspace deletes,
  Enter = OK.
- Change phase: keys `1`–`0` map to the ten denominations in DENOMS order
  (1 = 50 €, 2 = 20 €, … 0 = 5c); small key badges on the till cells show the
  mapping; Enter = Confirm/Finish; `A` = Ask customer; `N` = Not enough.
- `T` = Tipp (both phases).

### Finish button
When `changeDue === 0` in the change phase, the confirm button relabels to
**Finish** (`game.finish`: EN 'Finish', DE 'Fertig') and the till grid renders
dimmed/disabled — the zero-change case is an explicit action, not an empty
"give change".

## Pause, Game Menu, Keyboard Navigation

- **Pause state** in the Game screen: while paused the tick loop skips
  `tickSession` (patience frozen) and the amend/wave/flash timers freeze —
  on pause each pending timer's remaining time is captured, on resume it is
  re-armed with the remainder. The play area dims; the order text is hidden
  while paused (no free reading time for memory mechanics).
- **Space** toggles plain pause (game screens only).
- **Esc** opens the game menu: the same pause overlay in menu variant with
  Resume / Restart / Sound toggle / Home. Esc again or Resume closes it.
- **During a dispute**: the dialog is hidden while the menu is open and the
  menu offers only Resume / Home (no restart-scumming the memory question).
- **Keyboard navigation**: global `:focus-visible` outline (accent, 2 px);
  Home/Levels/Practice grids get roving-tabindex arrow-key navigation via a
  shared `src/lib/keynav.ts` helper; Esc on non-game screens navigates Home.
- New i18n keys: `pause.title` ('Paused'/'Pause'), `menu.resume`,
  `menu.restart`, `menu.sound`.

## Difficulty Rebalance (steeper early curve)

Anchor levels move 1/10/20/30 → **1/8/18/30**:

| Param | L1 | L8 | L18 | L30 |
|---|---|---|---|---|
| Items | 1-2 | 2-3 | 3-5 | 4-6 |
| Price style | half | tens | any | any |
| Payment | exact-or-round | round | awkward | awkward |
| Patience (s) | 35 | 28 | 20 | 15 |
| Menu visible | always | 5 s | 3 s | hidden |
| Scarce denoms | 0 | 1 | 2 | 3 |
| Mid-order change | 0 | 0.1 | 0.25 | 0.35 |
| Pile total shown | yes | yes | no | no |
| Orders/level | 6 | 8 | 10 | 12 |
| underpayProb | 0 | 0.08 | 0.15 | 0.2 |
| disputeProb | 0 | 0 | 0.12 | 0.2 |
| tabProb | 0 | 0 | 0.18 | 0.25 |
| splitProb | 0 | 0 | 0.12 | 0.2 |

Mechanic entry levels drop: underpay 12 → **8**, tabs 15 → **10**, disputes
18 → **12**, splits 22 → **15** (probability exactly 0 strictly below the
entry level, as before). The 30-level arc and rush's 30 s/level curve are
unchanged in shape; rush now bites within the first minute. Existing star
progress is kept (same level count, no migration). Practice presets rebase
their mid-difficulty base from L15 to **L14** with the same per-skill
overrides.

## Tipp (hint) System

A **Tipp** button is available in every mode, in sum and change phases:

- Sum phase: each press reveals the next order line's subtotal
  ("2× Bier = 8,00 €"); presses beyond the line count repeat the last hint.
- Change phase: reveals the change amount as a number (never the coin
  breakdown). If the till cannot make exact change, the hint instead points
  at asking ("The till can't make this — ask for a coin." / DE equivalent).
- Disputes: no hint (memory test stays pure).
- Cost: −25 points per press (session score floors at its pre-round value),
  and the round loses first-try-bonus eligibility (`usedHint` flag feeds the
  scoring input as `firstTry = false`). Error stats are unaffected.
- Core: `hintFor(round, hintIndex, locale)` pure and tested (returns the
  hint string parts; the UI renders them under the prompt).
- i18n: `game.tipp` ('Tipp'/'Tipp'), hint templates EN/DE.

## Praise Messages

The success flash draws from a streak-scaled praise pool instead of the fixed
"Correct!": streak 0-2 → tier 1 ("Nice!" / "Passt!"), 3-5 → tier 2 ("Great
pace!" / "Läuft bei dir!"), 6+ → tier 3 ("On fire! 🔥" / "Nicht zu stoppen!
🔥"); three variants per tier per language (`praise.<tier>.<n>` keys), picked
with `Math.random` — NEVER the session rng (outcome-dependent consumption
would desynchronize daily-challenge seeds; praise is cosmetic). Specific
messages (trap called, ask bonus, dispute verdicts, change-was/wrong
feedback) keep priority over praise.

## Logo

New SVG logo: a beer glass with foam beside two stacked coins, accent-gold on
the wood-dark rounded square. Used on the Home screen (large, above a
"Orders, Please" wordmark in the menu-card serif) and as the source for
regenerated favicon + PWA icons (icon.svg, pwa-192/512/maskable-512 PNGs).
One asset family everywhere.

## UX Modernization Pass

- **Home** becomes card-based: logo + wordmark on top; a large primary Play
  card that continues at the highest unlocked level; Rush / Daily / Practice
  as tiled cards with icon + one-line subtitle; Stats / My menu / Settings as
  a compact bottom row.
- **Design tokens**: spacing scale (4/8/12/16/24 px), one shadow token,
  button hierarchy (primary accent, secondary wood-light, ghost), pressed
  state (scale 0.97), safe-area insets (`env(safe-area-inset-*)`).
- **Game screen**: phase transitions cross-fade; sticky bottom action bar so
  Confirm/Ask/Not-enough/Tipp stay thumb-reachable; payment pieces rendered
  with the Money component instead of text chips.
- **Result overlays**: stars animate in sequentially; the score counts up.
- All new motion respects the existing `prefers-reduced-motion` kill switch.

## Testing

- Core TDD: `parseEntry`, `localizedDefaultMenu`, rush fast-spawn cap, new
  difficulty anchors + entry gates (boundary tests at 7/8, 9/10, 11/12,
  14/15), `hintFor` (sum lines, change amount, shortage variant), praise-tier
  selection.
- UI: svelte-check 0 errors / 0 warnings and clean build as gates; keyboard
  map, pause freezing, and focus navigation verified manually.

## Out of Scope

Touch gestures, visual themes, new game mechanics, deploy/store work,
additional languages.
