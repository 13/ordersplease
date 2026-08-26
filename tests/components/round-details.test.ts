import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import RoundDetails from '../../src/lib/RoundDetails.svelte';
import type { RoundLogEntry } from '../../src/core/session';

describe('RoundDetails', () => {
  const log: RoundLogEntry[] = [
    { orderText: 'Order A', ms: 4000, success: true, errors: [], scoreGained: 100 },
    { orderText: 'Order B', ms: 6000, success: true, errors: ['change-wrong'], scoreGained: 50 },
    { orderText: 'Order C', ms: 5000, success: false, errors: ['sum-wrong'], scoreGained: 0 },
  ];

  it('summarizes the log with a success count, the good verdict, one star, and error text', () => {
    const { getByText, container } = render(RoundDetails, { log });

    expect(getByText('✓ 2/3')).toBeTruthy();
    // 2/3 ≈ 0.667, in the [0.6, 0.9) "good" band
    expect(getByText('Solid shift — keep the coins moving!')).toBeTruthy();

    expect(container.querySelectorAll('.star').length).toBe(1);

    expect(getByText('Sums')).toBeTruthy();
  });
});
