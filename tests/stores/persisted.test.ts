import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

import { persisted } from '../../src/stores/persisted';

describe('persisted', () => {
  beforeEach(() => mem.clear());
  it('starts with initial and writes envelope on set', () => {
    const s = persisted('k', { a: 1 });
    expect(get(s)).toEqual({ a: 1 });
    s.set({ a: 2 });
    expect(JSON.parse(mem.get('k')!)).toEqual({ v: 1, data: { a: 2 } });
  });
  it('restores stored value', () => {
    mem.set('k2', JSON.stringify({ v: 1, data: { a: 9 } }));
    expect(get(persisted('k2', { a: 1 }))).toEqual({ a: 9 });
  });
  it('ignores corrupt json', () => {
    mem.set('k3', '{nope');
    expect(get(persisted('k3', 5))).toBe(5);
  });
});
