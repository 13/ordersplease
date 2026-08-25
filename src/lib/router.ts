import { readable } from 'svelte/store';

function getHash(): string {
  return location.hash.replace(/^#\/?/, '') || 'home';
}

export const route = readable<string>(getHash(), (set) => {
  const on = () => set(getHash());
  window.addEventListener('hashchange', on);
  return () => window.removeEventListener('hashchange', on);
});

export function go(r: string): void {
  location.hash = '/' + r;
}
