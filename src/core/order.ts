import type { MenuItem } from './menu';
import type { Cents } from './money';
import { COIN_DENOMS, DENOMS, NOTE_DENOMS, type Denom } from './till';
import type { DifficultyParams, PaymentStyle } from './difficulty';

export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface OrderLine { item: MenuItem; qty: number }
export interface Order { lines: OrderLine[]; totalCents: Cents }

export function orderTotal(lines: OrderLine[]): Cents {
  return lines.reduce((s, l) => s + l.item.priceCents * l.qty, 0);
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Total quantity itemsMin..itemsMax, spread over 1..3 distinct menu items. */
export function generateOrder(
  menu: MenuItem[], params: DifficultyParams, rng: () => number,
): Order {
  const totalQty =
    params.itemsMin + Math.floor(rng() * (params.itemsMax - params.itemsMin + 1));
  const distinct = Math.min(1 + Math.floor(rng() * 3), totalQty, menu.length);
  const items = [...menu].sort(() => rng() - 0.5).slice(0, distinct);
  const lines: OrderLine[] = items.map((item) => ({ item, qty: 1 }));
  for (let q = distinct; q < totalQty; q++) pick(lines, rng).qty += 1;
  return { lines, totalCents: orderTotal(lines) };
}

/** Mid-order change: one line gains one more unit. */
export function amendOrder(
  order: Order, rng: () => number,
): { order: Order; amendedLine: OrderLine } {
  const idx = Math.floor(rng() * order.lines.length);
  const lines = order.lines.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l));
  return {
    order: { lines, totalCents: orderTotal(lines) },
    amendedLine: lines[idx],
  };
}

export function piecesTotal(pieces: Denom[]): Cents {
  return pieces.reduce((s, p) => s + p, 0);
}

/** Smallest note-combination ≥ amount (greedy from largest note). */
function roundNotes(amount: Cents): Denom[] {
  const pieces: Denom[] = [];
  let remaining = amount;
  for (const n of NOTE_DENOMS) {
    while (remaining >= n) {
      pieces.push(n);
      remaining -= n;
    }
  }
  if (remaining > 0) pieces.push(smallestNoteAtLeast(remaining));
  return pieces;
}

function smallestNoteAtLeast(amount: Cents): Denom {
  const asc = [...NOTE_DENOMS].sort((a, b) => a - b);
  for (const n of asc) if (n >= amount) return n;
  return asc[asc.length - 1];
}

/** Exact decomposition into denominations (always possible: amounts are 5c multiples). */
function exactPieces(amount: Cents): Denom[] {
  const pieces: Denom[] = [];
  let remaining = amount;
  for (const d of DENOMS) {
    while (remaining >= d) {
      pieces.push(d);
      remaining -= d;
    }
  }
  return pieces;
}

export function generatePayment(
  totalCents: Cents, style: PaymentStyle, rng: () => number,
): Denom[] {
  if (style === 'exact-or-round') {
    return rng() < 0.5 ? exactPieces(totalCents) : roundNotes(totalCents);
  }
  if (style === 'round') return roundNotes(totalCents);
  // awkward: round note(s) plus one random small coin on top
  return [...roundNotes(totalCents), pick(COIN_DENOMS, rng)];
}
