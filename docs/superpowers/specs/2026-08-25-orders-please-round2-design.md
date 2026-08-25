# Orders, Please — Round 2 Design Spec

Date: 2026-08-25
Status: approved design, pre-implementation
Builds on: `2026-08-25-orders-please-design.md` (v1, shipped)

## Purpose

Deepen the training value of v1 with four new bar mechanics (payment traps,
disputes, running tabs, split bills), two new modes (skill practice, seeded
daily challenge), and a feel/retention pass (synthesized sound, CSS animation,
per-round breakdowns) — plus the polish items deferred from v1's final review.
Deploy/TWA (store distribution) is explicitly out of scope this round.

## New Core Mechanics

### Payment traps (underpay)
- The payment generator may produce pieces summing to LESS than the total
  (`underpayProb` from the difficulty table).
- The change phase gains a permanent **"Not enough"** button, styled and
  placed like the existing "Ask customer" button — always visible, so its
  presence never reveals whether a trap is active.
- Correct call (payment actually short): customer apologizes and tops up —
  the payment is corrected to a valid covering amount, the round continues
  in the change phase, and a flat bonus (+50, like the ask bonus) is earned.
- Wrong call (payment was fine): burns a change try (same rule as an
  invalid ask).
- Confirming a change pile while the payment is short fails the round with
  new error `trap-missed`.

### Disputes (payment memory)
- After a successful change confirmation, with probability `disputeProb`,
  the customer claims to have paid with a different note:
  "I gave you 20 €!" when they actually handed a 10 € note (the claimed
  note is one step above the largest note actually given; when the largest
  given is already 50 €, no plausible higher claim exists and the dispute
  simply does not trigger for that round).
- The player answers from memory via two buttons: the actual note vs the
  claimed note (order randomized). The payment pieces are no longer on
  screen at this point.
- Correct: small bonus (+25). Wrong: score penalty (−50, floor 0 for the
  round) and error `dispute-wrong`. The round still counts as successful
  for lives/streak either way — disputes train memory, they don't kill
  rounds.

### Running tabs
- A tab customer's order arrives in 2–3 waves, a few seconds apart
  ("…and two more beers"). Waves are visible as appended order sentences.
- The sum numpad is locked until the final wave has arrived; the player
  holds the running total in their head across waves.
- Core: the order generator emits `waves: Order[]` plus the merged order;
  the round state machine is unchanged (it receives the merged order).
  Wave reveal timing lives in the UI (3–4 s between waves).
- A failed sum on a tab round records error `tab-wrong` (in place of
  `parse-wrong`).

### Split bills
- A group customer's full order is shown, then 2–3 payers pay sequentially:
  "I pay the Beers and the Water." Each payer covers a disjoint subset of
  the order lines; every line is covered exactly once.
- Per payer: sum that subset → payment → change, as linked mini-rounds
  sharing one customer patience bar. Lives are charged at most once per
  group (first failed payer fails the group round; remaining payers are
  skipped).
- A failed sum on a split payer records error `split-wrong`.

### Difficulty table additions

| Param | L1 | ~L10 | ~L20 | ~L30 |
|---|---|---|---|---|
| underpayProb | 0 | 0.05 (from L12) | 0.15 | 0.2 |
| disputeProb | 0 | 0 | 0.1 (from L18) | 0.2 |
| tabProb | 0 | 0 | 0.15 (from L15) | 0.25 |
| splitProb | 0 | 0 | 0.1 (from L22) | 0.2 |

Interpolation follows the existing anchor scheme; "from Lx" = zero below
that level. At most one special mechanic (tab OR split) per customer;
traps/disputes can combine with either. Rush inherits via the existing
virtual-level curve.

### Error taxonomy
Grows from 5 to 9: `sum-wrong`, `change-wrong`, `shortage-missed`,
`parse-wrong`, `timeout`, `trap-missed`, `dispute-wrong`, `tab-wrong`,
`split-wrong`. Stats storage, stats screen bars, weakest-skill hint, and
EN/DE dictionaries all extend accordingly (existing persisted stats objects
migrate by treating missing keys as 0).

## New Modes

