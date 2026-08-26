import { writable, type Writable } from 'svelte/store';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function persisted<T>(key: string, initial: T): Writable<T> {
  let start = initial;
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw) {
      const env = JSON.parse(raw);
      if (env && env.v === 1) {
        const data = env.data as T;
        // plain-object payloads gain fields over time — fill new defaults
        // from `initial` so legacy saves never carry undefined settings
        start = isPlainObject(initial) && isPlainObject(data)
          ? ({ ...initial, ...data } as T)
          : data;
      }
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
