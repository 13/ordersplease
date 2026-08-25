# Orders, Please — Round 4 Design Spec

Date: 2026-08-25
Status: approved design, pre-implementation
Builds on: round 3 (shipped, v1.1.0)

## Purpose

Fix the arrow-key navigation bug, remove 5-cent coins (10c price grid), expand
the menu (three drinks, three food items gated to harder levels), accelerate
the difficulty curve with a new endgame, give every level a name, and add
success celebrations (coin burst / coin shower). No new game mechanics.

## Bug Fix: Arrow-Key Navigation

Diagnosis: `keynav` builds its candidate list from `button:not(:disabled)`,
so grid geometry (`--keynav-cols` jumps) is computed against a list that does
not match the rendered grid. On the Levels map (most levels locked) ArrowDown
(+5) exits the short enabled list and does nothing; Home's mixed sections
mis-jump the same way.

Fix: navigate the FULL button list (disabled included) so the geometry matches
the screen:
- A step landing on a disabled button continues stepping in the same
  direction until an enabled button or the edge.
- A step running off the grid clamps to the nearest enabled button in that
  direction (never a silent no-op).
- Home/End jump to the first/last enabled button.

Implementation: pure `nextIndex(enabled: boolean[], current: number,
key: string, cols: number): number | null` helper exported from
`src/lib/keynav.ts` and unit-tested; the DOM action becomes a thin wrapper
that builds the `enabled` array from the full button list.

## 5-Cent Removal (10c price grid)

- `DENOMS` = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10] — nine
  denominations; `COIN_DENOMS` loses 5.
- Prices are multiples of 10 cents: `validateItem` rejects others;
  `applyPriceStyle`'s `'any'` step becomes 10; minimum price 10c.
- Saved custom menus migrate silently on load: each `priceCents` rounds to
  the nearest 10 (minimum 10) in the store restore path. One-time,
  idempotent.
- Keyboard till map becomes keys 1-9 (1 = 50 € … 9 = 10c); key badges
  update; key 0 does nothing in the change phase.
- `generateUnderPayment`'s single-piece fallback bottoms out at 10c (the
  10c-total case yields the empty obviously-short payment, mirroring the old
  5c rule).
- All DENOMS-anchored tests re-derive (till, change DP, order payments,
  round traps).

## Menu Expansion

`MenuItem` gains `category: 'drink' | 'food'`. Existing items are drinks;
persisted custom menus default missing categories to `'drink'` on load.

Default menu (12 items, prices on the 10c grid):

| id | EN | DE | Price | Category |
|---|---|---|---|---|
| beer | Beer | Bier | 4,00 | drink |
| veneziano | Veneziano | Veneziano | 5,00 | drink |
| water | Water | Wasser | 2,50 | drink |
| cola | Cola | Cola | 3,00 | drink |
| wine | Wine | Wein | 4,50 | drink |
| coffee | Coffee | Kaffee | 2,00 | drink |
| hugo | Hugo | Hugo | 4,50 | drink |
| hefe | Wheat Beer | Hefe | 4,20 | drink |
| schnaps | Schnapps | Schnaps | 3,00 | drink |
| wurst | Sausage | Wurst | 3,50 | food |
| haehnchen | Roast Chicken | Hähnchen | 8,50 | food |
| schnitzel | Schnitzel | Schnitzel | 10,50 | food |

Food gating: pure helper `menuForLevel(menu: MenuItem[], level: number)` —
food included only when `level >= 10`. Sessions generate orders from
`menuForLevel(sessionMenu, currentLevel)`:
- Levels: fixed level. Rush: virtual level (food appears once the ramp
  crosses 10). Daily: the per-order ramp crosses 10 mid-run, so later orders
  may include food.
- Practice: `sums` and `parsing` drills include food (bigger totals are the
  drill); all other drills are drinks-only.
- Custom food items obey the same gating.

Menu card: when the visible menu contains food, a section divider renders
between drinks and food (`menu.food-header`: 'Food' / 'Essen'). Menu editor
gains a per-item drink/food toggle.

## Faster Difficulty + Endgame

Five anchors at levels 1/6/14/22/30; L22 carries today's endgame values and
L30 becomes a genuine endgame:

