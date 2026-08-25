/** Streak-scaled praise key. Uses Math.random — NEVER session.rng
 *  (outcome-dependent consumption would desync daily seeds). */
export function praiseKey(streak: number): string {
  const tier = streak >= 6 ? 3 : streak >= 3 ? 2 : 1;
  const n = 1 + Math.floor(Math.random() * 3);
  return `praise.${tier}.${n}`;
}