### Practice (`#/practice`)
- Entry: Home button + a "[Train it]" link on the Stats weakest-skill hint.
- Picker screen: 9 skill tiles (sums, parsing, change, shortages, speed,
  traps, disputes, tabs, splits); the weakest skill (highest error count)
  is visually highlighted.
- A drill = 10 rounds with `practiceParams(skill)` — a pure function in
  `difficulty.ts` layering skill-specific overrides on a mid-difficulty
  base:
  - sums/parsing → 3–6 items, menu prices hidden after 3 s
  - change → awkward payments, pile total hidden
  - shortages → scarce till guaranteed (2–3 coin denoms at 0–1)
  - speed → patience 12 s, 1–2 item orders
  - traps/disputes/tabs/splits → that mechanic's probability forced to 1.0
- No lives, no walkout ending — all 10 rounds always play (patience still
  drains for scoring, an expired round counts as timeout and the next
  begins). Results screen: accuracy %, average seconds, per-round
  breakdown. Rounds feed normal stats.

### Daily challenge (`#/daily`)
- Seed = local date as `yyyymmdd` integer → `mulberry32`. Identical
  10-order gauntlet for every player on a given date: same orders,
  payments, till, and mechanic mix. Difficulty ramps across the 10 orders
  (virtual levels 5 → 25).
- One ranked attempt per local day. Replays are playable but marked
  "unranked" and never overwrite the ranked score.
- Persistence key `op.daily`: `{ date, score, perfect, attempts, streak }`
  (daily-challenge streak is independent of the play-day streak).
- Result overlay: score plus a clipboard share text, e.g.
  `Orders, Please 25.08. — 3.450 pts · 10/10 ✓ · 🔥4`. No URLs, no backend.
- Home gains a Daily button showing a "done today ✓" state.

## Feel & Retention

### Sound (`src/lib/sound.ts`, WebAudio synthesis only — no asset files)
- `coinClink()` — short metallic ping on till tap, pitch randomized ±10%
- `chaChing()` — two-tone register bell on round success
- `errorBuzz()` — low buzz on a wrong try
- `tickTock()` — soft tick while head patience < 25% (max once per second)
- All gated on `settings.sound`; the v1 `beep` is replaced by these.

### Animation (CSS only)
- Pile pieces pop in when tapped, shrink out when returned
- Flash messages slide up and fade
- Customer face reflects patience: 😀 above 50%, 😐 above 25%, 😠 below;
  walkout slides the customer off and briefly flashes the lost heart red
- Tab waves pulse the newly appended order line
- All animation disabled under `prefers-reduced-motion`.

### Per-round breakdown
- The session collects `roundLog: { orderText, ms, success, errors,
  scoreGained }[]` in core (tested).
- End overlays (level, rush, practice, daily) gain an expandable "Details"
  list: per round — time, ✓/✗, error labels via i18n, score. One shared
  component.

### Game-feel fixes (from v1 final review)
- `game.walkout` flash when a queued customer expires
- "New highscore!" only on a strictly new high (track `wasNewHigh` in
  finalize)
- Numpad OK disabled while input is empty

## Polish

- Day streak: `recordDay` fires on the first served order of the day, not
  only at session end.
- `#/game/<n>` above the unlocked level redirects to the levels map.
- Rush level badge displays "30+" once past MAX_LEVEL.
- Dead i18n keys (`game.change-prompt`, `menu.price`, `menu.save`,
  `menu.delete`) are used or deleted; all new mechanics/skills get EN+DE
  keys.
- `<html lang>` follows `settings.locale`.
- `EMPTY` stats constant exported from the stats store; Settings reset
  reuses it instead of duplicating the literal.

## Testing

- Core TDD as in v1: trap/dispute transitions in `round.ts`, wave
  generation + merged totals, split payer partitioning (disjoint, complete),
  `practiceParams` per skill, daily seed determinism (same date → identical
  10 orders), `roundLog` accumulation, new difficulty rows monotone and
  zero below their entry levels, stats migration for missing error keys.
- Svelte layer: `svelte-check` 0 errors + build gates as in v1; feel items
  verified by manual play.
- Suite target: ~110+ tests, all green before merge.

## Out of Scope (this round)

Deploy/TWA/store distribution (bucket D, deferred by user), accounts or
server leaderboards (share text only), additional languages, drink-making
minigame, inventory simulation.
