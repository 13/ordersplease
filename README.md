# Orders, Please

Bar mental-math trainer. Sum drink orders, take payment, give correct change
from a finite till — before the customer walks out.

- **Levels**: 30 levels ramping from single drinks with round prices to
  six-item orders, hidden menus, coin shortages and mid-order changes.
- **Rush**: endless Friday night. Three walkouts end the shift.
- **My menu**: enter your real bar's drinks and prices, train for your job.
- **Stats**: error breakdown per skill (sums, change, shortages, parsing, speed).

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
