import { get } from 'svelte/store';
import { persisted } from './persisted';

export const seen = persisted<string[]>('op.seen', []);

/** Returns true exactly once per id (and records it). */
export function markSeen(id: string): boolean {
  if (get(seen).includes(id)) return false;
  seen.update((s) => [...s, id]);
  return true;
}
