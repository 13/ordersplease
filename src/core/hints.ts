import type { RoundState } from './round';
import { formatEuro } from './money';
import { canMakeChange } from './change';

/** Contextual hint text. Reveals structure, never the full solution. */
export function hintFor(round: RoundState, index: number, locale: 'en' | 'de'): string {
  if (round.phase === 'sum') {
    const lines = round.order.lines;
    const l = lines[Math.min(index, lines.length - 1)];
    return `${l.qty}× ${l.item.name} = ${formatEuro(l.item.priceCents * l.qty)}`;
  }
  if (round.paymentCents < round.order.totalCents) {
    return locale === 'en' ? 'Count the payment again…' : 'Zähl das Geld nochmal nach…';
  }
  if (!round.usedAsk && !canMakeChange(round.till, round.changeDue)) {
    return locale === 'en'
      ? 'The till can\'t make this — ask for a coin.'
      : 'Die Kasse kann das nicht — frag nach einer Münze.';
  }
  return locale === 'en'
    ? `Change: ${formatEuro(round.changeDue)}`
    : `Wechselgeld: ${formatEuro(round.changeDue)}`;
}
