# Automatic Language Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent `'auto'` locale mode that resolves the UI language from the browser on every load, selectable and overridable in Settings, without changing anything for existing players.

**Architecture:** A pure `src/i18n/detect.ts` turns a list of BCP-47 tags into one of the two supported locales. A derived store `locale` in `src/i18n/index.ts` becomes the single place the rendered language is read from, and every one of the seventeen sites that read `settings.locale` raw migrates to it while it is still a pass-through. Only then does `settings.locale` widen to `'auto' | 'en' | 'de'` and default to `'auto'`, with the store resolving `'auto'` against the browser — a change that by then touches two files.

**Tech Stack:** Svelte 5 (runes), TypeScript, Svelte stores (`writable`/`derived`), Vitest (two projects: `node` and `jsdom`), `@testing-library/svelte`.

## Global Constraints

- Supported locales are exactly `['en', 'de']`. Do not add a third language or any region variant.
- Every failure path resolves to `'en'`. Detection must never throw — the app must always render text.
- `globalThis.addEventListener` is **undefined** in the `node` vitest environment. Any module-level listener MUST be called optionally (`globalThis.addEventListener?.(...)`) or every node test importing that module crashes. This is verified, not hypothetical.
- Node's `navigator.languages` is a read-only prototype getter (`['en-US']` here) and cannot be reassigned per-test. Tests inject tags through `pickLocale(tags)` or set the `browserLang` store — never by stubbing `navigator`.
- `src/stores/settings.ts` reads `localStorage` at module load. Tests that need a specific saved state must `vi.stubGlobal('localStorage', ...)` at file top, then `vi.resetModules()` + `await import(...)` inside the test. Verified working.
- Import direction must stay acyclic: `detect.ts` imports nothing → `settings.ts` imports `detect` → `i18n/index.ts` imports `settings` + `detect` → everything else imports `i18n`.
- Existing dictionaries have 262 keys each and must stay equal in count.
- Language names in the UI (`English`, `Deutsch`) are endonyms and are deliberately **not** translated.
- Run tests with `npx vitest run`, typecheck with `npm run check`. Both must pass before **every** commit — there are no exceptions, and the task order below is arranged specifically so that no commit is ever left red.

---

### Task 1: Detection core

**Files:**
- Create: `src/i18n/detect.ts`
- Test: `tests/i18n/detect.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `SUPPORTED: readonly ['en','de']`, `type Locale = 'en'|'de'`, `type LocalePref = Locale|'auto'`, `FALLBACK: Locale`, `LANG_NAMES: Record<Locale,string>`, `isLocale(v: unknown): v is Locale`, `pickLocale(tags: readonly string[]): Locale`, `detectLocale(): Locale`. Tasks 2, 3 and 5 all depend on these exact names.

- [ ] **Step 1: Write the failing test**

Create `tests/i18n/detect.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pickLocale, detectLocale, SUPPORTED, LANG_NAMES } from '../../src/i18n/detect';

describe('pickLocale', () => {
  it('matches an exact supported tag', () => {
    expect(pickLocale(['de'])).toBe('de');
    expect(pickLocale(['en'])).toBe('en');
  });

  it('matches on the primary subtag, case-insensitively', () => {
    expect(pickLocale(['de-AT'])).toBe('de');
    expect(pickLocale(['DE-ch'])).toBe('de');
    expect(pickLocale(['en-GB'])).toBe('en');
  });

  it('honours preference order', () => {
    expect(pickLocale(['fr', 'de', 'en'])).toBe('de');
    expect(pickLocale(['en-GB', 'de'])).toBe('en');
  });

  it('falls back to en when nothing is supported', () => {
    expect(pickLocale(['fr', 'it'])).toBe('en');
  });

  it('falls back to en on empty or malformed input', () => {
    expect(pickLocale([])).toBe('en');
    expect(pickLocale(['', '-', '   '])).toBe('en');
  });

  it('skips malformed entries but still finds a later match', () => {
    expect(pickLocale(['', 'de'])).toBe('de');
  });
});

