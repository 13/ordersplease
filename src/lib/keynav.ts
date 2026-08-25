/** Pure grid-navigation math over a full button list (disabled included). */
export function nextIndex(
  enabled: boolean[], current: number, key: string, cols: number,
): number | null {
  const n = enabled.length;
  if (n === 0 || current < 0 || current >= n) return null;
  if (key === 'Home') {
    const i = enabled.indexOf(true);
    return i === -1 || i === current ? null : i;
  }
  if (key === 'End') {
    const i = enabled.lastIndexOf(true);
    return i === -1 || i === current ? null : i;
  }
  const step = key === 'ArrowRight' ? 1
    : key === 'ArrowLeft' ? -1
    : key === 'ArrowDown' ? cols
    : key === 'ArrowUp' ? -cols
    : 0;
  if (step === 0) return null;
  const dir = step > 0 ? 1 : -1;
  let i = current + step;
  while (i >= 0 && i < n && !enabled[i]) i += dir;
  if (i >= 0 && i < n) return i;
  // ran off the grid: clamp to the farthest enabled cell in that direction
  let clamp: number | null = null;
  for (let j = current + dir; j >= 0 && j < n; j += dir) {
    if (enabled[j]) clamp = j;
  }
  // clamp === current is unreachable (loop starts at current+dir) — kept as a guard
  return clamp === current ? null : clamp;
}

/** Arrow navigation action; geometry matches the rendered grid. */
export function keynav(node: HTMLElement) {
  function cols(): number {
    const el = (document.activeElement as HTMLElement | null) ?? node;
    const v = getComputedStyle(el).getPropertyValue('--keynav-cols').trim();
    return v ? Number(v) : 1;
  }
  function onKeydown(e: KeyboardEvent) {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const all = [...node.querySelectorAll<HTMLButtonElement>('button')];
    const current = all.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;
    const next = nextIndex(all.map((b) => !b.disabled), current, e.key, cols());
    if (next === null) return;
    e.preventDefault();
    all[next].focus();
  }
  node.addEventListener('keydown', onKeydown);
  return { destroy: () => node.removeEventListener('keydown', onKeydown) };
}
