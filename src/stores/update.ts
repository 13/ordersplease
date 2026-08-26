import { writable } from 'svelte/store';

export const updateReady = writable(false);
export let doUpdate: () => void = () => {};
export function setUpdater(fn: () => void): void {
  doUpdate = fn;
}
