/** Focus the first enabled interactive control inside a container.
 *  Falls back to focusing the container itself so keyboard focus never
 *  drops to <body> when a region has no focusable children. */
export function focusFirst(container: HTMLElement | null): void {
  if (!container) return;
  const el = container.querySelector<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled)',
  );
  if (el) {
    el.focus();
    return;
  }
  container.tabIndex = -1;
  container.focus();
}
