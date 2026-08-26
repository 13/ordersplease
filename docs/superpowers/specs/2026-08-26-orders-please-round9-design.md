# Orders, Please — Round 9 Design Spec

Date: 2026-08-26
Status: approved design, pre-implementation
Builds on: round 8 + patch series (shipped, v1.7.3)

## Purpose

Career meta-progression (tip wallet, bar upgrades, titles, 8 new badges),
themes and accessibility (light mode, font scale, color-blind-safe money,
left-hand layout), history surfaces (calendar, weekly archive, share-code
compare), and the test-infrastructure round (component tests, CI smoke,
ledger cleanup batch).

## 1. Career & Meta

### 1.1 Tip wallet + upgrades

- `op.career` persisted: `{ walletCents: number; upgrades: string[] }`
  (default `{ walletCents: 0, upgrades: [] }`).
- Every tip earned in play adds to BOTH `stats.tipsEarnedCents` (lifetime,
  untouched by spending) and `career.walletCents` (spendable).
- Upgrade catalog (`src/core/career.ts`, pure):

| id | Cost | Effect |
|---|---|---|
| `jar-xl` | 20 € | tips earned +10% (rounded up to 10c) |
| `coffee-machine` | 50 € | +1s patience per round |
| `cheat-sheet` | 30 € | first Tipp per session costs nothing |
| `accent-copper` | 10 € | cosmetic: copper accent color |
| `accent-forest` | 10 € | cosmetic: forest-green accent color |

- Gameplay effects (`jar-xl`, `coffee-machine`, `cheat-sheet`) apply in
  level/rush/practice ONLY — daily and weekly stay vanilla for ranked
  fairness. Cosmetics apply everywhere.
- Patience: `+1000ms` added to `patienceSeconds * 1000` at customer spawn
  (UI layer adjusts params, core untouched: Game passes a params override
  built via pure helper `applyUpgrades(params, upgrades, mode)`).
- New route `bar` ("Bar" screen): wallet balance, upgrade cards with cost,
  owned state, buy button (disabled when unaffordable); reachable from
  Home's minor row (5th button — row wraps to a 2nd line gracefully after
  the round-7 grid fix; verify).
- Reset-all in Settings also resets `op.career`.

### 1.2 Career titles

- Pure `careerTitle(totalStars, maxLevelWon): CareerTitle` in career.ts;
  thresholds: Aushilfe (start), Barkeeper (≥10 stars), Schichtleiter
  (≥30 stars AND level ≥ 15 won), Wirt (≥60 stars AND level ≥ 25), 
  Bar-Legende (≥90 stars AND level 40 won).
- Shown as subtitle on Home (under the h1) and on Stats; i18n
  `career.<id>` EN/DE (Barkeeper/Bartender etc. — DE: Aushilfe,
  Barkeeper, Schichtleiter, Wirt, Bar-Legende; EN: Trainee, Bartender,
  Shift Lead, Landlord, Bar Legend).

### 1.3 Badges 13-20

`BADGE_IDS` grows to 20: `weekly-first` (a weekly finished), `weekly-3`
(3 distinct weeks recorded — needs the weekly archive §3.2), `level-40`
(level-mode win at 40), `tips-10` (lifetime tips ≥ 10 €), `tips-100`
(≥ 100 €), `stars-10` (ten levels at 3 stars), `rounds-100` (lifetime
rounds ≥ 100), `career-wirt` (title Wirt or higher). BadgeContext gains
the needed fields (lifetime tips, lifetime rounds, distinct weekly weeks,
star count, career title rank). i18n badge.* EN/DE for all eight.

## 2. Themes & Accessibility

### 2.1 Dark/light theme

- `settings.theme: 'dark' | 'light'` (default 'dark' — current look).
- Implementation: the existing custom properties (--wood, --wood-light,
  --cream, --ink, --accent, --ok, --danger, --radius, shadows) get a
  light "Biergarten" palette under `:root[data-theme='light']` in
  app.css: warm daylight cream background, dark text, wood tones as
  accents; --accent stays amber, --ok/--danger darkened for contrast on
  light ground. Money chips/notes keep their own colors (they are
  physical objects) but their key-cap/badge colors must stay readable in
  both themes (audit).
- App.svelte `$effect` sets `document.documentElement.dataset.theme`;
  the PWA `theme_color` stays dark (manifest is build-time).
- Toggle in Settings + pause quick settings (`settings.theme-label`
  'Light mode' / 'Heller Modus' checkbox mapping light↔checked).
- Cosmetic accent upgrades (§1.1) override --accent via
  `data-accent="copper|forest"` on the root, set the same way; active
  accent chosen on the Bar screen (radio among owned cosmetics + default).

