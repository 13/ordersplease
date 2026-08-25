/** Roving-tabindex arrow navigation over a container's buttons. */
export function keynav(node: HTMLElement) {
  function buttons(): HTMLButtonElement[] {
    return [...node.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  }
  function cols(): number {
    const v = getComputedStyle(node).getPropertyValue('--keynav-cols').trim();
    return v ? Number(v) : 1;
  }
  function onKeydown(e: KeyboardEvent) {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const list = buttons();
    const current = list.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;
    const c = cols();
    let next = current;
    if (e.key === 'ArrowRight') next = current + 1;
    else if (e.key === 'ArrowLeft') next = current - 1;
    else if (e.key === 'ArrowDown') next = current + c;
    else if (e.key === 'ArrowUp') next = current - c;
    else if (e.key === 'Home') next = 0;
    else next = list.length - 1;
    if (next < 0 || next >= list.length) return;
    e.preventDefault();
    list[next].focus();
  }
  node.addEventListener('keydown', onKeydown);
  return { destroy: () => node.removeEventListener('keydown', onKeydown) };
}
