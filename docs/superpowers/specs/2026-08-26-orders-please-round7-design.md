# Orders, Please — Round 7 Design Spec

Date: 2026-08-26
Status: approved design, pre-implementation
Builds on: round 6 (shipped, v1.4.0)

## Purpose

Make giving change typeable (the mental math IS the number — type it), move
the success flash where the eye is, make round details always visible and
motivating, fix the Einstellungen overflow, give the game screen a clickable
menu control, add vim-style menu navigation, and absorb the round-6 deferred
polish items.

## 1. Typed Change (keyboard amount entry)

- In the change phase, digit/comma/Backspace keys build an **amount entry**
  using the same parse semantics as the sum Numpad (`parseEntry`): `5` →
  5,00 €, `50` → 50,00 €, `0,5` → 0,50 €. A display chip appears above the
  action bar while the entry is non-empty: `⌨ 4,50 €` (new ChangePhase prop
  `typed: string` rendered via `parseEntry`+`formatEuro`; hidden when '').
- **Enter** with a non-empty entry submits the typed amount:
  - `pieces = makeChange(round.till, amount)` (existing DP composer).
  - Composable → `pile = pieces; confirmChange()` — core validates as
    usual (a wrong amount burns a change try exactly like a wrong pile).
  - Not composable and `amount === changeDue` → the player computed
    correctly but the till cannot pay: buzz, open the ask row, clear the
    entry, flash nothing (no try burned).
  - Not composable and wrong → `pile = []; confirmChange()` (burns a try,
    normal wrong-change feedback).
- Enter with an empty entry keeps today's behavior (confirm the clicked
  pile / Finish).
- Typing the first digit **clears any clicked pile** (the two input modes
  are mutually exclusive per attempt); clicking a till piece clears the
  typed entry. Backspace edits; Escape still closes ask row / pauses (an
  open entry is cleared by Escape BEFORE the ask-row/pause handling).
- Digit keys 1-9 therefore no longer quick-take denominations; the till
  key-cap badges are obsolete in the change phase — TillGrid gets
  `showKeys={false}` from Game (Money's key-cap infrastructure stays).
  The 0 key becomes usable (amounts like 50).
- Touch play unchanged (till taps remain the input); the tutorial keeps
  its click-based flow (its route has no key handler).
- i18n: `game.typed-hint` shown under the chip ('Enter gives this change' /
  'Enter gibt dieses Wechselgeld'); reuse existing shortage flow strings.

## 2. Success Flash Position

`.flash` moves from bottom 30% to the upper third (`inset: 16% 0 auto 0`)
so "Passt!" appears where the player is looking (order/menu area). The
badge toast stays at the bottom. Animation unchanged.

## 3. Always-Visible, Motivating Round Details

- `RoundDetails` loses its toggle: the list always renders on the end
  overlay (still max-height + scroll).
- Eyecandy/motivation upgrade:
  - Summary header row above the list: `✓ X/Y · 🔥 best streak n · Ø t s`
    (served count, session-best streak from the log, average round time).
  - Rows: colored ✓/✗ marks (as today), score in accent (`+240`), failed
    rows keep the error text; perfect rounds (firstTry not knowable from
    the log — use success + no errors) get a subtle ⭐ after the mark.
  - A one-line motivational verdict under the header picked by accuracy:
    ≥90% `result.verdict.great`, ≥60% `result.verdict.good`, else
    `result.verdict.train` (EN+DE), in accent color.
- RoundLogEntry needs no change (all derivable from the log).

## 4. Einstellungen Overflow Fix

Home's `.row .minor` buttons overflow with long German labels
("Einstellungen"). Fix: the row becomes a 4-column grid with
`min-width: 0`, `overflow-wrap: anywhere`, `hyphens: auto`,
`font-size: 0.8rem`, tighter horizontal padding. Verify DE labels fit at
360px width.

## 5. Game Menu Button (back/return everywhere)

- Audit result: every route already has a ← back button; the pause menu
  already has Resume ("return") and Home ("back"). The gap: the Game
  screen itself has no clickable/tappable way to open that menu (Esc/Space
  are keyboard-only — mobile players cannot pause or leave).
- Fix: the Game header gains a `☰` button (aria-label `game.menu`,
  EN 'Menu' / DE 'Menü') on the far right that calls
  `setPaused(true, true)`. Nothing else changes — the pause menu provides
  Resume/Restart/Sound/Home.

## 6. Vim Navigation

`keynav` additionally maps `h`/`j`/`k`/`l` → ArrowLeft/Down/Up/Right
(translation inside the action; the pure `nextIndex` is unchanged). Applies
everywhere `use:keynav` is active (Home, Levels, Practice, pause menu).
Key events originating from INPUT/SELECT/TEXTAREA targets are ignored
(guard added — MenuEditor-style forms must keep typing letters).

## 7. Round-6 Deferred Polish (absorbed)

- `focusFirst` fallback: when a container has no focusable child, focus
  the container itself (`tabindex="-1"` set programmatically) so keyboard
  focus never drops to `<body>` (round-5/6 carry-over).
- `docs/twa.md`: fix the init-step wording (`bubblewrap init --manifest
  <web manifest URL>`; the checked-in `twa-manifest.json` is the file
  Bubblewrap maintains — copy it into the init directory rather than
  passing it to `--manifest`).
- Tutorial coach texts say "Confirm"/"Bestätigen" but the button reads
  'Give change'/'Wechselgeld geben' — coach strings updated to name the
  real labels (steps s2.change, s3.after-ask).

Not absorbed (still deferred): Game.svelte slimming; Stats chart dots→line.

## Testing

- Core: no new core logic (makeChange reused). Lib TDD: `nextIndex`
  untouched; add tests only if the vim translation lands in the pure layer
  (it does not).
- UI gates: svelte-check 0/0, suite green, both builds clean. Manual:
  type 4,50 → correct change auto-composed; type 5 → 5,00 €; type 0,5 →
  0,50 €; wrong typed amount burns a try; shortage round typed-correct
  opens ask row; h/j/k/l walk the Levels grid; "Einstellungen" fits;
  ☰ opens the pause menu by mouse; details always visible on the end
  overlay with summary + verdict; flash appears top.

## Out of Scope

Game.svelte refactor, chart restyle, on-screen numpad in the change phase
(till taps remain the touch input), leaderboards, languages.
