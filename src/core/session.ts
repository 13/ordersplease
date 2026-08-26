import { applyPriceStyle, type MenuItem } from './menu';
import {
  paramsForLevel, paramsForRush, type DifficultyParams,
} from './difficulty';
import { fullTill, scarceTill, type Till } from './till';
import { mulberry32 } from './order';
import type { RoundState, RoundError } from './round';
import { scoreRound } from './scoring';
import { dailyLevelFor } from './daily';
import { weeklyLevelFor } from './weekly';
import { rollHappyHourStart } from './happy-hour';

export interface Customer { id: number; patienceMs: number; maxPatienceMs: number; }

export const MAX_LIVES = 3;
const QUEUE_CAP = 3;
const WAITING_DRAIN_RATE = 0.5;

export type SessionMode = 'level' | 'rush' | 'practice' | 'daily' | 'weekly';

export interface RoundLogEntry {
  orderText: string;
  ms: number;
  success: boolean;
  errors: RoundError[];
  scoreGained: number;
  sub?: boolean; // split payer before the last — not a full customer round
}

export interface RoundMeta { orderText: string; ms: number; }

export interface SessionState {
  mode: SessionMode;
  level: number;
  elapsedMs: number;
  menu: MenuItem[];
  till: Till;
  queue: Customer[];
  livesLost: number;
  score: number;
  streak: number;
  roundsDone: number;
  finished: 'won' | 'lost' | null;
  params: DifficultyParams;
  rng: () => number;
  nextCustomerId: number;
  spawnCooldownMs: number;
  roundLog: RoundLogEntry[];
  lastWalkouts: number;
  happyHourStart: number | null;
}

function spawnIntervalMs(params: DifficultyParams): number {
  return params.patienceSeconds * 0.8 * 1000;
}

function newCustomer(s: SessionState): Customer {
  const ms = s.params.patienceSeconds * 1000;
  return { id: s.nextCustomerId, patienceMs: ms, maxPatienceMs: ms };
}

export function createSession(
  mode: SessionMode, level: number,
  baseMenu: MenuItem[], isCustomMenu: boolean, seed: number,
  paramsOverride?: DifficultyParams,
): SessionState {
  const params = paramsOverride
    ?? (mode === 'level' ? paramsForLevel(level) : paramsForRush(0));
  const rng = mulberry32(seed);
  const till = params.scarceDenoms === 0 ? fullTill() : scarceTill(rng, params.scarceDenoms);
  const menu = isCustomMenu ? baseMenu : applyPriceStyle(baseMenu, params.priceStyle);
  const happyHourStart = rollHappyHourStart(params, rng);
  const s: SessionState = {
    mode, level, elapsedMs: 0, menu, till,
    queue: [], livesLost: 0, score: 0, streak: 0, roundsDone: 0,
    finished: null, params, rng, nextCustomerId: 1,
    spawnCooldownMs: spawnIntervalMs(params),
    roundLog: [], lastWalkouts: 0, happyHourStart,
  };
  return spawnCustomer(s);
}

export function spawnCustomer(s: SessionState): SessionState {
  if (s.queue.length >= QUEUE_CAP) return s;
  return {
    ...s,
    queue: [...s.queue, newCustomer(s)],
    nextCustomerId: s.nextCustomerId + 1,
  };
}

function checkLost(s: SessionState): SessionState {
  if ((s.mode === 'level' || s.mode === 'rush')
      && s.finished === null && s.livesLost >= MAX_LIVES) {
    return { ...s, finished: 'lost' };
  }
  return s;
}

