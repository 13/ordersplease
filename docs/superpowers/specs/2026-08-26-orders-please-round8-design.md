# Orders, Please — Round 8 Design Spec

Date: 2026-08-26
Status: approved design, pre-implementation
Builds on: round 7 (shipped, v1.5.0)

## Purpose

Piecewise change entry as the new default (with the classic whole-amount
method as a setting), a truly-top success flash, short error messages,
quick settings inside the pause menu, numpad-key menu navigation, the
"Start" button renamed, the polish backlog, audio/feel upgrades (volume,
haptics), levels 31-40, a weekly challenge, and app-quality hardening
(update toast, storage guard).

## 1. Change Entry Modes

- `settings.amountEntry: boolean` (default **false**). False = new
  **pieces mode**; true = the round-7 **amount mode** (classic).
- **Pieces mode** (default): in the change phase the typed entry names ONE
  denomination. Enter with a non-empty entry:
  - `parseEntry` cents value ∈ DENOMS AND `tillView[d] > 0` → append `d`
    to the pile (same pile as till clicks — the two mix freely), clear
    the entry;
  - value not a denomination, or till exhausted → buzz + short error
    message (§4), clear the entry, no try burned.
  - Enter with an EMPTY entry → confirm (`submitChange(pile)`) — the
    "double Enter gives change" flow: `2` ⏎ `0,5` ⏎ ⏎.
  - Typing does NOT clear the pile (pieces add); clicking does NOT clear
    the entry (it's just another piece source). Escape clears the entry
    first (unchanged ordering).
- **Amount mode** (classic): exactly the round-7 behavior (whole amount,
  auto-compose, shortage steer to ask, wrong amount burns a try).
- The entry chip shows the current entry in both modes; its hint text
  differs: pieces `game.typed-hint-piece` ('Enter adds this piece' /
  'Enter legt dieses Stück'), amount keeps `game.typed-hint`.
- Settings checkbox: `settings.amount-entry` — EN 'Type the whole change
  amount (classic)' / DE 'Ganzen Betrag tippen (klassisch)'.

## 2. Flash Position (final)

`.flash` moves to `inset: 7% 0 auto 0` (just under the header) and
`font-size: 1.15rem` — visible at the top without covering the order text.
Badge toast stays bottom.

## 3. Pause-Menu Quick Settings

The pause menu (menu mode) gains a compact settings block under the
action buttons, directly bound to the settings store (no navigation away,
session preserved):

- Sound toggle (existing button moves into this block),
- Volume slider (§6) shown when sound is on,
- Checkbox 'Preise immer zeigen' (`settings.show-prices` label reused),
- Checkbox 'Ganzen Betrag tippen (klassisch)' (`settings.amount-entry`),
- Haptics toggle (§6).

Section heading `pause.settings` ('Settings' / 'Einstellungen'). The main
Settings route gets the same new controls (volume, haptics, amount entry).

## 4. Short Error Messages

Wrong attempts currently only buzz. New transient toast (`errorFlash`,
~1.1s, danger-colored, positioned just below the success-flash slot,
DOM-order stacking, no z-index):

- wrong sum try (round continues): `err.sum` 'Sum is wrong — try again' /
  'Summe stimmt nicht — nochmal';
- wrong change try (round continues): `err.change` 'Change is wrong' /
  'Rückgeld stimmt nicht';
- pieces mode, invalid denomination or exhausted till: `err.denom`
  'No coin or note with that value' / 'Kein passendes Stück';
- ask row opened by amount mode's shortage steer keeps its existing flow.

Round FAILURES keep today's full feedback (flash with the correct value)
— the new toasts cover the retry cases that were silent.

## 5. Menu Navigation + Naming

- `keynav` gains numpad-style digit navigation: `4`→left, `6`→right,
  `8`→up, `2`→down (alongside arrows and h/j/k/l). Digits never collide:
  keynav containers hold only buttons (input targets already guarded).
- `result.home` renamed: EN 'Main menu' / DE 'Hauptmenü' (end overlay +
  pause menu).

## 6. Audio & Feel

- `settings.volume: number` (0-1, default 1). Settings + pause slider
  (`<input type="range" min="0" max="1" step="0.1">`). All sound.ts
  generators multiply their gain by the volume. Sound toggle unchanged
  (off = silent regardless of volume).
- `settings.haptics: boolean` (default true). `navigator.vibrate?.()`:
  success 20ms, failure/walkout 60ms; no-ops where unsupported. Toggle in
  Settings + pause (`settings.haptics-label`: 'Vibration' both languages).
- Reduced-motion audit in final verification (existing celebrations
  already gate; confirm nothing new animates ungated).

## 7. Levels 31-40

- `MAX_LEVEL` 40. New anchor L40: items 6-8, priceStyle any, payment
  awkward, patience 10s, menu hidden, scarce 5, midOrderChange 0.45,
  showPileTotal false, orders 14, underpay 0.3, dispute 0.3, tab 0.35,
  split 0.3, happyHour 0.6, rowdy 0.2. L30 anchor unchanged; lerp 30→40.
- Level names 31-40 (EN/DE): 31 Overtime/Überstunden, 32 Double
  Booking/Doppelt gebucht, 33 Power Cut/Stromausfall, 34 Festival
  Eve/Festival-Vorabend, 35 The Rush/Der Ansturm, 36 No Breaks/Ohne
  Pause, 37 Champions' Night/Nacht der Champions, 38 Chaos
  Shift/Chaos-Schicht, 39 Final Boss/Endgegner, 40 Owner's
  Chair/Chefsessel.
- Unlock/stars/best logic unchanged (winning 30 unlocks 31, …). The
  `level-30` badge stays the top badge (BADGE_IDS frozen).

## 8. Weekly Challenge

- `src/core/weekly.ts`: `weekKey(date)` (ISO week, e.g. '2026-W35'),
  `weeklySeed(date)` (hash of the key), `WEEKLY_ORDERS = 20`,
  `weeklyLevelFor(roundsDone)` ramp 5 → 30 across the 20 orders
  (`min(30, 5 + floor(roundsDone * 25 / 19))`).
- `SessionMode` gains `'weekly'`: created like daily (seeded, default
  menu, `paramsForLevel(weeklyLevelFor(0))` override with
  `ordersPerLevel: WEEKLY_ORDERS`, per-round ramp in `completeRound`
  mirroring daily's). Deterministic: same rng rules.
- Store `op.weekly`: `{ week: string; score: number; best: number }` —
  one record per week (first finish sets score; better later runs update
  it), `best` = all-time weekly best.
- Home: the tiles grid becomes 2×2 with a fourth tile 🗓 Weekly
  (`home.weekly` 'Weekly' / 'Wochen-Challenge', sub 'One seed, seven
  days' / 'Ein Seed, sieben Tage'), ✓ when this week played. Route
  `weekly`.
- End overlay: score + share (shareText variant `weeklyShareText` with
  the week key). Tips/badges: weekly earns tips like daily; badges — no
  new ids; `first-win` counts weekly wins like daily (mode union grows).
- Descoped: typed-change practice drill (skill exercised everywhere).

## 9. App Quality

- **Update toast**: vite-plugin-pwa switches to `registerType: 'prompt'`;
  `main.ts` uses `registerSW({ onNeedRefresh })` to set a store flag; App
  renders a fixed bottom toast 'Update available — reload' /
  'Update verfügbar — neu laden' with a button calling
  `updateSW(true)`. Dismissable (✕, stays until next load).
- **Storage guard**: `persisted()` wraps `localStorage.setItem` in
  try/catch (quota/security errors ignored — the app keeps running in
  memory; verify current implementation, add if missing).
- **Lighthouse pass**: final-verification checklist item (meta, contrast
  spot checks); no dedicated task.

## 10. Polish Backlog (ledger carry-overs)

- **EndOverlay short-viewport clip**: `.overlay` gets
  `justify-content: safe center` (with the widely-supported
  `margin: auto 0` on the inner content wrapper as fallback) so the top
  edge is reachable when content exceeds the viewport.
- **Stats chart accuracy line**: a `<polyline>` connects the accuracy
  dots (only spanning consecutive non-empty days; gaps break the line).
- **Tutorial ask nudge**: in step 3, pressing Give change before asking
  shows `tutorial.need-ask` ('The till can't make this change — press Ask
  first.' / 'Die Kasse kann das nicht passend — drück zuerst Fragen.')
  instead of the generic wrong-change correction.
- **GameHeader extraction**: `src/lib/GameHeader.svelte` presentational
  component (lives, heartPulse, title, flame streak, tip jar, score,
  menu button via `onmenu` callback) replacing Game.svelte's inline
  header markup.

## Testing

- Core TDD: L40 anchor + lerp values + gate integrity (30→40), level
  names 31-40 completeness both languages, `weekKey`/`weeklySeed`
  determinism + ISO-week boundaries (year wrap), `weeklyLevelFor` ramp
  ends at 30, weekly record update rules, pieces-mode denomination
  validation (inline `DENOMS.includes(cents)` check — no new core code).
- UI gates: svelte-check 0/0, suite green, both builds clean; manual:
  pieces flow `2 ⏎ 0,5 ⏎ ⏎`, classic toggle switches behavior live,
  error toasts on wrong tries, pause quick settings bind live, volume
  audibly scales, 4/6/8/2 navigate, weekly plays and records, update
  toast on a new deploy, L31-40 reachable.

## Out of Scope

Practice drill for typed change, new badges, leaderboards, languages,
Game.svelte full rewrite (GameHeader extraction in §10 is the round's
only slimming step).
