import { describe, it, expect } from 'vitest';
import { encodeResult, decodeResult } from '../../src/core/compare';

describe('compare codec', () => {
  it('round-trips', () => {
    const r = { week: '2026-W35', score: 4230 };
    expect(decodeResult(encodeResult(r))).toEqual(r);
    expect(decodeResult(encodeResult({ week: '2025-W01', score: 0 })))
      .toEqual({ week: '2025-W01', score: 0 });
    expect(decodeResult(encodeResult({ week: '2027-W53', score: 999999 })))
      .toEqual({ week: '2027-W53', score: 999999 });
  });
  it('rejects tampering and garbage without throwing', () => {
    const code = encodeResult({ week: '2026-W35', score: 4230 });
    expect(decodeResult(code.replace(/.$/, (c) => (c === '0' ? '1' : '0')))).toBeNull();
    expect(decodeResult('')).toBeNull();
    expect(decodeResult('hello world')).toBeNull();
    expect(decodeResult('OP--')).toBeNull();
    for (let i = 0; i < 200; i++) {
      const junk = Math.random().toString(36).slice(2);
      expect(() => decodeResult(junk)).not.toThrow();
    }
  });
});

describe('week range hardening', () => {
  it('rejects weeks outside ISO 01-53 at encode time', () => {
    expect(encodeResult({ week: '2026-W54', score: 10 })).toBe('');
    expect(encodeResult({ week: '2026-W99', score: 10 })).toBe('');
    expect(encodeResult({ week: '2026-W00', score: 10 })).toBe('');
  });
});
