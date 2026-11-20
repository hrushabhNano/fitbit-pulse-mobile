// The dot-matrix numerals of the glow design (unstrap docs/design/v2/spec.md § 2.3, ported from its DotSpec.kt): a 5×7
// dot font for digits and a few signs, laid out as plain geometry. Pure TypeScript, so DotText draws it with Skia and
// the tests check it in Node.

/** Glyphs one string per row, `#` a dot. Anything not listed draws as a space. */
const GLYPHS: Record<string, string[]> = {
  "0": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  ".": [".", ".", ".", ".", ".", ".", "#"],
  ",": [".", ".", ".", ".", ".", "#", "#"],
  ":": [".", ".", "#", ".", ".", "#", "."],
  "-": ["...", "...", "...", "###", "...", "...", "..."],
  // The real minus sign of signed values, drawn as the dash is.
  "−": ["...", "...", "...", "###", "...", "...", "..."],
  "+": ["...", "...", ".#.", "###", ".#.", "...", "..."],
  k: ["#....", "#....", "#..#.", "#.#..", "##...", "#.#..", "#..#."],
  "%": ["##...", "##..#", "...#.", "..#..", ".#...", "#..##", "...##"],
  " ": ["..", "..", "..", "..", "..", "..", ".."],
};

/** Rows in every glyph. */
export const DOT_ROWS = 7;

/** The gap between dots as a share of the dot, so every size has the same texture. */
export const DOT_GAP = 0.38;

/**
 * The six dot sizes (spec 2.3), in dp, by where the number sits, so the same kind of number is the same size on every
 * screen.
 */
export const DOT_SIZE = {
  /** Four or more figures side by side. */
  row: 2.4,
  /** Picture cards and Smalls. */
  edge: 3,
  /** Talls, the second glow, glow cards that aren't the hero. */
  second: 3.6,
  /** The hero's number. */
  hero: 4.5,
  /** A detail's header. */
  detail: 6,
  /** The live workout. */
  live: 9,
} as const;
export type DotSize = keyof typeof DOT_SIZE;

/** The glyph for `c`, a space when the font has none. */
export function glyph(c: string): string[] {
  return GLYPHS[c] ?? GLYPHS[" "];
}

/** Whether `c` has a glyph of its own. */
export const hasGlyph = (c: string) => c in GLYPHS;

/** Dot columns `text` takes, with one empty column between glyphs. */
export function dotColumns(text: string): number {
  const glyphs = [...text].map(glyph);
  return glyphs.reduce((n, g) => n + g[0].length, 0) + Math.max(0, glyphs.length - 1);
}

export type DotLayout = { width: number; height: number; radius: number; centers: { x: number; y: number }[] };

/** Where `text`'s dots sit for dots `dot` dp across: the box it takes and each dot's centre from the top left. */
export function dotLayout(text: string, dot: number): DotLayout {
  const gap = dot * DOT_GAP;
  const pitch = dot + gap;
  const centers: { x: number; y: number }[] = [];
  let x0 = 0;
  for (const rows of [...text].map(glyph)) {
    rows.forEach((line, row) => {
      [...line].forEach((c, col) => {
        if (c === "#") centers.push({ x: x0 + col * pitch + dot / 2, y: row * pitch + dot / 2 });
      });
    });
    x0 += (rows[0].length + 1) * pitch;
  }
  const columns = dotColumns(text);
  return { width: Math.max(0, pitch * columns - gap), height: pitch * DOT_ROWS - gap, radius: dot / 2, centers };
}

/** How wide `text` is in dots of `dot` dp. */
export const dotTextWidth = (text: string, dot: number) => (dot + dot * DOT_GAP) * dotColumns(text) - dot * DOT_GAP;

/** The scale that fits `text` in `dot` dots into `room` dp: 1 when it fits already, never larger. */
export const dotFitScale = (text: string, dot: number, room: number) => Math.min(1, room / dotTextWidth(text, dot));
