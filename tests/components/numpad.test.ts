import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Numpad from '../../src/lib/Numpad.svelte';

describe('Numpad', () => {
  it('builds a display value from taps and submits parsed cents', async () => {
    const onsubmit = vi.fn();
    const { getByText, getByRole } = render(Numpad, { onsubmit });

    await fireEvent.click(getByText('4'));
    await fireEvent.click(getByText('5'));
    await fireEvent.click(getByText(','));
    await fireEvent.click(getByText('5'));

    expect(getByRole('status').textContent).toBe('45,50 €');

    await fireEvent.click(getByRole('button', { name: 'OK' }));
    expect(onsubmit).toHaveBeenCalledWith(4550);
  });

  it('clears the display via C', async () => {
    const onsubmit = vi.fn();
    const { getByText, getByRole } = render(Numpad, { onsubmit });

    await fireEvent.click(getByText('4'));
    await fireEvent.click(getByText('5'));
    expect(getByRole('status').textContent).toBe('45,00 €');

    await fireEvent.click(getByText('C'));
    expect(getByRole('status').textContent).toBe('0,00 €');
  });
});
