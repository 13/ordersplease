import { persisted } from './persisted';
import { MAX_LEVEL } from '$core/difficulty';

export interface Progress { stars: Record<number, number>; }

export const progress = persisted<Progress>('op.progress', { stars: {} });

export function unlockedLevel(p: Progress): number {
  const starred = Object.keys(p.stars).map(Number).filter((l) => p.stars[l] > 0);
  return Math.min(starred.length === 0 ? 1 : Math.max(...starred) + 1, MAX_LEVEL);
}
