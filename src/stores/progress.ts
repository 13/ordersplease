import { persisted } from './persisted';
import { MAX_LEVEL } from '$core/difficulty';

export interface Best { score: number; ms: number }
export interface Progress { stars: Record<number, number>; best?: Record<number, Best>; }

export const progress = persisted<Progress>('op.progress', { stars: {} });

export function unlockedLevel(p: Progress): number {
  const starred = Object.keys(p.stars).map(Number).filter((l) => p.stars[l] > 0);
  return Math.min(starred.length === 0 ? 1 : Math.max(...starred) + 1, MAX_LEVEL);
}

export function improveBest(
  best: Record<number, Best> | undefined, level: number, score: number, ms: number,
): Record<number, Best> {
  const prev = best?.[level];
  const better = !prev
    || score > prev.score
    || (score === prev.score && ms < prev.ms);
  if (!better) return best ?? {};
  return { ...(best ?? {}), [level]: { score, ms } };
}
