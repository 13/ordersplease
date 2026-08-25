import type { Denom } from '../core/till';

export function isNote(d: Denom): boolean {
  return d >= 500;
}

export function denomLabel(d: Denom): string {
  return d >= 100 ? `${d / 100} €` : `${d}c`;
}

const COLORS: Record<number, string> = {
  5000: '#d98e2b', 2000: '#4d7fbf', 1000: '#bf5b4d', 500: '#7fa65a',
  200: '#d8d3c8', 100: '#cfae5a', 50: '#c9962e', 20: '#c9962e',
  10: '#c9962e',
};

export function denomColor(d: Denom): string {
  return COLORS[d] ?? '#999';
}
