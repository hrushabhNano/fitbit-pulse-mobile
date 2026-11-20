// Colour arithmetic for the glow light (HSL, luminance, mixing), on plain numbers so it runs in Node. Ported from
// unstrap's GlowStyle.kt helpers, which use Compose's Color; these match it to the 8-bit channel.

/** A colour with channels and alpha in 0..1. */
export type RGBA = { r: number; g: number; b: number; a: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** `#RRGGBB` or `#AARRGGBB` (Compose's order) to RGBA. */
export function hex(value: string): RGBA {
  const h = value.replace("#", "");
  const n = parseInt(h, 16);
  if (h.length === 8) return { a: ((n >>> 24) & 255) / 255, r: ((n >>> 16) & 255) / 255, g: ((n >>> 8) & 255) / 255, b: (n & 255) / 255 };
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: 1 };
}

/** As a CSS colour string Skia and React Native read. */
export function css(c: RGBA): string {
  const to = (v: number) => Math.round(clamp01(v) * 255);
  return `rgba(${to(c.r)},${to(c.g)},${to(c.b)},${Math.round(clamp01(c.a) * 1000) / 1000})`;
}

export const withAlpha = (c: RGBA, a: number): RGBA => ({ ...c, a: clamp01(a) });

/** Linear mix from `a` to `b` by `t` (Compose's lerp on sRGB channels). */
export function lerp(a: RGBA, b: RGBA, t: number): RGBA {
  const k = clamp01(t);
  return { r: a.r + (b.r - a.r) * k, g: a.g + (b.g - a.g) * k, b: a.b + (b.b - a.b) * k, a: a.a + (b.a - a.a) * k };
}

export const BLACK: RGBA = { r: 0, g: 0, b: 0, a: 1 };
export const WHITE_RGBA: RGBA = { r: 1, g: 1, b: 1, a: 1 };
export const TRANSPARENT: RGBA = { r: 0, g: 0, b: 0, a: 0 };

/** Hue (degrees), saturation and lightness (0..1). */
export function hslOf(c: RGBA): [number, number, number] {
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === c.r) h = ((((c.g - c.b) / d) % 6) + 6) % 6;
  else if (max === c.g) h = (c.b - c.r) / d + 2;
  else h = (c.r - c.g) / d + 4;
  return [h * 60, s, l];
}

/** The colour at hue `h` (wrapped), saturation and lightness (clamped). */
export function hsl(h: number, s: number, l: number): RGBA {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp01(s);
  const lig = clamp01(l);
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return { r: r + m, g: g + m, b: b + m, a: 1 };
}

/** Relative luminance (WCAG, sRGB linearised), as Compose's Color.luminance(). */
export function luminance(c: RGBA): number {
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** Contrast of white text on `c`. */
export const whiteContrast = (c: RGBA) => 1.05 / (luminance(c) + 0.05);
