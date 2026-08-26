import type { DifficultyParams } from './difficulty';
import type { SessionMode } from './session';

export interface Upgrade {
  id: string;
  costCents: number;
  kind: 'gameplay' | 'cosmetic';
}

export const UPGRADES: Upgrade[] = [
  { id: 'jar-xl', costCents: 2000, kind: 'gameplay' },
  { id: 'coffee-machine', costCents: 5000, kind: 'gameplay' },
  { id: 'cheat-sheet', costCents: 3000, kind: 'gameplay' },
  { id: 'accent-copper', costCents: 1000, kind: 'cosmetic' },
  { id: 'accent-forest', costCents: 1000, kind: 'cosmetic' },
];

const RANKED: SessionMode[] = ['daily', 'weekly'];

export function applyUpgrades(
  params: DifficultyParams, upgrades: readonly string[], mode: SessionMode,
): DifficultyParams {
  if (RANKED.includes(mode) || !upgrades.includes('coffee-machine')) return params;
  return { ...params, patienceSeconds: params.patienceSeconds + 1 };
}

export function boostTip(
  tipCents: number, upgrades: readonly string[], mode: SessionMode,
): number {
  if (RANKED.includes(mode) || !upgrades.includes('jar-xl')) return tipCents;
  const boosted = Math.round(tipCents * 1.1);
  return Math.ceil(boosted / 10) * 10;
}

export function freeFirstHint(upgrades: readonly string[], mode: SessionMode): boolean {
  return !RANKED.includes(mode) && upgrades.includes('cheat-sheet');
}

export type CareerTitle = 'aushilfe' | 'barkeeper' | 'schichtleiter' | 'wirt' | 'legende';

export function careerTitle(totalStars: number, maxLevelWon: number): CareerTitle {
  if (totalStars >= 90 && maxLevelWon >= 40) return 'legende';
  if (totalStars >= 60 && maxLevelWon >= 25) return 'wirt';
  if (totalStars >= 30 && maxLevelWon >= 15) return 'schichtleiter';
  if (totalStars >= 10) return 'barkeeper';
  return 'aushilfe';
}
