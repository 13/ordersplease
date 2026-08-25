import type { PriceStyle } from './menu';

export type PaymentStyle = 'exact-or-round' | 'round' | 'awkward';

export interface DifficultyParams {
  itemsMin: number;
  itemsMax: number;
  priceStyle: PriceStyle;
  paymentStyle: PaymentStyle;
  patienceSeconds: number;
  menuVisibleSeconds: number | null;
  scarceDenoms: number;
  midOrderChangeProb: number;
  showPileTotal: boolean;
  ordersPerLevel: number;
}

export const MAX_LEVEL = 30;

interface Anchor extends DifficultyParams { level: number; }

const ANCHORS: Anchor[] = [
  { level: 1,  itemsMin: 1, itemsMax: 1, priceStyle: 'round', paymentStyle: 'exact-or-round',
    patienceSeconds: 45, menuVisibleSeconds: null, scarceDenoms: 0, midOrderChangeProb: 0,
    showPileTotal: true,  ordersPerLevel: 8 },
  { level: 10, itemsMin: 2, itemsMax: 3, priceStyle: 'half',  paymentStyle: 'round',
    patienceSeconds: 30, menuVisibleSeconds: 5,    scarceDenoms: 1, midOrderChangeProb: 0,
    showPileTotal: true,  ordersPerLevel: 10 },
  { level: 20, itemsMin: 3, itemsMax: 5, priceStyle: 'tens',  paymentStyle: 'awkward',
    patienceSeconds: 20, menuVisibleSeconds: 3,    scarceDenoms: 2, midOrderChangeProb: 0.2,
    showPileTotal: false, ordersPerLevel: 12 },
  { level: 30, itemsMin: 4, itemsMax: 6, priceStyle: 'any',   paymentStyle: 'awkward',
    patienceSeconds: 15, menuVisibleSeconds: 0,    scarceDenoms: 3, midOrderChangeProb: 0.35,
    showPileTotal: false, ordersPerLevel: 12 },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function paramsForLevel(level: number): DifficultyParams {
  const l = Math.min(Math.max(level, 1), MAX_LEVEL);
  let lo = ANCHORS[0];
  let hi = ANCHORS[ANCHORS.length - 1];
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    if (l >= ANCHORS[i].level && l <= ANCHORS[i + 1].level) {
      lo = ANCHORS[i];
      hi = ANCHORS[i + 1];
      break;
    }
  }
  const t = hi.level === lo.level ? 0 : (l - lo.level) / (hi.level - lo.level);
  // enum/step fields switch when we pass the halfway point to the next anchor
  const stepSrc = t < 0.5 ? lo : hi;
  return {
    itemsMin: Math.round(lerp(lo.itemsMin, hi.itemsMin, t)),
    itemsMax: Math.round(lerp(lo.itemsMax, hi.itemsMax, t)),
    priceStyle: stepSrc.priceStyle,
    paymentStyle: stepSrc.paymentStyle,
    patienceSeconds: Math.round(lerp(lo.patienceSeconds, hi.patienceSeconds, t)),
    menuVisibleSeconds:
      lo.menuVisibleSeconds === null && t === 0
        ? null
        : stepSrc.menuVisibleSeconds,
    scarceDenoms: Math.round(lerp(lo.scarceDenoms, hi.scarceDenoms, t)),
    midOrderChangeProb: lerp(lo.midOrderChangeProb, hi.midOrderChangeProb, t),
    showPileTotal: stepSrc.showPileTotal,
    ordersPerLevel: Math.round(lerp(lo.ordersPerLevel, hi.ordersPerLevel, t)),
  };
}

const RUSH_SECONDS_PER_LEVEL = 30;

export function paramsForRush(elapsedSeconds: number): DifficultyParams {
  const virtualLevel = 1 + elapsedSeconds / RUSH_SECONDS_PER_LEVEL;
  return paramsForLevel(Math.min(virtualLevel, MAX_LEVEL));
}