| Param | L1 | L6 | L14 | L22 | L30 |
|---|---|---|---|---|---|
| Items | 1-2 | 2-3 | 3-5 | 4-6 | 5-7 |
| Price style | half | tens | any | any | any |
| Payment | exact-or-round | round | awkward | awkward | awkward |
| Patience (s) | 35 | 28 | 20 | 15 | 12 |
| Menu visible | always | 5 s | 3 s | hidden | hidden |
| Scarce denoms | 0 | 1 | 2 | 3 | 4 |
| Mid-order change | 0 | 0.1 | 0.25 | 0.35 | 0.4 |
| Pile total shown | yes | yes | no | no | no |
| Orders/level | 6 | 8 | 10 | 12 | 12 |
| underpayProb | 0 | 0.08 | 0.15 | 0.2 | 0.25 |
| disputeProb | 0 | 0 | 0.12 | 0.2 | 0.25 |
| tabProb | 0 | 0 | 0.18 | 0.25 | 0.3 |
| splitProb | 0 | 0 | 0.12 | 0.2 | 0.25 |

Entry gates: underpay **6**, tab **8**, dispute **9**, split **11** (exact 0
strictly below, as before). Practice base rebases to `paramsForLevel(12)`.
Rush inherits (former maximum reached ~minute 11, still climbing to L30
values at ~minute 15). Text-order quantity words already cover qty 7.

## Level Names

i18n keys `level.name.1` … `level.name.30`, both languages, shown on the
levels map (under the number), in the Game header ("7 · Stammtisch"), and on
the win overlay.

| # | EN | DE |
|---|---|---|
| 1 | First Shift | Erste Schicht |
| 2 | Warm-Up | Aufwärmen |
| 3 | After Work | Feierabend |
| 4 | Regulars | Stammgäste |
| 5 | Happy Hour | Happy Hour |
| 6 | Double Shift | Doppelschicht |
| 7 | Regulars' Table | Stammtisch |
| 8 | Karaoke Night | Karaoke-Nacht |
| 9 | Quiz Night | Quiz-Abend |
| 10 | Kitchen's Open | Küche offen |
| 11 | Stag Night | Junggesellenabschied |
| 12 | Ladies' Night | Damenwahl |
| 13 | Friday the 13th | Freitag der 13. |
| 14 | Fest Warm-Up | Wiesn-Warmup |
| 15 | Halftime | Halbzeit |
| 16 | Concert Night | Konzertabend |
| 17 | Match Day | Spieltag |
| 18 | Full Moon | Vollmond |
| 19 | Bowling Club | Kegelclub |
| 20 | Oktoberfest | Oktoberfest |
| 21 | Night Owls | Nachtschwärmer |
| 22 | Double Round | Doppelrunde |
| 23 | New Year's Eve | Silvester |
| 24 | Stocktaking | Inventur |
| 25 | Boss Is Away | Chef ist weg |
| 26 | Marathon | Marathon |
| 27 | State of Emergency | Ausnahmezustand |
| 28 | All at Once | Alles auf einmal |
| 29 | Last Call | Letzte Runde |
| 30 | Bar Legend | Barlegende |

## Celebrations

- **Coin burst (perfect round)** — trigger: success AND first try AND no
  hints AND patience > 50%. 8-12 coin particles burst from the action-bar
  area: absolutely-positioned spans with coin styling, per-particle CSS
  custom properties (`--dx`, `--dy`, `--rot`) randomized with `Math.random`
  (cosmetic — NEVER `session.rng`), one shared keyframe, self-cleanup after
  900 ms. The praise flash renders scaled-up for these rounds.
  Implementation: `CoinBurst.svelte` retriggered via a `burstKey` counter.
- **Coin shower (big wins)** — trigger: 3-star level win, new rush
  highscore, or perfect daily. EndOverlay rains ~20 coin particles from the
  top for 1.5 s behind the content. New `fanfare()` in `sound.ts` (two-tone
  cha-ching variant) plays instead of the plain success sound.
- **Reduced motion**: both effects spawn no particles; flash and sounds
  unaffected.

## Testing

- Core TDD: `nextIndex` (disabled-skip, directional clamp, cols math,
  Home/End), 9-denomination re-anchoring across till/change/order/round
  tests, custom-menu 10c migration (round + minimum + idempotent),
  `MenuItem.category` default on legacy stored menus, `menuForLevel`
  boundaries (level 9 vs 10; practice drill selection), new anchors + gates
  (5/6, 7/8, 8/9, 10/11), level-name completeness (all 30 keys in both
  dictionaries).
- UI: svelte-check 0/0 and clean build as gates; celebrations verified
  manually.

## Out of Scope

Leaderboards, additional languages, deploy/store work, audio assets
(synthesis only), new game mechanics.
