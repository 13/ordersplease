export const DENOMS = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10] as const;
export const NOTE_DENOMS = [5000, 2000, 1000, 500] as const;
export const COIN_DENOMS = [200, 100, 50, 20, 10] as const;
export type Denom = number;
export type Till = Record<number, number>;

const FULL_NOTE_COUNT = 5;
const FULL_COIN_COUNT = 10;

export function fullTill(): Till {
  const t: Till = {};
  for (const d of NOTE_DENOMS) t[d] = FULL_NOTE_COUNT;
  for (const d of COIN_DENOMS) t[d] = FULL_COIN_COUNT;
  return t;
}

/** Full till with `lowDenomCount` random coin denominations at 0 or 1 pieces. */
export function scarceTill(rng: () => number, lowDenomCount: number): Till {
  const t = fullTill();
  const coins = [...COIN_DENOMS];
  for (let i = 0; i < Math.min(lowDenomCount, coins.length); i++) {
    const idx = Math.floor(rng() * coins.length);
    const d = coins.splice(idx, 1)[0];
    t[d] = Math.floor(rng() * 2); // 0 or 1
  }
  return t;
}

export function tillTotal(till: Till): number {
  return Object.entries(till).reduce((sum, [d, n]) => sum + Number(d) * n, 0);
}

export function hasPieces(till: Till, pieces: Denom[]): boolean {
  const need: Till = {};
  for (const p of pieces) need[p] = (need[p] ?? 0) + 1;
  return Object.entries(need).every(([d, n]) => (till[Number(d)] ?? 0) >= n);
}

export function removeFromTill(till: Till, pieces: Denom[]): Till {
  if (!hasPieces(till, pieces)) throw new Error('insufficient');
  const t = { ...till };
  for (const p of pieces) t[p] -= 1;
  return t;
}

export function addToTill(till: Till, pieces: Denom[]): Till {
  const t = { ...till };
  for (const p of pieces) t[p] = (t[p] ?? 0) + 1;
  return t;
}
