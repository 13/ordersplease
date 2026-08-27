# Automatic Language Detection — Design

Date: 2026-08-27
Scope: `src/i18n/` (new `detect.ts`, changed `index.ts`), `src/stores/settings.ts`,
`src/stores/menu.ts`, both dictionaries, and the raw-locale consumers listed in
architecture §5 (`App.svelte`, `Game.svelte`, `Tutorial.svelte`, `Stats.svelte`,
`MenuEditor.svelte`, `Settings.svelte`). No route changes, no new supported
languages.

## Problem

`settings.locale` defaults to `'en'` (`src/stores/settings.ts:20`) and is only ever
changed by the `<select>` in Settings (`src/routes/Settings.svelte:31`). A German
player therefore lands on English and stays there until they find the language
toggle, even though the app has a complete German dictionary (262 keys, same as
English). The browser already tells us what language the user reads; we ignore it.

## Goals

- A fresh install shows German to a German browser, English to everyone else.
- Detection is visible and reversible in Settings, not hidden magic.
- Following the browser is a *persistent mode*, not a one-time guess: changing the
  OS/browser language updates the app.
- Existing players see no change whatsoever.

## Non-goals

- No new translations and no third language. `en` and `de` remain the only dictionaries.
- No `Accept-Language` negotiation — this is a static site on GitHub Pages, no server.
- No per-route or per-component locale override.
- No region variants: `de-AT` and `de-CH` both render the existing `de` dictionary.
  Austrian/Swiss wording is out of scope.

## Decisions

Two forks were settled before design:

1. **Persistent `'auto'` mode**, not a one-time seed of the default. A one-time seed
   is a smaller diff but is invisible and irreversible — you cannot tell a detected
   `de` from a chosen one, and a later browser-language change has no effect.
2. **Existing saves are left alone.** A stored `'en'` is indistinguishable from a
   deliberate choice of English, so migrating it to `'auto'` would silently
   re-language players who genuinely picked English on a German browser. Auto
   applies to fresh installs only; everyone else can opt in from Settings.

## Architecture

### 1. Detection core — new `src/i18n/detect.ts`

Pure module, no store imports, mirroring how `src/core/*` is written so it is
unit-testable in the `node` vitest project.

```ts
export const SUPPORTED = ['en', 'de'] as const;
export type Locale = (typeof SUPPORTED)[number];
export type LocalePref = Locale | 'auto';
export const FALLBACK: Locale = 'en';

/** First supported language among `tags`, matched on primary subtag. */
export function pickLocale(tags: readonly string[]): Locale;

/** pickLocale over navigator.languages, with navigator.language as backup. */
export function detectLocale(): Locale;
```

`pickLocale` rules, in order:

- Tags are walked front to back; the first one that resolves wins. `['fr','de','en']`
  gives `de`, because the user prefers German over English among what we support.
- A tag matches on its **primary subtag only**, lowercased: `de`, `de-AT`, `DE-ch`
  all match `de`. Anything after the first `-` is discarded.
- Malformed or empty entries are skipped, not thrown on.
- No match, or an empty list, returns `FALLBACK` (`'en'`).

`detectLocale` reads `globalThis.navigator?.languages`, falls back to
`[globalThis.navigator?.language]`, and finally to `[]` — so a missing or partial
`navigator` yields `'en'` rather than a crash.

### 2. Settings type and default — `src/stores/settings.ts`

`Settings.locale` widens from `'en' | 'de'` to `LocalePref`, and the default flips
from `'en'` to `'auto'`.

No migration marker is needed. `persisted()` merges as `{ ...initial, ...data }`
(`src/stores/persisted.ts:22`), so a saved `locale: 'en'` overrides the new default
and existing players keep English. Only a save with no `locale` key at all — i.e. a
fresh install — picks up `'auto'`. This is the mechanism that implements decision 2,
and it is what the regression test in the Testing section pins.

### 3. Resolved-locale store — `src/i18n/index.ts`

Nothing downstream should ever see the string `'auto'`. Two new exports:

```ts
export const browserLang = writable<Locale>(detectLocale());

export const locale = derived([settings, browserLang], ([$s, $b]): Locale => {
  const want = $s.locale === 'auto' ? $b : $s.locale;
  return (SUPPORTED as readonly string[]).includes(want) ? (want as Locale) : FALLBACK;
});

export const t = derived(locale, ($l) => (key: string): string => dicts[$l][key] ?? key);
```

`t` keeps its exact current signature, so none of its call sites change.

`browserLang` is a plain writable rather than a readable-with-start so tests can
`browserLang.set('de')` directly — necessary because Node's `navigator.languages`
is a read-only prototype getter and cannot be stubbed per-test.

A module-level listener keeps it live:

```ts
globalThis.addEventListener?.('languagechange', () => browserLang.set(detectLocale()));
```

This is what makes `'auto'` a mode rather than a boot-time guess: switching the
phone's language re-renders the app without a reload. The listener is never removed
— it is module-scoped and lives as long as the page, matching the app's other
module-level side effects.

### 4. UI and `<html lang>`

**Settings** (`src/routes/Settings.svelte`) gains a third option, listed first, that
shows what it currently resolves to so the setting is not a black box:

