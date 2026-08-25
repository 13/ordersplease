export type Cents = number;

export function formatEuro(cents: Cents, symbolFirst = false): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const num = `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
  return symbolFirst ? `€ ${num}` : `${num} €`;
}

export function parseEuro(input: string): Cents | null {
  const cleaned = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** Euros-first entry string → cents. '5' → 500, '4,5' → 450, '' → 0. */
export function parseEntry(input: string): Cents {
  if (input === '') return 0;
  const [euros, cents = ''] = input.split(',');
  const c = `${cents}00`.slice(0, 2);
  return Number(euros || '0') * 100 + Number(c);
}