### 2.2 Font scale

- `settings.fontScale: 1 | 1.15 | 1.3` (default 1); App sets
  `document.documentElement.style.fontSize = ${16 * scale}px`. All layout
  is rem/em-based enough to scale (audit obvious px font sizes in
  overlays; fix stragglers to rem where they break).
- Settings control: three-way select (`settings.font-size` 'Font size' /
  'Schriftgröße'; options 'Normal', 'Groß', 'Sehr groß' / 'Normal',
  'Large', 'Extra large').

### 2.3 Color-blind-safe money + left-hand layout

- Money pieces: coins get a solid border, 5€/10€/20€/50€ notes get
  distinct border STYLES (solid/dashed/double/ridge equivalent via
  border-style + width) so value classes differ by more than hue;
  amount text stays the primary signal (already).
- `settings.leftHand: boolean` (default false): change-phase action bar
  and secondary row render `flex-direction: row-reverse`, Numpad's
  OK/C column mirrors (grid order swap). Label `settings.left-hand`
  'Left-handed layout' / 'Linkshänder-Modus'.

## 3. History Surfaces

### 3.1 Calendar

- Stats gains a month calendar (current month, ‹/› month nav, weeks as
  rows Mon-Sun): each day cell colored by activity from `op.history`
  (empty / played: intensity by rounds), daily-record days get a dot.
  Tap/click a played day → detail line under the calendar (rounds,
  accuracy, tips of that day). Pure date math in
  `src/core/calendar.ts` (`monthGrid(year, month): (string|null)[][]`
  ISO-Monday weeks, unit-tested incl. month edges).

### 3.2 Weekly archive

- `op.weekly-history` persisted: `Record<weekKey, number>` (best score
  per ISO week; written in finalize alongside the existing record).
- Shown as a list (most recent first, max 12) beside the calendar:
  week key + score; current week highlighted.

### 3.3 Share-code compare

- Pure codec in `src/core/compare.ts`:
  `encodeResult({week, score}): string` → `OP-<base36week>-<base36score>-<check>`
  (check = simple mod-97 checksum); `decodeResult(code)` →
  `{week, score} | null` (null on bad checksum/format, never throws).
- Weekly end overlay: share text (existing) plus the code; Stats weekly
  archive gains a "Compare" input: paste a code → line "You 4.230 ·
  Friend 3.980 — you win!" (or lose/tie), i18n'd, using YOUR score for
  the same week (message when you have none for that week).

## 4. Test Infrastructure

### 4.1 Component tests

- Add dev-deps: `@testing-library/svelte`, `jsdom` (+
  `@testing-library/jest-dom` optional — skip, keep lean). Vitest gains a
  jsdom environment for `tests/components/**` (workspace or environment
  match glob) while core tests stay in node env.
- Tests: Numpad (tap digits → display, OK submits cents, C clears),
  SumPhase (locked hides numpad; tipp button fires), ChangePhase
  (confirm/ask/not-enough callbacks, ask row renders options, typed
  display shows), RoundDetails (summary numbers from a crafted log,
  verdict thresholds).
- One Game integration test is EXPLICITLY OUT (too much harness); the
  pieces flow stays covered by manual pass + core tests.

### 4.2 CI smoke test

- Playwright dev-dep + `tests-e2e/smoke.spec.ts`: build + preview
  server, page loads, title correct, Home renders play button, navigate
  to tutorial route, coach text visible. CI: new `smoke` job after test
  (chromium only, `npx playwright install --with-deps chromium`).

### 4.3 Ledger cleanup batch

- Stats chart: dot guard aligns with line guard (`entry.rounds > 0`).
- Settings.svelte dead normalizer removed (persisted merge covers it).
- `errorFlash`/`errT` cleared in `finishRound` (no residual toast over
  the result flash).
- EndOverlay: `margin: auto` fallback wrapper for non-`safe` browsers.
- Game.svelte slimming: extract the toast/flash cluster
  (`flash`, `errorFlash`, `badgeToast` rendering) into
  `src/lib/GameToasts.svelte` (presentational; ≤850 target line count).

## Testing

Core TDD: career (applyUpgrades matrix incl. ranked-mode neutrality,
careerTitle thresholds, upgrade catalog integrity), badges 13-20 rules +
wall count 20, calendar monthGrid (Jan/Dec wrap, leap Feb, Monday start),
compare codec round-trip + checksum rejection + fuzz (random strings →
null). Component tests §4.1. Gates: suite green, check 0/0, both builds,
Playwright smoke green in CI.

## Out of Scope

Server/leaderboards, more languages, Play Console work, theme editor,
upgrade refunds, badge un-earning, Game.svelte full rewrite.
