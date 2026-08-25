import type { Order, OrderLine } from './order';

type Locale = 'en' | 'de';

const QTY: Record<Locale, string[]> = {
  en: ['', 'a', 'two', 'three', 'four', 'five', 'six', 'seven'],
  de: ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben'],
};

function lineText(line: OrderLine, locale: Locale): string {
  const qtyWord = QTY[locale][line.qty] ?? String(line.qty);
  let name = line.item.name;
  if (locale === 'en' && line.qty > 1 && !name.endsWith('s')) name += 's';
  return `${qtyWord} ${name}`;
}

function joinLines(parts: string[], locale: Locale): string {
  const and = locale === 'en' ? 'and' : 'und';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} ${and} ${parts[parts.length - 1]}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function renderOrder(order: Order, locale: Locale): string {
  const please = locale === 'en' ? 'please' : 'bitte';
  const body = joinLines(order.lines.map((l) => lineText(l, locale)), locale);
  return `${capitalize(body)}, ${please}.`;
}

// EN amendments say "one", not "a" ("make that one Beer" — never "make that a Beer")
export function renderAmendment(line: OrderLine, locale: Locale): string {
  const qtyWordsEn = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
  if (locale === 'en') {
    let name = line.item.name;
    if (line.qty > 1 && !name.endsWith('s')) name += 's';
    return `Actually, make that ${qtyWordsEn[line.qty] ?? line.qty} ${name}.`;
  }
  return `Ach, machen Sie doch ${lineText(line, 'de')}.`;
}

export function renderWave(order: Order, locale: Locale): string {
  const and = locale === 'en' ? 'And' : 'Und';
  return `${and} ${joinLines(order.lines.map((l) => lineText(l, locale)), locale)}.`;
}

export function renderPayer(lines: OrderLine[], locale: Locale): string {
  const prefix = locale === 'en' ? 'I pay' : 'Ich zahle';
  return `${prefix} ${joinLines(lines.map((l) => lineText(l, locale)), locale)}.`;
}
