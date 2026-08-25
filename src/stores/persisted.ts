import { writable, type Writable } from 'svelte/store';

export function persisted<T>(key: string, initial: T): Writable<T> {
  let start = initial;
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw) {
      const env = JSON.parse(raw);
      if (env && env.v === 1) start = env.data as T;
    }
  } catch { /* corrupt storage → fall back to initial */ }
  const store = writable<T>(start);
  store.subscribe((data) => {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify({ v: 1, data }));
    } catch { /* storage full/blocked → play on without persistence */ }
  });
  return store;
}
