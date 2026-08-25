import { applyPriceStyle, type MenuItem } from './menu';
import {
  paramsForLevel, paramsForRush, type DifficultyParams,
} from './difficulty';
import { fullTill, scarceTill, type Till } from './till';
import { mulberry32 } from './order';
import type { RoundState } from './round';
import { scoreRound } from './scoring';

export interface Customer { id: number; patienceMs: number; maxPatienceMs: number; }

export const MAX_LIVES = 3;
const QUEUE_CAP = 3;
const WAITING_DRAIN_RATE = 0.5;

export interface SessionState {
  mode: 'level' | 'rush';
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
}

function spawnIntervalMs(params: DifficultyParams): number {
  return params.patienceSeconds * 0.8 * 1000;
}

function newCustomer(s: SessionState): Customer {
  const ms = s.params.patienceSeconds * 1000;
  return { id: s.nextCustomerId, patienceMs: ms, maxPatienceMs: ms };
}

export function createSession(
  mode: 'level' | 'rush', level: number,
  baseMenu: MenuItem[], isCustomMenu: boolean, seed: number,
): SessionState {
  const params = mode === 'level' ? paramsForLevel(level) : paramsForRush(0);
  const rng = mulberry32(seed);
  const till = params.scarceDenoms === 0 ? fullTill() : scarceTill(rng, params.scarceDenoms);
  const menu = isCustomMenu ? baseMenu : applyPriceStyle(baseMenu, params.priceStyle);
  const s: SessionState = {
    mode, level, elapsedMs: 0, menu, till,
    queue: [], livesLost: 0, score: 0, streak: 0, roundsDone: 0,
    finished: null, params, rng, nextCustomerId: 1,
    spawnCooldownMs: spawnIntervalMs(params),
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
  if (s.finished === null && s.livesLost >= MAX_LIVES) return { ...s, finished: 'lost' };
  return s;
}

export function tickSession(s: SessionState, dtMs: number): SessionState {
  if (s.finished) return s;
  let next: SessionState = { ...s, elapsedMs: s.elapsedMs + dtMs };
  if (next.mode === 'rush') {
    next.params = paramsForRush(next.elapsedMs / 1000);
    next.level = Math.floor(1 + next.elapsedMs / 30_000);
    next.spawnCooldownMs -= dtMs;
    if (next.spawnCooldownMs <= 0) {
      next = spawnCustomer(next);
      next.spawnCooldownMs = spawnIntervalMs(next.params);
    }
  }
  const drained = next.queue.map((c, i) => ({
    ...c,
    patienceMs: c.patienceMs - dtMs * (i === 0 ? 1 : WAITING_DRAIN_RATE),
  }));
  const stayed = drained.filter((c) => c.patienceMs > 0);
  const walkouts = drained.length - stayed.length;
  next.queue = stayed;
  next.livesLost += walkouts;
  if (walkouts > 0) next.streak = 0;
  return checkLost(next);
}

export function patienceFrac(s: SessionState): number {
  const head = s.queue[0];
  return head ? Math.max(head.patienceMs, 0) / head.maxPatienceMs : 0;
}

export function completeRound(s: SessionState, round: RoundState): SessionState {
  if (s.finished) return s;
  const frac = patienceFrac(s);
  const firstTry = round.sumTries === 0 && round.changeTries === 0;
  const success = round.success === true;
  const gained = scoreRound({
    success, firstTry, usedAsk: success && round.usedAsk,
    patienceFrac: frac, streakBefore: s.streak,
  });
  let next: SessionState = {
    ...s,
    queue: s.queue.slice(1),
    score: s.score + gained,
    streak: success && firstTry ? s.streak + 1 : 0,
    roundsDone: s.roundsDone + 1,
    livesLost: s.livesLost + (success ? 0 : 1),
    till: success ? round.till : s.till,
  };
  next = checkLost(next);
  if (next.finished === null && next.mode === 'level'
      && next.roundsDone >= next.params.ordersPerLevel) {
    next.finished = 'won';
  }
  return next;
}
