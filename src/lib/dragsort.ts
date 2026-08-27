export interface RowBand { top: number; bottom: number }

/** Slot a pointer at `y` belongs to, given each row's vertical band in the
 *  same coordinate space (viewport). Bands are assumed top-to-bottom.
 *  Outside the list clamps to the first/last row; a pointer in the gap
 *  between two rows picks the nearer one. Returns -1 for an empty list. */
export function indexAtY(rows: readonly RowBand[], y: number): number {
  if (rows.length === 0) return -1;
  if (y <= rows[0].bottom) return 0;
  const last = rows.length - 1;
  if (y >= rows[last].top) return last;
  for (let i = 0; i <= last; i++) {
    if (y <= rows[i].bottom) return i;
    // in the gap before the next row: whichever edge is closer
    if (y < rows[i + 1].top) {
      return y - rows[i].bottom < rows[i + 1].top - y ? i : i + 1;
    }
  }
  return last;
}
