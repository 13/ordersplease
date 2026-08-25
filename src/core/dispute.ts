import { NOTE_DENOMS, type Denom } from './till';

export interface Dispute {
  actualNote: Denom;
  claimedNote: Denom;
}

/** Customer claims to have paid with a bigger note than they did.
 *  Null when the roll fails, the payment has no note, or the largest
 *  note is already 50 € (no plausible higher claim exists). */
export function maybeDispute(
  paymentPieces: Denom[], prob: number, rng: () => number,
): Dispute | null {
  if (rng() >= prob) return null;
  const notes = paymentPieces.filter((p) => p >= 500);
  if (notes.length === 0) return null;
  const actualNote = Math.max(...notes);
  const asc = [...NOTE_DENOMS].sort((a, b) => a - b);
  const claimedNote = asc.find((n) => n > actualNote);
  if (claimedNote === undefined) return null; // actual is 5000
  return { actualNote, claimedNote };
}
