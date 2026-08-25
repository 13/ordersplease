import { describe, it, expect } from 'vitest';
import { improveBest } from '../../src/stores/progress';

describe('improveBest', () => {
  it('records a first best and keeps better ones', () => {
    let b = improveBest(undefined, 3, 1000, 60000);
    expect(b[3]).toEqual({ score: 1000, ms: 60000 });
    b = improveBest(b, 3, 1200, 70000);
    expect(b[3]).toEqual({ score: 1200, ms: 70000 }); // higher score wins despite slower
    b = improveBest(b, 3, 1200, 65000);
    expect(b[3].ms).toBe(65000); // tiebreak: faster
    b = improveBest(b, 3, 900, 10000);
    expect(b[3].score).toBe(1200); // worse discarded
  });
});
