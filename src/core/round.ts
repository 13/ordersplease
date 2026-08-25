import type { Order } from './order';
import { piecesTotal } from './order';
import {
  addToTill, hasPieces, removeFromTill, type Denom, type Till, DENOMS,
} from './till';
import { askOptions, canMakeChange } from './change';

export type Phase = 'sum' | 'change' | 'done';
export type RoundError =
  | 'sum-wrong' | 'change-wrong' | 'shortage-missed' | 'parse-wrong' | 'timeout'
  | 'trap-missed' | 'dispute-wrong' | 'tab-wrong' | 'split-wrong';

export type RoundKind = 'normal' | 'tab' | 'split';

export const MAX_TRIES = 2;

export interface RoundState {
  phase: Phase;
  kind: RoundKind;
  order: Order;
  paymentPieces: Denom[];
  paymentCents: number;
  till: Till;
  changeDue: number;
  sumTries: number;
  changeTries: number;
  usedAsk: boolean;
  usedTrapCall: boolean;
  usedHint: boolean;
  success: boolean | null;
  errors: RoundError[];
}

export function createRound(
  order: Order, paymentPieces: Denom[], till: Till, kind: RoundKind = 'normal',
): RoundState {
  return {
    phase: 'sum',
    kind,
    order,
    paymentPieces,
    paymentCents: piecesTotal(paymentPieces),
    till,
    changeDue: 0,
    sumTries: 0,
    changeTries: 0,
    usedAsk: false,
    usedTrapCall: false,
    usedHint: false,
    success: null,
    errors: [],
  };
}

function fail(s: RoundState, errors: RoundError[]): RoundState {
  return { ...s, phase: 'done', success: false, errors };
}

export function submitSum(s: RoundState, cents: number): RoundState {
  if (s.phase !== 'sum') return s;
  if (cents === s.order.totalCents) {
    return { ...s, phase: 'change', changeDue: s.paymentCents - s.order.totalCents };
  }
  const tries = s.sumTries + 1;
  if (tries >= MAX_TRIES) {
    const errors: RoundError[] = ['sum-wrong'];
    if (s.kind === 'tab') errors.push('tab-wrong');
    else if (s.kind === 'split') errors.push('split-wrong');
    else if (s.order.lines.length > 1) errors.push('parse-wrong');
    return fail({ ...s, sumTries: tries }, errors);
  }
  return { ...s, sumTries: tries };
}

function failChange(s: RoundState): RoundState {
  if (isUnderpaid(s)) return fail(s, ['trap-missed']);
  const errors: RoundError[] = ['change-wrong'];
  if (!s.usedAsk && !canMakeChange(s.till, s.paymentCents - s.order.totalCents))
    errors.push('shortage-missed');
  return fail(s, errors);
}

function bumpChangeTry(s: RoundState): RoundState {
  const tries = s.changeTries + 1;
  const next = { ...s, changeTries: tries };
  return tries >= MAX_TRIES ? failChange(next) : next;
}

function isUnderpaid(s: RoundState): boolean {
  return s.paymentCents < s.order.totalCents;
}

export function challengePayment(s: RoundState): RoundState {
  if (s.phase !== 'change') return s;
  if (isUnderpaid(s)) {
    const shortfall = s.order.totalCents - s.paymentCents;
    const topUp = [...DENOMS].sort((a, b) => a - b).find((d) => d >= shortfall) ?? 5000;
    const paymentPieces = [...s.paymentPieces, topUp];
    const paymentCents = piecesTotal(paymentPieces);
    return {
      ...s,
      usedTrapCall: true,
      paymentPieces,
      paymentCents,
      changeDue: paymentCents - s.order.totalCents,
    };
  }
  return bumpChangeTry(s);
}

export function submitChange(s: RoundState, pile: Denom[]): RoundState {
  if (s.phase !== 'change') return s;
  if (isUnderpaid(s)) return fail(s, ['trap-missed']);
  if (piecesTotal(pile) === s.changeDue && hasPieces(s.till, pile)) {
    const incoming = s.usedAsk
      ? [...s.paymentPieces, s.paymentCents - piecesTotal(s.paymentPieces)]
      : s.paymentPieces;
    const till = addToTill(removeFromTill(s.till, pile), incoming);
    return { ...s, phase: 'done', success: true, till };
  }
  return bumpChangeTry(s);
}

export function askCustomer(s: RoundState, denom: Denom): RoundState {
  if (s.phase !== 'change') return s;
  if (isUnderpaid(s)) return bumpChangeTry(s); // underpayment must be challenged, not asked around
  if (s.usedAsk) return bumpChangeTry(s); // one ask per round — keeps the asked-coin reconstruction in submitChange sound
  if (askOptions(s.till, s.changeDue).includes(denom)) {
    return {
      ...s,
      usedAsk: true,
      changeDue: s.changeDue + denom,
      paymentCents: s.paymentCents + denom,
    };
  }
  return bumpChangeTry(s);
}

export function timeoutRound(s: RoundState): RoundState {
  if (s.phase === 'done') return s;
  return fail(s, ['timeout']);
}

export function markHint(s: RoundState): RoundState {
  if (s.phase === 'done' || s.usedHint) return s;
  return { ...s, usedHint: true };
}
