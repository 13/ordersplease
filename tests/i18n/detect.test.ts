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
