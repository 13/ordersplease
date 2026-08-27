import { describe, it, expect } from 'vitest';
import { pickLocale, detectLocale, navigatorTags, SUPPORTED, LANG_NAMES } from '../../src/i18n/detect';

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

describe('navigatorTags', () => {
  it('prefers the languages list', () => {
    expect(navigatorTags({ languages: ['de', 'en'], language: 'fr' })).toEqual(['de', 'en']);
  });

  it('falls back to the single language when the list is absent', () => {
    expect(navigatorTags({ language: 'de-AT' })).toEqual(['de-AT']);
  });

  it('falls back to the single language when the list is empty', () => {
    expect(navigatorTags({ languages: [], language: 'de' })).toEqual(['de']);
  });

  it('yields nothing for a missing or empty navigator', () => {
    expect(navigatorTags(undefined)).toEqual([]);
    expect(navigatorTags({})).toEqual([]);
  });
});

describe('detectLocale with an injected navigator', () => {
  it('picks the first supported language from the list', () => {
    expect(detectLocale({ languages: ['fr', 'de', 'en'] })).toBe('de');
  });

  it('reads the single language when there is no list', () => {
    expect(detectLocale({ language: 'de-CH' })).toBe('de');
  });

  it('prefers the list over the single language', () => {
    expect(detectLocale({ languages: ['en'], language: 'de' })).toBe('en');
  });

  // Not `detectLocale(undefined)` — that fires the default parameter and reads
  // the ambient navigator, so it would pass on an English machine regardless.
  it('falls back to en for a navigator advertising nothing', () => {
    expect(detectLocale({})).toBe('en');
    expect(detectLocale({ languages: [] })).toBe('en');
  });

  it('falls back to en when nothing is supported', () => {
    expect(detectLocale({ languages: ['fr', 'it'] })).toBe('en');
  });
});
