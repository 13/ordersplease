import { fullTill, type Denom, type Till } from './till';

export interface TutorialStep {
  lines: { id: string; qty: number }[];
  totalCents: number;
  paymentPieces: Denom[];
  changeDue: number;
  needsAsk: boolean;
  askDenom: Denom | null;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { lines: [{ id: 'beer', qty: 1 }], totalCents: 400,
    paymentPieces: [200, 200], changeDue: 0, needsAsk: false, askDenom: null },
  { lines: [{ id: 'water', qty: 1 }, { id: 'cola', qty: 1 }], totalCents: 550,
    paymentPieces: [1000], changeDue: 450, needsAsk: false, askDenom: null },
  { lines: [{ id: 'wine', qty: 1 }], totalCents: 450,
    paymentPieces: [500], changeDue: 100, needsAsk: true, askDenom: 50 },
];

export function tutorialTill(step: number): Till {
  const t = fullTill();
  if (step === 2) { t[50] = 0; t[20] = 0; t[10] = 0; }
  return t;
}
