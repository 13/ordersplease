# Home Menu Redesign — Design

Date: 2026-08-26
Scope: `src/routes/Home.svelte` (primary), light consistency touches allowed elsewhere. No route changes, no new destinations.

## Problem

The home screen exposes 10 destinations in three tiers, but the bottom tier crams
5 tiny buttons (Levels, Stats, My menu, Settings, Bar) into one row: hard to scan,
small tap targets. Hierarchy is flat — play actions, progress surfaces, and
configuration sit at the same visual weight. The overall look reads dated
(flat fills, no depth, appended-text status markers).

## Goals

- Clear hierarchy: play first, modes second, meta third, utilities out of the flow.
- Every tap target ≥ 44px; nothing crammed.
- Modernize the look while keeping the wood/amber/cream bar identity.
- Keep full keyboard navigation (`use:keynav`) and existing i18n keys.

## Non-goals

- No app-wide bottom tab bar; other screens keep back-button navigation.
- No new game features, routes, or i18n strings (aria-labels reuse existing keys).
- No restyle of in-game screens.

## Layout (approach A: corner utilities)

Top to bottom inside the existing 360px column:

1. **Corner utilities** — icon-only ghost buttons pinned to the top corners of
   the screen: Stats (📊, left), Settings (⚙, right). 44×44px minimum,
   `aria-label` from `home.stats` / `home.settings`. Subtle 1px border,
   cream icon color.
2. **Header** — logo at 72px (down from 96), `h1` title, career title rendered
   as a pill chip (accent border, small star glyphs).
3. **Hero Play card** — unchanged logic: suggests Tutorial for fresh level-1
   players, otherwise "Continue — Level {n}". Accent background, largest
   element on screen.
4. **Modes 2×2** — Rush, Daily, Practice, Weekly tiles, same destinations.
   Daily/Weekly done-state becomes a small accent ✓ badge in the tile corner
   instead of text-appended " ✓".
5. **Meta row (3 tiles)** — Level map (`levels.title`), My menu (`home.menu`),
   Bar (`bar.title`). Equal-width real tiles (not hairline buttons). The Bar
   tile shows the tip-wallet balance as a small badge when
   `career.walletCents > 0`.

Stats and Settings leave the flow entirely (corners), which is what shrinks the
old 5-button row to 3 proper tiles.

## Visual treatment (modern bar theme)

- **Surfaces**: wood-tone gradient fills (existing `--wood-light` family),
  soft drop shadow (`--shadow`), 14–16px radius, 1px inset top highlight for
  depth.
- **Career chip**: pill with accent border and accent text, replaces the plain
  paragraph.
- **Status badges**: small accent circle with ✓ on Daily/Weekly tiles;
  wallet amount badge on the Bar tile.
- **Motion**: press feedback `transform: scale(0.97)` with ~120ms transition on
  all buttons; wrapped in `@media (prefers-reduced-motion: no-preference)`.
- **Type scale**: h1 slightly larger; tile labels keep current sizes but gain
  consistent line-height.

All colors come from existing CSS custom properties; no new palette entries.

## Keyboard navigation & a11y

- `use:keynav` stays on `<main>`; `--keynav-cols` annotations updated per group
  (modes grid: 2, meta row: 3). Corner buttons participate in keynav order
  (first/last as the DOM order dictates — corners render first in DOM, so
  keynav reaches them before the hero; acceptable and predictable).
- Icon-only corner buttons carry `aria-label`; all other buttons keep visible
  text labels.
- Focus outlines follow the app default; no outline suppression.

## Testing

- **Playwright smoke** (`tests-e2e/`): update selectors that referenced the old
  minor-button row; add/extend a smoke test asserting all 10 destinations are
  reachable from home (tutorial/play, rush, daily, weekly, practice, levels,
  stats, my menu, bar, settings).
- **Vitest core suite**: untouched — no core logic changes.
- Manual check: light + dark mode, 320px-wide viewport, keyboard-only run.

## Risks

- Corner buttons overlapping safe areas on notched phones — use existing
  `env(safe-area-inset-*)` padding pattern.
- Keynav ordering with out-of-flow corners — verify arrow-key traversal still
  feels linear; adjust DOM order if not.
