/** Focus the first enabled interactive control inside a container. */
export function focusFirst(container: HTMLElement | null): void {
  if (!container) return;
  container
    .querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')
    ?.focus();
}
