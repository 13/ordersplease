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
