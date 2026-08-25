import { readable } from 'svelte/store';

function getHash(): string {
  if (typeof location === 'undefined') return 'home';
  return location.hash.replace(/^#\/?/, '') || 'home';
}

export const route = readable<string>(getHash(), (set) => {
  if (typeof window === 'undefined') return;
  const on = () => set(getHash());
  window.addEventListener('hashchange', on);
  return () => window.removeEventListener('hashchange', on);
});

export function go(r: string): void {
  location.hash = '/' + r;
}
