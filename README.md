# Orders, Please

Bar mental-math trainer. Sum drink orders, take payment, give correct change
from a finite till — before the customer walks out.

- **Levels**: 30 levels ramping from single drinks with round prices to
  six-item orders, hidden menus, coin shortages and mid-order changes.
- **Rush**: endless Friday night. Three walkouts end the shift.
- **Practice**: nine skill drills (sums, parsing, change, shortages, speed,
  payment traps, disputes, tabs, split bills) — the stats screen points you
  at your weakest one.
- **Daily challenge**: the same seeded 10-order gauntlet for everyone each
  day, with a copyable share line and its own streak.
- **My menu**: enter your real bar's drinks and prices, train for your job.
- **Bar reality**: customers underpay, dispute what they handed you, order
  in waves on a tab, and split the bill.
- **Stats**: error breakdown per skill (sums, change, shortages, parsing, speed).
- **Plays great with a keyboard**: type sums directly (`5` → 5,00 €, comma for
  cents), number keys grab coins from the till, Enter confirms, A asks,
  N challenges a short payment, T buys a hint, Space pauses, Esc opens the
  game menu.
- **Tipp system**: stuck? A hint costs 25 points and the round's first-try
  bonus — it shows structure (a line's subtotal, the change amount), never
  the full answer.

## Tech

Svelte 5 + Vite + TypeScript PWA. No backend; progress lives in localStorage.
Install from the browser on Android (or any phone) via "Add to Home Screen".

## Develop

    npm install
    npm run dev       # dev server
    npm test          # core logic test suite (Vitest)
    npm run build     # production build in dist/
    npm run preview   # serve the build (needed for service-worker testing)

Game rules live framework-free in `src/core/` — see
`docs/superpowers/specs/2026-08-25-orders-please-design.md` for the design.