```svelte
<option value="auto">{$t('settings.language-auto')} ({LANG_NAMES[$browserLang]})</option>
```

Rendering as `Automatic (Deutsch)` on a German browser. `LANG_NAMES` is a small
endonym map (`{ en: 'English', de: 'Deutsch' }`) exported from `detect.ts` —
language names are deliberately *not* translated, matching the existing hardcoded
`English` / `Deutsch` options.

Two new keys in both dictionaries: `settings.language-auto` (`Automatic` /
`Automatisch`).

**`App.svelte`** already sets `document.documentElement.lang = $settings.locale`.
Left as-is that effect would write the invalid BCP-47 tag `lang="auto"`, so it must
switch to the resolved store:

```ts
$effect(() => { document.documentElement.lang = $locale; });
```

`index.html:2` keeps its static `lang="en"` as the pre-hydration value.

### 5. Migrating raw `locale` consumers

`t` is not the only consumer of the locale. Seventeen sites read
`$settings.locale` (or `get(settings).locale`) directly and pass it to functions
whose parameter is typed `'en' | 'de'`:

| File | Sites | Consumes |
| --- | --- | --- |
| `src/routes/Game.svelte` | 10 | `renderOrder`, `renderWave`, `renderPayer`, `renderAmendment`, `hintFor`, `localizedDefaultMenu` |
| `src/stores/menu.ts` | 3 | `localizedDefaultMenu`, profile naming |
| `src/routes/Tutorial.svelte` | 2 | `localizedDefaultMenu`, `renderOrder` |
| `src/routes/MenuEditor.svelte` | 2 | `presetName`, `presetItems` |
| `src/routes/Stats.svelte` | 1 | `toLocaleDateString` |
| `src/routes/Settings.svelte` | 1 | reset profile naming |
| `src/App.svelte` | 1 | `<html lang>` |

Widening `Settings.locale` to `LocalePref` therefore breaks `npm run check` at
every one of them, and — worse — left uncorrected at runtime a German player on
`'auto'` would read English order text while the UI chrome around it was German.

Every one of these sites migrates to the resolved `locale` store: `$settings.locale`
becomes `$locale`, and `get(settings).locale` becomes `get(locale)`. The
consuming core functions keep their narrow `'en' | 'de'` parameter type — that
narrowness is what makes the compiler enumerate the call sites for us, so it is
a feature, not an obstacle. After the migration `settings.locale` is read in
exactly two places: the `locale` store that resolves it, and the `<select>` that
writes it.

Import direction stays acyclic: `detect.ts` imports nothing, `settings.ts`
imports `detect`, `i18n/index.ts` imports `settings` + `detect`, and everything
else imports `i18n`.

## Data flow

```
navigator.languages ──detectLocale()──> browserLang ─┐
                                                     ├──> locale ──> t ──> components
settings.locale ('auto' | 'en' | 'de') ──────────────┘        └──> App.svelte → <html lang>
       ▲
       └── Settings <select>
```

## Error handling

Every failure path resolves to `'en'` rather than throwing — the app must always
render text:

- `navigator` absent or without `languages` → `detectLocale()` returns `'en'`.
- Unrecognised or malformed tags → skipped by `pickLocale`, falls through to `'en'`.
- A corrupt persisted `locale` (e.g. `'fr'` from a hand-edited localStorage) → the
  `dicts[$l]` lookup would be `undefined`. `locale` therefore validates its output
  against `SUPPORTED` and falls back to `'en'`, so `t` can never dereference a
  missing dictionary.

## Testing

New `tests/i18n/detect.test.ts` (node project):

- exact match `['de']` → `de`
- region suffix `['de-AT']`, `['DE-ch']` → `de`
- ordering: `['fr','de','en']` → `de`; `['en-GB','de']` → `en`
- unsupported only `['fr','it']` → `en`
- empty list, and entries like `''` / `'-'` → `en`

New `tests/i18n/locale.test.ts` (node project):

- `locale: 'auto'` + `browserLang.set('de')` → `t` returns German strings
- `locale: 'de'` explicitly + `browserLang.set('en')` → stays German (pin beats browser)
- `browserLang.set('de')` while on `'auto'` → `t` updates without remount (proves the
  mode is live)
- **Regression guard for decision 2:** a localStorage payload written as
  `{v:1,data:{locale:'en'}}` still resolves to `en` after the default changed to
  `'auto'`.

Dictionary parity (`Object.keys(en).length === Object.keys(de).length`) is worth
asserting once here since we are adding a key to both.

Existing suites must stay green untouched. `tests/core/text-order.test.ts` and
`tests/core/menu.test.ts` already cover the render functions the migrated sites
feed, so a green run after the migration is the evidence that swapping
`$settings.locale` for `$locale` changed no behaviour for pinned locales.

`npm run check` is a required gate for the migration task specifically: it is the
mechanism that proves all seventeen sites were found.

## Out of scope / follow-ups

- Region-specific German (`de-AT`, `de-CH`) wording.
- Any third language — the resolver is written to make adding one a one-line change
  to `SUPPORTED` plus a dictionary, but no such language is added here.
