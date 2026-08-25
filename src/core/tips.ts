/** 10% of the order total, rounded up to the 10c grid, never below 10c. */
export function tipFor(totalCents: number): number {
  return Math.max(10, Math.ceil((totalCents * 0.1) / 10) * 10);
}

export function tipEligible(i: {
  success: boolean; firstTry: boolean; usedHint: boolean; patienceFrac: number;
}): boolean {
  return i.success && i.firstTry && !i.usedHint && i.patienceFrac >= 0.5;
}