export function tickSession(s: SessionState, dtMs: number): SessionState {
  if (s.finished) return s;
  let next: SessionState = { ...s, elapsedMs: s.elapsedMs + dtMs };
  if (next.mode === 'rush') {
    next.params = paramsForRush(next.elapsedMs / 1000);
    next.level = Math.floor(1 + next.elapsedMs / 30_000);
    next.spawnCooldownMs -= dtMs;
  }
  const drained = next.queue.map((c, i) => ({
    ...c,
    patienceMs: c.patienceMs - dtMs * (i === 0 ? 1 : WAITING_DRAIN_RATE),
  }));
  const stayed = drained.filter((c) => c.patienceMs > 0);
  const walkouts = drained.length - stayed.length;
  next.queue = stayed;
  next.livesLost += walkouts;
  next.lastWalkouts = walkouts;
  if (walkouts > 0) next.streak = 0;
  // spawn after the drain so a customer arriving this tick starts with full patience
  if (next.mode === 'rush' && next.spawnCooldownMs <= 0) {
    next = spawnCustomer(next);
    next.spawnCooldownMs = spawnIntervalMs(next.params);
  }
  return checkLost(next);
}

/** The level that gates content (food) right now. */
export function effectiveLevel(s: SessionState): number {
  if (s.mode === 'daily') return dailyLevelFor(s.roundsDone);
  if (s.mode === 'weekly') return weeklyLevelFor(s.roundsDone);
  return s.level;
}

export function patienceFrac(s: SessionState): number {
  const head = s.queue[0];
  return head ? Math.max(head.patienceMs, 0) / head.maxPatienceMs : 0;
}

function scoreAndLog(
  s: SessionState, round: RoundState, meta: RoundMeta,
): { gained: number; entry: RoundLogEntry; firstTry: boolean; success: boolean } {
  const success = round.success === true;
  const firstTry = round.sumTries === 0 && round.changeTries === 0 && !round.usedHint;
  const gained = scoreRound({
    success, firstTry,
    usedAsk: success && round.usedAsk,
    usedTrapCall: success && round.usedTrapCall,
    patienceFrac: patienceFrac(s), streakBefore: s.streak,
  });
  return {
    gained, firstTry, success,
    entry: {
      orderText: meta.orderText, ms: meta.ms,
      success, errors: round.errors, scoreGained: gained,
    },
  };
}

export function completeRound(s: SessionState, round: RoundState, meta: RoundMeta): SessionState {
  if (s.finished) return s;
  const { gained, entry, firstTry, success } = scoreAndLog(s, round, meta);
  let next: SessionState = {
    ...s,
    queue: s.queue.slice(1),
    score: s.score + gained,
    streak: success && firstTry ? s.streak + 1 : 0,
    roundsDone: s.roundsDone + 1,
    livesLost: s.livesLost + (success ? 0 : 1),
    till: success ? round.till : s.till,
    roundLog: [...s.roundLog, entry],
  };
  // rush: never leave the bar dead — if the queue just emptied, hurry the next customer
  if (next.mode === 'rush' && next.queue.length === 0) {
    next.spawnCooldownMs = Math.min(next.spawnCooldownMs, 1500);
  }
  next = checkLost(next);
  if (next.finished === null && next.mode !== 'rush'
      && next.roundsDone >= next.params.ordersPerLevel) {
    next.finished = 'won';
  }
  if (next.finished === null && (next.mode === 'daily' || next.mode === 'weekly')) {
    // ramp difficulty but keep the caller's fixed order count (DAILY_ORDERS / WEEKLY_ORDERS)
    const lvl = next.mode === 'daily'
      ? dailyLevelFor(next.roundsDone)
      : weeklyLevelFor(next.roundsDone);
    next.params = { ...paramsForLevel(lvl), ordersPerLevel: next.params.ordersPerLevel };
  }
  return next;
}

/** Split payers before the last one: success-only — the customer stays, the
 *  group's round is not counted yet. */
export function completeSubRound(s: SessionState, round: RoundState, meta: RoundMeta): SessionState {
  if (s.finished) return s;
  const { gained, entry, firstTry, success } = scoreAndLog(s, round, meta);
  return {
    ...s,
    score: s.score + gained,
    streak: success && firstTry ? s.streak + 1 : 0,
    till: success ? round.till : s.till,
    roundLog: [...s.roundLog, { ...entry, sub: true }],
  };
}