describe('detectLocale', () => {
  it('returns a supported locale for the ambient navigator', () => {
    expect(SUPPORTED).toContain(detectLocale());
  });
});

describe('LANG_NAMES', () => {
  it('has an endonym for every supported locale', () => {
    expect(LANG_NAMES).toEqual({ en: 'English', de: 'Deutsch' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/i18n/detect.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/i18n/detect"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/i18n/detect.ts`:

```ts
export const SUPPORTED = ['en', 'de'] as const;
export type Locale = (typeof SUPPORTED)[number];
export type LocalePref = Locale | 'auto';
export const FALLBACK: Locale = 'en';

/** Endonyms — shown as-is in Settings, never translated. */
export const LANG_NAMES: Record<Locale, string> = { en: 'English', de: 'Deutsch' };

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (SUPPORTED as readonly string[]).includes(v);
}

/** First supported language among `tags`, matched on the primary subtag. */
export function pickLocale(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const primary = String(tag ?? '').trim().toLowerCase().split('-')[0];
    if (isLocale(primary)) return primary;
  }
  return FALLBACK;
}

/** pickLocale over navigator.languages, with navigator.language as backup. */
export function detectLocale(): Locale {
  const nav = globalThis.navigator as { languages?: readonly string[]; language?: string } | undefined;
  const tags = nav?.languages?.length ? nav.languages : nav?.language ? [nav.language] : [];
  return pickLocale(tags);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/i18n/detect.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Typecheck**

Run: `npm run check`
Expected: exit 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/detect.ts tests/i18n/detect.test.ts
git commit -m "feat(i18n): add browser language detection core"
```

---

### Task 2: Introduce the locale store and migrate every consumer

**Files:**
- Modify: `src/i18n/index.ts` (whole file — it is 9 lines today)
- Modify: `src/App.svelte:44`
- Modify: `src/stores/menu.ts:16`, `:31`, `:33`
- Modify: `src/routes/Game.svelte:90`, `:192`, `:198`, `:214`, `:216`, `:219`, `:231`, `:277`, `:291`, `:462`
- Modify: `src/routes/Tutorial.svelte:21`, `:44`
- Modify: `src/routes/MenuEditor.svelte:112`, `:191`
- Modify: `src/routes/Stats.svelte:78`
- Modify: `src/routes/Settings.svelte:17`
- Test: `tests/i18n/locale.test.ts`

**Interfaces:**
- Consumes: `Locale` from Task 1; the existing `settings` store.
- Produces: `locale: Readable<Locale>` exported from `src/i18n`, and `t` unchanged in signature. Task 3 changes how `locale` resolves; Task 4 imports it.

**This task changes no behaviour.** It is a pure refactor: `locale` is a
pass-through of `settings.locale`, and every raw consumer starts reading it
instead. Doing this before the type widens is what keeps every commit green —
after this task, adding `'auto'` touches exactly one file.

The current `src/i18n/index.ts` is:

```ts
import { derived } from 'svelte/store';
import { settings } from '../stores/settings';
import en from './en';
import de from './de';

const dicts = { en, de };

export const t = derived(settings, ($s) => (key: string): string =>
  dicts[$s.locale][key] ?? key,
);
```

- [ ] **Step 1: Write the failing test**

Create `tests/i18n/locale.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';

const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

async function load(saved?: Record<string, unknown>) {
  mem.clear();
  if (saved) mem.set('op.settings', JSON.stringify({ v: 1, data: saved }));
  vi.resetModules();
  const i18n = await import('../../src/i18n');
  const { settings } = await import('../../src/stores/settings');
  return { ...i18n, settings };
}

describe('locale store', () => {
  it('exposes the saved locale', async () => {
    const { locale } = await load({ locale: 'de' });
    expect(get(locale)).toBe('de');
  });

  it('drives t', async () => {
    const { t } = await load({ locale: 'de' });
    expect(get(t)('home.play')).toBe('Spielen');
  });

  it('follows a change to the setting', async () => {
    const { locale, t, settings } = await load({ locale: 'en' });
    expect(get(t)('home.play')).toBe('Play');
    settings.update((s) => ({ ...s, locale: 'de' }));
    expect(get(locale)).toBe('de');
    expect(get(t)('home.play')).toBe('Spielen');
  });

  it('keeps t returning the key for an unknown key', async () => {
    const { t } = await load({ locale: 'en' });
    expect(get(t)('no.such.key')).toBe('no.such.key');
  });
});

describe('dictionary parity', () => {
  it('en and de define the same keys', async () => {
    const en = (await import('../../src/i18n/en')).default;
    const de = (await import('../../src/i18n/de')).default;
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/i18n/locale.test.ts`
Expected: FAIL — `locale` is not exported from `../../src/i18n`, so `get(locale)` throws `TypeError: Cannot read properties of undefined`.

- [ ] **Step 3: Add the locale store**

Replace the entire contents of `src/i18n/index.ts` with:

```ts
import { derived } from 'svelte/store';
import { settings } from '../stores/settings';
import { type Locale } from './detect';
import en from './en';
import de from './de';

const dicts: Record<Locale, Record<string, string>> = { en, de };

/** The concrete locale to render in. Task 3 teaches this to resolve 'auto'. */
export const locale = derived(settings, ($s): Locale => $s.locale);

export const t = derived(locale, ($l) => (key: string): string =>
  dicts[$l][key] ?? key,
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/i18n/locale.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Migrate `src/App.svelte`**

Change the i18n import (line 20 currently reads `import { t } from './i18n';`):

```ts
  import { t, locale } from './i18n';
```

Change the effect at line 44 from `document.documentElement.lang = $settings.locale;` to:

```ts
    document.documentElement.lang = $locale;
```

- [ ] **Step 6: Migrate `src/stores/menu.ts`**

Add the import after the `settings` import on line 6:

```ts
import { locale } from '../i18n';
```

Change line 16 from `const name = get(settings).locale === 'de' ? 'Meine Karte' : 'My Menu';` to:

```ts
  const name = get(locale) === 'de' ? 'Meine Karte' : 'My Menu';
```

Change the `activeMenu` derived (lines 29-35) to take `locale` for the language while keeping `settings` for `useCustomMenu`:

```ts
export const activeMenu = derived(
  [settings, locale, menuProfiles, activeProfileId],
  ([$s, $l, $profiles, $id]) => {
    if (!$s.useCustomMenu) return localizedDefaultMenu($l);
    const p = $profiles.find((pr) => pr.id === $id) ?? $profiles[0];
    return p && p.items.length > 0 ? p.items : localizedDefaultMenu($l);
  },
);
```

- [ ] **Step 7: Migrate `src/routes/Game.svelte`**

Change the i18n import:

```ts
  import { t, locale } from '../i18n';
```

Replace every `$settings.locale` with `$locale` (lines 192, 198, 214, 216, 219, 231, 277, 291, 462), and the `get(settings).locale` at line 90:

```ts
      isDaily ? localizedDefaultMenu(get(locale)) : get(activeMenu),
```

Verify none remain — run: `grep -n 'settings\.locale' src/routes/Game.svelte`
Expected: no output.

- [ ] **Step 8: Migrate `src/routes/Tutorial.svelte`**

Add `locale` to the i18n import, then line 21:

```ts
  const menu = $derived(localizedDefaultMenu($locale));
```

and line 44:

```ts
    return renderOrder(round.order, $locale);
```

- [ ] **Step 9: Migrate `src/routes/MenuEditor.svelte`**

Add `locale` to the i18n import, then line 112:

```ts
      { id, name: presetName(preset, $locale), items: presetItems(preset, $locale) },
```

and line 191:

```svelte
        <button onclick={() => loadPreset(preset.id)}>{presetName(preset, $locale)}</button>
```

- [ ] **Step 10: Migrate `src/routes/Stats.svelte`**

Add `locale` to the i18n import, then line 78:

```ts
    new Date(viewYear, viewMonth, 1).toLocaleDateString($locale === 'de' ? 'de-DE' : 'en-US', {
```

Leave line 100's `localeCompare` alone — it is string comparison, unrelated.

- [ ] **Step 11: Migrate `src/routes/Settings.svelte`**

Change the i18n import:

```ts
  import { t, locale } from '../i18n';
```

Change line 17:

```ts
    const name = $locale === 'de' ? 'Meine Karte' : 'My Menu';
```

Leave line 31's `bind:value={$settings.locale}` as-is — the `<select>` writes the pref, which is correct.

- [ ] **Step 12: Verify every consumer is migrated**

Run: `grep -rn 'settings\.locale' src/`
Expected: exactly one line — `src/routes/Settings.svelte:31` (the `bind:value`), which is correct: the `<select>` writes the pref. Anything else is a missed site. (`src/stores/settings.ts` does not match this grep — it declares the field as `locale:`, not `settings.locale`.)

- [ ] **Step 13: Typecheck and run the full suite**

Run: `npm run check && npx vitest run`
Expected: check exits 0; all tests pass. Because this task changes no behaviour, every pre-existing test — notably `tests/core/text-order.test.ts` and `tests/core/menu.test.ts` — must pass untouched. A failure here means the refactor changed something it should not have.

- [ ] **Step 14: Commit**

```bash
git add src/i18n/index.ts src/App.svelte src/stores/menu.ts src/routes/Game.svelte src/routes/Tutorial.svelte src/routes/MenuEditor.svelte src/routes/Stats.svelte src/routes/Settings.svelte tests/i18n/locale.test.ts
git commit -m "refactor(i18n): route every locale consumer through one store"
```

---

### Task 3: Widen the setting and resolve auto

**Files:**
- Modify: `src/stores/settings.ts:4` (the `locale` field) and `src/stores/settings.ts:21` (the default)
- Modify: `src/i18n/index.ts` (the `locale` derived, plus `browserLang` and the listener)
- Test: `tests/i18n/auto-locale.test.ts`

**Interfaces:**
- Consumes: `LocalePref`, `Locale`, `FALLBACK`, `isLocale`, `detectLocale` from Task 1; the `locale` store from Task 2.
- Produces: `browserLang: Writable<Locale>` exported from `src/i18n`; `settings.locale` is now `LocalePref`. Task 4 imports `browserLang`.

This is the feature. Because Task 2 already routed every consumer through
`locale`, widening the setting touches only these two files and `npm run check`
stays green.

- [ ] **Step 1: Write the failing test**

Create `tests/i18n/auto-locale.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';

const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

async function load(saved?: Record<string, unknown>) {
  mem.clear();
  if (saved) mem.set('op.settings', JSON.stringify({ v: 1, data: saved }));
  vi.resetModules();
  const i18n = await import('../../src/i18n');
  const { settings } = await import('../../src/stores/settings');
  return { ...i18n, settings };
}

describe('the auto pref', () => {
  it('defaults to auto on a fresh install', async () => {
    const { settings } = await load();
    expect(get(settings).locale).toBe('auto');
  });

  it('follows the browser when the pref is auto', async () => {
    const { locale, browserLang, t } = await load({ locale: 'auto' });
    browserLang.set('de');
    expect(get(locale)).toBe('de');
    expect(get(t)('home.play')).toBe('Spielen');
  });

  it('ignores the browser when a locale is pinned', async () => {
    const { locale, browserLang, t } = await load({ locale: 'de' });
    browserLang.set('en');
    expect(get(locale)).toBe('de');
    expect(get(t)('home.play')).toBe('Spielen');
  });

  it('updates live when the browser language changes under auto', async () => {
    const { browserLang, t } = await load({ locale: 'auto' });
    browserLang.set('en');
    expect(get(t)('home.play')).toBe('Play');
    browserLang.set('de');
    expect(get(t)('home.play')).toBe('Spielen');
  });

  it('never exposes auto downstream', async () => {
    const { locale } = await load({ locale: 'auto' });
    expect(['en', 'de']).toContain(get(locale));
  });

  it('falls back to en for a corrupt saved locale', async () => {
    const { locale, t } = await load({ locale: 'fr' });
    expect(get(locale)).toBe('en');
    expect(get(t)('home.play')).toBe('Play');
  });
});

describe('existing saves', () => {
  // Regression guard: existing players must not be re-languaged.
  it('keeps a saved en', async () => {
    const { settings, locale } = await load({ locale: 'en' });
    expect(get(settings).locale).toBe('en');
    expect(get(locale)).toBe('en');
  });

  it('keeps a saved de', async () => {
    const { settings, locale } = await load({ locale: 'de' });
    expect(get(settings).locale).toBe('de');
    expect(get(locale)).toBe('de');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/i18n/auto-locale.test.ts`
Expected: FAIL — the first test reports `expected 'en' to be 'auto'`, and the `browserLang` tests throw `TypeError: Cannot read properties of undefined (reading 'set')`.

- [ ] **Step 3: Widen the setting**

In `src/stores/settings.ts`, add the import at the top of the file:

```ts
import type { LocalePref } from '../i18n/detect';
```

Change the interface field from `locale: 'en' | 'de';` to:

```ts
  locale: LocalePref;
```

Change the default object's first field from `locale: 'en',` to:

```ts
  locale: 'auto',
```

- [ ] **Step 4: Resolve auto in the store**

Replace the entire contents of `src/i18n/index.ts` with:

```ts
import { derived, writable } from 'svelte/store';
import { settings } from '../stores/settings';
import { detectLocale, isLocale, FALLBACK, type Locale } from './detect';
import en from './en';
import de from './de';

const dicts: Record<Locale, Record<string, string>> = { en, de };

/** The browser's preferred supported language. Set directly in tests. */
export const browserLang = writable<Locale>(detectLocale());

// Follow the OS/browser language while the pref is 'auto'. Optional call:
// `addEventListener` does not exist in the node test environment.
globalThis.addEventListener?.('languagechange', () => browserLang.set(detectLocale()));

/** The concrete locale to render in — never 'auto'. */
export const locale = derived([settings, browserLang], ([$s, $b]): Locale => {
  const want = $s.locale === 'auto' ? $b : $s.locale;
  return isLocale(want) ? want : FALLBACK;
});

export const t = derived(locale, ($l) => (key: string): string =>
  dicts[$l][key] ?? key,
);
```

- [ ] **Step 5: Run both locale suites**

Run: `npx vitest run tests/i18n/`
Expected: PASS — `detect.test.ts` (9), `locale.test.ts` (5, still green: it never mentions `'auto'`), `auto-locale.test.ts` (8).

- [ ] **Step 6: Typecheck and run the full suite**

Run: `npm run check && npx vitest run`
Expected: check exits 0; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/stores/settings.ts src/i18n/index.ts tests/i18n/auto-locale.test.ts
git commit -m "feat(i18n): add an auto locale mode that follows the browser"
```

---

### Task 4: Settings UI

**Files:**
- Modify: `src/routes/Settings.svelte:30-35` (the language `<label>`)
- Modify: `src/i18n/en.ts:158`, `src/i18n/de.ts:158`
- Test: `tests/components/settings-language.test.ts`

**Interfaces:**
- Consumes: `browserLang` from Task 3, `LANG_NAMES` from Task 1.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Create `tests/components/settings-language.test.ts` (this lands in the `jsdom` project):

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Settings from '../../src/routes/Settings.svelte';
import { settings } from '../../src/stores/settings';
import { browserLang, locale } from '../../src/i18n';

describe('Settings language select', () => {
  beforeEach(() => {
    settings.update((s) => ({ ...s, locale: 'auto' }));
    browserLang.set('en');
  });

  it('offers automatic, English and Deutsch', () => {
    const { getByLabelText } = render(Settings);
    const select = getByLabelText('Language') as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(['auto', 'en', 'de']);
  });

  // Pinned to English, but the browser is German: the label must report the
  // language auto *would* pick, in the currently rendered chrome language.
  it('labels the automatic option with what it would resolve to', () => {
    settings.update((s) => ({ ...s, locale: 'en' }));
    browserLang.set('de');
    const { getByLabelText } = render(Settings);
    const select = getByLabelText('Language') as HTMLSelectElement;
    expect(select.options[0].textContent?.trim()).toBe('Automatic (Deutsch)');
  });

  it('renders German chrome when auto resolves to de', () => {
    browserLang.set('de');
    const { getByLabelText } = render(Settings);
    expect(get(locale)).toBe('de');
    const select = getByLabelText('Sprache') as HTMLSelectElement;
    expect(select.options[0].textContent?.trim()).toBe('Automatisch (Deutsch)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/settings-language.test.ts`
Expected: FAIL on the first test — the select only has `['en','de']`.

Query by label, not by `getByRole('combobox')`: `Settings.svelte` has a second `<select>` (font size), so a bare combobox query is ambiguous and throws `getMultipleElementsFoundError`.

- [ ] **Step 3: Write minimal implementation**

Add the two dictionary keys. In `src/i18n/en.ts`, directly after line 158 (`'settings.language': 'Language',`):

```ts
  'settings.language-auto': 'Automatic',
```

In `src/i18n/de.ts`, directly after line 158 (`'settings.language': 'Sprache',`):

```ts
  'settings.language-auto': 'Automatisch',
```

In `src/routes/Settings.svelte`, add `browserLang` to the i18n import and `LANG_NAMES` from detect:

```ts
  import { t, locale, browserLang } from '../i18n';
  import { LANG_NAMES } from '../i18n/detect';
```

Replace the language `<label>` block (lines 30-35) with:

```svelte
  <label>
    {$t('settings.language')}
    <select bind:value={$settings.locale}>
      <option value="auto">{$t('settings.language-auto')} ({LANG_NAMES[$browserLang]})</option>
      <option value="en">English</option>
      <option value="de">Deutsch</option>
    </select>
  </label>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/settings-language.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Verify dictionary parity still holds**

Run: `npx vitest run tests/i18n/locale.test.ts`
Expected: PASS — the parity test from Task 2 confirms both dictionaries gained the key.

- [ ] **Step 6: Typecheck and full suite**

Run: `npm run check && npx vitest run`
Expected: check exits 0; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/routes/Settings.svelte src/i18n/en.ts src/i18n/de.ts tests/components/settings-language.test.ts
git commit -m "feat(settings): add an Automatic language option showing its resolution"
```

---

### Task 5: End-to-end verification

**Files:**
- No source changes expected. If this task finds a defect, fix it here and note it in the commit.

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: nothing.

- [ ] **Step 1: Full gate**

Run: `npm run check && npx vitest run && npm run build`
Expected: all three exit 0.

- [ ] **Step 2: Smoke the e2e suite**

Run: `npm run e2e`
Expected: PASS. The existing Playwright specs run against a browser whose language is `en-US`, so `'auto'` resolves to `en` and every pinned English assertion must still hold. A failure here means the default flip changed behaviour for the English path — investigate before proceeding.

- [ ] **Step 3: Confirm no raw pref reads leaked back in**

Run: `grep -rn 'settings\.locale' src/`
Expected: exactly one line — `src/routes/Settings.svelte` `bind:value`. (The interface field in `src/stores/settings.ts` reads `locale:` and does not match this grep.)

- [ ] **Step 4: Confirm the listener is guarded**

Run: `grep -n 'addEventListener' src/i18n/index.ts`
Expected: the line uses `addEventListener?.(` — optional call. Without it the whole `node` test project fails on import.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "test: verify automatic language detection end to end"
```

Skip this step if nothing changed.

---

## Verification Summary

The feature is done when:

- A fresh profile on a German browser opens the app in German; on any other browser, English.
- An existing save with `locale: 'en'` still opens in English. (`tests/i18n/auto-locale.test.ts`)
- Settings shows `Automatic (Deutsch)` / `Automatisch (Deutsch)` and switching to English or Deutsch pins it.
- Order text, menu names, presets, stats month names and `<html lang>` all follow the resolved locale, not the raw pref. (Task 2 Step 12)
- `npm run check`, `npx vitest run`, `npm run build` and `npm run e2e` all pass.
