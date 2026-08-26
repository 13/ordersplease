import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SumPhase from '../../src/lib/SumPhase.svelte';

describe('SumPhase', () => {
  it('shows the tab-wait prompt and no numpad while locked', () => {
    const { getByText, queryByRole } = render(SumPhase, {
      locked: true,
      symbolFirst: false,
      onsum: vi.fn(),
      ontipp: vi.fn(),
      bindApi: vi.fn(),
    });

    expect(getByText('Still ordering…')).toBeTruthy();
    expect(queryByRole('status')).toBeNull();
  });

  it('renders the numpad and fires ontipp when unlocked', async () => {
    const ontipp = vi.fn();
    const { getByText, getByRole } = render(SumPhase, {
      locked: false,
      symbolFirst: false,
      onsum: vi.fn(),
      ontipp,
      bindApi: vi.fn(),
    });

    expect(getByText('What does it cost?')).toBeTruthy();
    expect(getByRole('status')).toBeTruthy();

    await fireEvent.click(getByRole('button', { name: /Tipp/ }));
    expect(ontipp).toHaveBeenCalledOnce();
  });
});
