import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { seen, markSeen } from '../../src/stores/seen';

describe('seen store', () => {
  it('marks once and reports repeats', () => {
    seen.set([]);
    expect(markSeen('trap')).toBe(true);
    expect(get(seen)).toContain('trap');
    expect(markSeen('trap')).toBe(false);
  });

  it('marks different ids independently', () => {
    seen.set([]);
    expect(markSeen('trap')).toBe(true);
    expect(markSeen('shortage')).toBe(true);
    expect(get(seen)).toContain('trap');
    expect(get(seen)).toContain('shortage');
  });
});
