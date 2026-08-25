import { COIN_DENOMS, DENOMS, type Denom, type Till } from './till';

/** Fewest-piece change for `amount` from available till counts.
 *  DP over cents (amounts are small: change rarely exceeds ~50€). */
export function makeChange(till: Till, amount: number): Denom[] | null {
  if (amount === 0) return [];
  if (amount < 0) return null;
  const INF = Number.POSITIVE_INFINITY;
  // best[a] = fewest pieces to make a; from[a] = denom used to reach a
  const best = new Array<number>(amount + 1).fill(INF);
  best[0] = 0;
  const from = new Array<number>(amount + 1).fill(0);
  // bounded knapsack: iterate denoms, expand each count as repeated single items
  // (counts are small — ≤10 per denom — so this stays tiny)
  for (const d of DENOMS) {
    const count = till[d] ?? 0;
    for (let c = 0; c < count; c++) {
      // one extra piece of d: relax amounts descending so each piece used once
      for (let a = amount; a >= d; a--) {
        if (best[a - d] + 1 < best[a]) {
          best[a] = best[a - d] + 1;
          from[a] = d;
        }
      }
    }
  }
  if (best[amount] === INF) return null;
  const pieces: Denom[] = [];
  for (let a = amount; a > 0; a -= from[a]) pieces.push(from[a]);
  return pieces.sort((x, y) => y - x);
}

export function canMakeChange(till: Till, amount: number): boolean {
  return makeChange(till, amount) !== null;
}

/** Coins the player may ask the customer for when exact change is impossible:
 *  each returned d makes changeDue + d makeable. Ascending, smallest ask first. */
export function askOptions(till: Till, changeDue: number): Denom[] {
  if (canMakeChange(till, changeDue)) return [];
  return [...COIN_DENOMS]
    .filter((d) => canMakeChange(till, changeDue + d))
    .sort((a, b) => a - b);
}
