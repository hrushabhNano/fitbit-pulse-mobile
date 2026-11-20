// The Pulse Glow mark: one heartbeat drawn in the dot font's dots (docs/design/glow.md, "The mark"). The app icon, the
// splash and the opening all draw it from these cells; scripts/brand/glow-icon.py reads them to write the PNGs.

/** The grid: 13 columns by 9 rows, a dot's diameter 0.7 of the pitch (a little fuller than the dot font's, to hold at launcher sizes). */
export const MARK_COLS = 13;
export const MARK_ROWS = 9;
export const MARK_DOT = 0.7;

/** [column, row] from the top left: the baseline, a small P wave, the R spike up, the S dip, the T wave, the baseline. */
export const MARK_CELLS: readonly (readonly [number, number])[] = [
  [0, 5], [1, 5], [2, 5], [3, 4], [4, 5],
  [5, 1], [5, 2], [5, 3], [5, 4], [5, 5],
  [6, 0],
  [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6], [7, 7], [7, 8],
  [8, 6], [8, 7],
  [9, 5], [10, 4], [11, 4], [12, 5],
];

/** Each dot's centre and radius in a box `width` wide (the mark spans the width; its height is 9/13 of the grid's). */
export function markDots(width: number): { x: number; y: number; r: number; col: number }[] {
  const pitch = width / (MARK_COLS - 1 + MARK_DOT);
  const r = (pitch * MARK_DOT) / 2;
  return MARK_CELLS.map(([col, row]) => ({ x: r + col * pitch, y: r + row * pitch, r, col }));
}

/** The mark's height for a width. */
export const markHeight = (width: number) => (width / (MARK_COLS - 1 + MARK_DOT)) * (MARK_ROWS - 1 + MARK_DOT);
