import type { PriceStyle } from './menu';
import type { RoundError } from './round';

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
  underpayProb: number;
  disputeProb: number;
  tabProb: number;
  splitProb: number;
  happyHourProb: number;
  rowdyProb: number;
}

export const MAX_LEVEL = 30;

interface Anchor extends DifficultyParams { level: number; }

const ANCHORS: Anchor[] = [
  { level: 1,  itemsMin: 1, itemsMax: 2, priceStyle: 'half', paymentStyle: 'exact-or-round',
    patienceSeconds: 35, menuVisibleSeconds: null, scarceDenoms: 0, midOrderChangeProb: 0,
    showPileTotal: true,  ordersPerLevel: 6,
    underpayProb: 0, disputeProb: 0, tabProb: 0, splitProb: 0,
    happyHourProb: 0, rowdyProb: 0 },
  { level: 6,  itemsMin: 2, itemsMax: 3, priceStyle: 'tens', paymentStyle: 'round',
    patienceSeconds: 28, menuVisibleSeconds: 5,    scarceDenoms: 1, midOrderChangeProb: 0.1,
    showPileTotal: true,  ordersPerLevel: 8,
    underpayProb: 0.08, disputeProb: 0, tabProb: 0, splitProb: 0,
    happyHourProb: 0, rowdyProb: 0 },
  { level: 14, itemsMin: 3, itemsMax: 5, priceStyle: 'any',  paymentStyle: 'awkward',
    patienceSeconds: 20, menuVisibleSeconds: 3,    scarceDenoms: 2, midOrderChangeProb: 0.25,
    showPileTotal: false, ordersPerLevel: 10,
    underpayProb: 0.15, disputeProb: 0.12, tabProb: 0.18, splitProb: 0.12,
    happyHourProb: 0.3, rowdyProb: 0 },
  { level: 22, itemsMin: 4, itemsMax: 6, priceStyle: 'any',  paymentStyle: 'awkward',
    patienceSeconds: 15, menuVisibleSeconds: 0,    scarceDenoms: 3, midOrderChangeProb: 0.35,
    showPileTotal: false, ordersPerLevel: 12,
    underpayProb: 0.2, disputeProb: 0.2, tabProb: 0.25, splitProb: 0.2,
    happyHourProb: 0.4, rowdyProb: 0.1 },
  { level: 30, itemsMin: 5, itemsMax: 7, priceStyle: 'any',  paymentStyle: 'awkward',
    patienceSeconds: 12, menuVisibleSeconds: 0,    scarceDenoms: 4, midOrderChangeProb: 0.4,
    showPileTotal: false, ordersPerLevel: 12,
    underpayProb: 0.25, disputeProb: 0.25, tabProb: 0.3, splitProb: 0.25,
    happyHourProb: 0.5, rowdyProb: 0.15 },
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
  const result: DifficultyParams = {
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
    underpayProb: 0,
    disputeProb: 0,
    tabProb: 0,
    splitProb: 0,
    happyHourProb: 0,
    rowdyProb: 0,
  };
  const gated = (value: number, entry: number) => (l < entry ? 0 : value);
  result.underpayProb = gated(lerp(lo.underpayProb, hi.underpayProb, t), 6);
  result.disputeProb = gated(lerp(lo.disputeProb, hi.disputeProb, t), 9);
  result.tabProb = gated(lerp(lo.tabProb, hi.tabProb, t), 8);
  result.splitProb = gated(lerp(lo.splitProb, hi.splitProb, t), 11);
  result.happyHourProb = gated(lerp(lo.happyHourProb, hi.happyHourProb, t), 12);
  result.rowdyProb = gated(lerp(lo.rowdyProb, hi.rowdyProb, t), 16);
  return result;
}

const RUSH_SECONDS_PER_LEVEL = 30;

export function paramsForRush(elapsedSeconds: number): DifficultyParams {
  const virtualLevel = 1 + elapsedSeconds / RUSH_SECONDS_PER_LEVEL;
  return paramsForLevel(Math.min(virtualLevel, MAX_LEVEL));
}

export type Skill =
  | 'sums' | 'parsing' | 'change' | 'shortages' | 'speed'
  | 'traps' | 'disputes' | 'tabs' | 'splits';

export const SKILL_ERROR: Record<Skill, RoundError> = {
  sums: 'sum-wrong',
  parsing: 'parse-wrong',
  change: 'change-wrong',
  shortages: 'shortage-missed',
  speed: 'timeout',
  traps: 'trap-missed',
  disputes: 'dispute-wrong',
  tabs: 'tab-wrong',
  splits: 'split-wrong',
};

/** Drill presets: mid-level base, all special mechanics off, then per-skill overrides. */
export function practiceParams(skill: Skill): DifficultyParams {
  const base: DifficultyParams = {
    ...paramsForLevel(12),
    ordersPerLevel: 10,
    underpayProb: 0,
    disputeProb: 0,
    tabProb: 0,
    splitProb: 0,
    happyHourProb: 0,
    rowdyProb: 0,
  };
  switch (skill) {
    case 'sums':
    case 'parsing':
      return { ...base, itemsMin: 3, itemsMax: 6, menuVisibleSeconds: 3 };
    case 'change':
      return { ...base, paymentStyle: 'awkward', showPileTotal: false };
    case 'shortages':
      return { ...base, scarceDenoms: 3 };
    case 'speed':
      return { ...base, patienceSeconds: 12, itemsMin: 1, itemsMax: 2 };
    case 'traps':
      return { ...base, underpayProb: 1 };
    case 'disputes':
      return { ...base, disputeProb: 1, paymentStyle: 'round' };
    case 'tabs':
      return { ...base, tabProb: 1 };
    case 'splits':
      return { ...base, splitProb: 1, itemsMin: 3, itemsMax: 6 };
  }
}
