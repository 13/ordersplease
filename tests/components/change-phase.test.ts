import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ChangePhase from '../../src/lib/ChangePhase.svelte';

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    paymentPieces: [],
    tillView: {},
    pile: [],
    showPileTotal: false,
    showKeys: false,
    finishMode: false,
    askOpen: false,
    ontake: vi.fn(),
    onreturn: vi.fn(),
    onconfirm: vi.fn(),
    ontoggleask: vi.fn(),
    onask: vi.fn(),
    onnotenough: vi.fn(),
    ontipp: vi.fn(),
    ...overrides,
  };
}

describe('ChangePhase', () => {
  it('fires onconfirm and ontoggleask from their buttons', async () => {
    const onconfirm = vi.fn();
    const ontoggleask = vi.fn();
    const { getByRole } = render(ChangePhase, baseProps({ onconfirm, ontoggleask }));

    await fireEvent.click(getByRole('button', { name: /Give change/ }));
    expect(onconfirm).toHaveBeenCalledOnce();

    await fireEvent.click(getByRole('button', { name: /Ask customer/ }));
    expect(ontoggleask).toHaveBeenCalledOnce();
  });

  it('renders 5 ask buttons when askOpen and fires onask(200) for the first', async () => {
    const onask = vi.fn();
    const { container } = render(ChangePhase, baseProps({ askOpen: true, onask }));

    const askButtons = container.querySelectorAll('.ask-row button');
    expect(askButtons).toHaveLength(5);

    await fireEvent.click(askButtons[0]);
    expect(onask).toHaveBeenCalledWith(200);
  });

  it('renders the typed-entry chip when typedDisplay is set', () => {
    const { getByText } = render(ChangePhase, baseProps({ typedDisplay: '2,00 €' }));
    expect(getByText(/2,00 €/)).toBeTruthy();
  });

  it('hides not-enough and tipp buttons when showExtras is false', () => {
    const { queryByText, getByRole } = render(ChangePhase, baseProps({ showExtras: false }));

    // sanity: ask + confirm remain
    expect(getByRole('button', { name: /Ask customer/ })).toBeTruthy();
    expect(queryByText("That's not enough!")).toBeNull();
    expect(queryByText(/Tipp/)).toBeNull();
  });
});
