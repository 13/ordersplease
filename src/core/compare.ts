/** week '2026-W35' → packed int (year*54 + week) for compact base36. */
function packWeek(week: string): number | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!m) return null;
  const wk = Number(m[2]);
  if (wk < 1 || wk > 53) return null; // base-54 packing breaks silently beyond ISO's 01-53
  return Number(m[1]) * 54 + wk;
}

function unpackWeek(n: number): string {
  const year = Math.floor(n / 54);
  const wk = n % 54;
  return `${year}-W${String(wk).padStart(2, '0')}`;
}

function checksum(payload: string): string {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) sum = (sum * 36 + payload.charCodeAt(i)) % 97;
  return String(sum).padStart(2, '0');
}

export function encodeResult(r: { week: string; score: number }): string {
  const w = packWeek(r.week);
  if (w === null || !Number.isInteger(r.score) || r.score < 0) return '';
  const payload = `${w.toString(36)}-${r.score.toString(36)}`;
  return `OP-${payload}-${checksum(payload)}`.toUpperCase();
}

export function decodeResult(code: string): { week: string; score: number } | null {
  const m = /^OP-([0-9A-Z]+)-([0-9A-Z]+)-(\d{2})$/.exec(code.trim().toUpperCase());
  if (!m) return null;
  const payload = `${m[1]}-${m[2]}`.toLowerCase();
  if (checksum(payload) !== m[3]) return null;
  const w = parseInt(m[1], 36);
  const score = parseInt(m[2], 36);
  if (!Number.isFinite(w) || !Number.isFinite(score)) return null;
  const week = unpackWeek(w);
  if (packWeek(week) !== w) return null;
  return { week, score };
}
