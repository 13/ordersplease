import { describe, it, expect } from 'vitest';
import { MAX_LEVEL } from '../../src/core/difficulty';
import en from '../../src/i18n/en';
import de from '../../src/i18n/de';

describe('level names', () => {
  it(`all ${MAX_LEVEL} names exist in both dictionaries`, () => {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      expect(en[`level.name.${l}`], `en ${l}`).toBeTruthy();
      expect(de[`level.name.${l}`], `de ${l}`).toBeTruthy();
    }
  });
  it('spot checks match the spec', () => {
    expect(en['level.name.1']).toBe('First Shift');
    expect(de['level.name.7']).toBe('Stammtisch');
    expect(en['level.name.10']).toBe("Kitchen's Open");
    expect(de['level.name.30']).toBe('Barlegende');
  });
});
