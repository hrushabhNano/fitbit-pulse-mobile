// The light of a glow card as plain numbers (unstrap docs/design/v2/spec.md § 2.1 and 2.5, ported from GlowStyle.kt and
// LightSpec.kt): where each gradient runs, its colours and stops, the rim shadows, the dark core and the hairline.
// Nothing here draws; GlowCard paints it with Skia. Sizes are in dp.

import { ANGLE, MOOD, type Mood } from "./tokens";
import { BLACK, css, hex, hsl, hslOf, lerp, luminance, TRANSPARENT, withAlpha, WHITE_RGBA, type RGBA } from "./color";

export type CoreShape = "rounded" | "radial";

/** A glow card's look, all derived from one colour (spec 2.5, Glow card). */
export type GlowStyle = {
  color: string;
  radius: number;
  coreShape: CoreShape;
  coreX: number;
  coreY: number;
  coreWidth: number;
  coreHeight: number;
  coreBlur: number;
  /** HSL lightness of the core. */
  coreLightness: number;
  /** Hue turn of the second tone band round the core. */
  toneShift: number;
  toneWidth: number;
  /** The rim light's reach. */
  glowSize: number;
  /** The rim at the lit edge, 0..1 (1.2 before a workout, 0.8 after one). */
  rim: number;
  /** Film grain, 0..1. */
  grain: number;
  /** Degrees counterclockwise from the right edge; null for light all the way round. */
  lightAngle: number | null;
  /** How high the light reaches for a level (Energy, Steps), 0..1; null for a card that isn't a level. */
  lightLevel: number | null;
  bodyLightness: number;
  bodyHueShift: number;
  coreHueShift: number;
  /** The second glow on a screen, L3. */
  second: boolean;
  mood: Mood;
};

const BASE: GlowStyle = {
  color: "#D65AA0",
  radius: 28,
  coreShape: "rounded",
  coreX: 0.5,
  coreY: 0.64,
  coreWidth: 0.74,
  coreHeight: 0.6,
  coreBlur: 22,
  coreLightness: 0.09,
  toneShift: -40,
  toneWidth: 24,
  glowSize: 30,
  rim: 1,
  grain: 0.06,
  lightAngle: ANGLE.above,
  lightLevel: null,
  bodyLightness: 0.32,
  bodyHueShift: -4,
  coreHueShift: 0,
  second: false,
  mood: "day",
};

/** The hero's recipe, L4: the rim at full from the side the moment places, the dark core opposite it. */
export function heroStyle(color: string, lightAngle: number | null, rim = 1): GlowStyle {
  return {
    ...BASE,
    color,
    lightAngle,
    coreShape: "radial",
    coreX: 0.5,
    coreY: 0.6,
    coreWidth: 0.95,
    coreHeight: 0.75,
    coreBlur: 30,
    toneWidth: 16,
    toneShift: -10,
    rim,
  };
}

/** The hero recipe for lime (Steps): lit from the upper right, its body turned toward green so it never reads khaki. */
export function limeHeroStyle(color: string): GlowStyle {
  return { ...heroStyle(color, ANGLE.upperRight), bodyHueShift: 30, toneShift: 30, coreHueShift: 30 };
}

/** The second glow on a screen, L3. */
export const secondStyle = (color: string, lightAngle: number | null = ANGLE.lowerLeft): GlowStyle => ({ ...heroStyle(color, lightAngle), second: true });

/**
 * A level glow (Energy's Ember recipe in any ink): lit from below to `level` (0..1) with a near-black core above it, or
 * across from the left with `across`.
 */
export function levelStyle(color: string, level: number, across = false): GlowStyle {
  return {
    ...BASE,
    color,
    coreShape: "radial",
    coreX: 0.5,
    coreY: 0.05,
    coreWidth: 1.4,
    coreHeight: 1.2,
    coreBlur: 32,
    coreLightness: 0.02,
    toneShift: -15,
    toneWidth: 26,
    glowSize: 34,
    lightAngle: across ? ANGLE.left : ANGLE.below,
    lightLevel: Math.min(1, Math.max(0, level)),
  };
}

/** The lowest light level drawn: an empty card still glows faintly. */
export const MIN_LIGHT_LEVEL = 0.12;
const LEVEL_STEP = 22;
const LEVEL_DARK_PAST = 0.11;
const LEVEL_FILL_REACH = 0.85;
const HERO_REACH = 0.45;
const SECOND_RIM = 0.7;
const SECOND_FILL = 0.7;
const SECOND_REACH = 0.28;
const CORE_PUSH = 0.38;
const MID_MAX_LUMINANCE = 0.18;
const TONE_MAX_LUMINANCE = 0.14;
const LEVEL_BODY_LIGHTNESS = 0.16;

const glowLevel = (level: number | null) => (level === null ? null : Number.isNaN(level) ? MIN_LIGHT_LEVEL : Math.min(1, Math.max(MIN_LIGHT_LEVEL, level)));

/** A unit vector from the card's centre toward the light at `angle`, in screen coordinates (y down). */
export function lightVector(angle: number): [number, number] {
  const r = (angle / 180) * Math.PI;
  const clean = (v: number) => (Math.abs(v) < 1e-6 ? 0 : v);
  return [clean(Math.cos(r)), clean(-Math.sin(r))];
}

type CoreBox = { x: number; y: number; width: number; height: number };
type FillStop = { at: number; light: number };

export type Light = {
  angle: number | null;
  rim: number;
  fillStops: FillStop[];
  core: CoreBox;
  tone: boolean;
  level: number | null;
  fromAbove: boolean;
  across: boolean;
  brightness: number;
};

/** How a style is lit once its angle, level, second and mood are applied. */
export function lightOf(style: GlowStyle): Light {
  const mood = MOOD[style.mood];
  const own = style.lightAngle;
  const angle = mood.belowOnly && own !== null ? ANGLE.below : own;
  const level = glowLevel(style.lightLevel);
  const fromAbove = angle !== null && lightVector(angle)[1] < 0;
  const across = level !== null && angle === ANGLE.left;
  let core: CoreBox;
  if (level !== null) {
    const edge = Math.max(0, 1 - level);
    core = across ? { x: 1 - edge / 2, y: 0.5, width: edge, height: 1 } : { x: 0.5, y: fromAbove ? 1 - edge / 2 : edge / 2, width: 1, height: edge };
  } else if (angle !== null) {
    const [vx, vy] = lightVector(angle);
    core = { x: 0.5 - CORE_PUSH * vx, y: 0.5 - CORE_PUSH * vy, width: style.coreWidth, height: style.coreHeight };
  } else core = { x: style.coreX, y: style.coreY, width: style.coreWidth, height: style.coreHeight };
  const l3 = style.second && level === null;
  const fillStops =
    level !== null
      ? [
          { at: 0, light: 1 },
          { at: 0.35 * level, light: 0.55 },
          { at: LEVEL_FILL_REACH * level, light: 0 },
        ]
      : l3
        ? [
            { at: 0, light: SECOND_FILL },
            { at: SECOND_REACH, light: 0 },
          ]
        : [
            { at: 0, light: 1 },
            { at: 0.16, light: 0.5 },
            { at: HERO_REACH, light: 0 },
          ];
  return {
    angle,
    rim: style.rim * (l3 ? SECOND_RIM : 1),
    fillStops,
    core,
    tone: mood.tone,
    level,
    fromAbove,
    across,
    // A level's light is the value, so a softer mood doesn't dim it.
    brightness: level !== null ? 1 : mood.glow,
  };
}

export type Palette = { light: RGBA; mid: RGBA; tone: RGBA; core: RGBA };

/** The colour at lightness `l`, or darker until its luminance is at most `max`. */
function capped(h: number, s: number, l: number, max: number): RGBA {
  for (let x = l; x > 0.08; x -= 0.01) {
    const c = hsl(h, s, x);
    if (luminance(c) <= max) return c;
  }
  return hsl(h, s, 0.08);
}

/** The handful of colours a style is drawn with, all from its main colour. */
export function paletteOf(style: GlowStyle): Palette {
  const base = hex(style.color);
  const [h, s0, l] = hslOf(base);
  const s = s0 < 0.12 ? s0 : Math.min(0.9, Math.max(0.35, s0));
  const level = style.lightLevel !== null;
  const rim = level ? base : hsl(h, s * 0.9, Math.min(0.6, Math.max(0.45, l + 0.03)));
  const body = level ? hsl(h, s0, LEVEL_BODY_LIGHTNESS) : capped(h + style.bodyHueShift, s * 0.85, style.bodyLightness, MID_MAX_LUMINANCE);
  const band = capped(h + style.toneShift, s * 0.8, style.bodyLightness - 0.04, TONE_MAX_LUMINANCE);
  const core = hsl(h + style.coreHueShift, 0.7, style.coreLightness);
  const k = Math.min(1, Math.max(0, lightOf(style).brightness));
  const dim = (c: RGBA) => (k < 1 ? lerp(BLACK, c, k) : c);
  return { light: dim(rim), mid: dim(body), tone: dim(band), core };
}

export type Gradient = { x0: number; y0: number; x1: number; y1: number; colors: string[]; positions: number[] };
export type InsetShadow = { dx: number; dy: number; blur: number; spread: number; color: string };
export type Core =
  | { kind: "level"; gradient: Gradient }
  | {
      kind: "shapes";
      shape: CoreShape;
      core: { x: number; y: number; width: number; height: number };
      coreRadius: number;
      coreColor: string;
      tone: { x: number; y: number; width: number; height: number } | null;
      toneRadius: number;
      toneColor: string;
      /** Gaussian standard deviation. */
      blur: number;
    };

/** Everything a glow card of `width` by `height` dp is drawn with. */
export type GlowPaint = {
  width: number;
  height: number;
  radius: number;
  /** The body colour: the fallback before anything else draws. */
  mid: string;
  fill: Gradient;
  rimClip: { x: number; y: number; width: number; height: number } | null;
  rims: InsetShadow[];
  core: Core;
  coreMargin: number;
  gloss: Gradient;
  hairline: string;
  grain: number;
};

/** Where a level card's light fades into the dark, dp from the unlit side of a card `length` long. */
function levelFade(level: number, length: number): [number, number] {
  const clear = (1 - LEVEL_FILL_REACH * level) * length;
  const dark = Math.min((1 - level - LEVEL_DARK_PAST) * length, clear - LEVEL_STEP);
  return [dark, clear];
}

const grad = (x0: number, y0: number, x1: number, y1: number, stops: [number, RGBA][]): Gradient => ({
  x0,
  y0,
  x1,
  y1,
  positions: stops.map(([p]) => Math.min(1, Math.max(0, p))),
  colors: stops.map(([, c]) => css(c)),
});

/** How `style` is drawn on a card `w` by `h` dp. */
export function glowPaint(style: GlowStyle, w: number, h: number): GlowPaint {
  const p = paletteOf(style);
  const light = lightOf(style);
  const r = style.radius;

  // Rims: an inset shadow leaning toward the lit edge; on a level card only over the lit part.
  let rimClip: GlowPaint["rimClip"] = null;
  const rims: InsetShadow[] = [];
  if (light.rim > 0) {
    if (light.level !== null) {
      const dark = levelFade(light.level, light.across ? w : h)[0];
      rimClip = light.across
        ? { x: 0, y: 0, width: w - dark, height: h }
        : light.fromAbove
          ? { x: 0, y: 0, width: w, height: h - dark }
          : { x: 0, y: dark, width: w, height: h - dark };
    }
    const k = light.rim;
    const g = style.glowSize * Math.max(1, k);
    if (light.angle !== null) {
      const [vx, vy] = lightVector(light.angle);
      rims.push({ dx: -vx * g * 0.6, dy: -vy * g * 0.6, blur: g * 1.2, spread: -g * 0.5, color: css(withAlpha(p.light, Math.min(1, k))) });
    } else rims.push({ dx: 0, dy: 0, blur: g, spread: g * 0.1, color: css(withAlpha(p.light, Math.min(1, 0.6 * k))) });
  }

  const margin = Math.max(w, h) * 0.08;
  let core: Core;
  if (light.level !== null) {
    // The body holds up to near the value, then the core colour fades in across it on a smoothstep.
    const [dark, clear] = levelFade(light.level, light.across ? w : h);
    const [y0, y1] = light.across ? [w + margin, -margin] : light.fromAbove ? [h + margin, -margin] : [-margin, h + margin];
    const span = Math.abs(y1 - y0);
    const at = (fromUnlit: number) => Math.min(1, Math.max(0, (fromUnlit + margin) / span));
    const stops: [number, RGBA][] = [[0, p.core]];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const fade = t * t * (3 - 2 * t);
      stops.push([at(dark + (clear - dark) * t), withAlpha(p.core, 1 - fade)]);
    }
    stops.push([1, TRANSPARENT]);
    // Gradient positions must not go backwards.
    for (let i = 1; i < stops.length; i++) if (stops[i][0] < stops[i - 1][0]) stops[i][0] = stops[i - 1][0];
    core = { kind: "level", gradient: light.across ? grad(y0, 0, y1, 0, stops) : grad(0, y0, 0, y1, stops) };
  } else {
    const cw = w * light.core.width;
    const ch = h * light.core.height;
    const left = w * light.core.x - cw / 2;
    const top = h * light.core.y - ch / 2;
    const coreRadius = Math.max(0, r - 8);
    const band = light.tone ? style.toneWidth : 0;
    core = {
      kind: "shapes",
      shape: style.coreShape,
      core: { x: left, y: top, width: cw, height: ch },
      coreRadius,
      coreColor: css(p.core),
      tone: band > 0 ? { x: left - band, y: top - band, width: cw + band * 2, height: ch + band * 2 } : null,
      toneRadius: coreRadius + band,
      toneColor: css(p.tone),
      blur: style.coreBlur,
    };
  }

  // The base fill: the light colour at the lit edge melting into the body along the light's angle.
  let fill: Gradient;
  if (light.angle === null)
    fill = grad(0, 0, 0, h, [
      [0, p.mid],
      [1, p.mid],
    ]);
  else {
    const [vx, vy] = lightVector(light.angle);
    const half = (Math.abs(w * vx) + Math.abs(h * vy)) / 2;
    const stops: [number, RGBA][] = [...light.fillStops.map((s) => [s.at, lerp(p.mid, p.light, s.light)] as [number, RGBA]), [1, p.mid]];
    fill = grad(w / 2 + vx * half, h / 2 + vy * half, w / 2 - vx * half, h / 2 - vy * half, stops);
  }

  // A glossy hairline along the lit edge, fading out along the sides.
  const glossStops = (reverse: boolean): [number, RGBA][] => {
    const s: [number, RGBA][] = [
      [0, withAlpha(WHITE_RGBA, 0.35)],
      [0.25, withAlpha(WHITE_RGBA, 0.08)],
      [1, withAlpha(WHITE_RGBA, 0.04)],
    ];
    return reverse
      ? [
          [0, withAlpha(WHITE_RGBA, 0.04)],
          [0.75, withAlpha(WHITE_RGBA, 0.08)],
          [1, withAlpha(WHITE_RGBA, 0.35)],
        ]
      : s;
  };
  const gloss = light.across
    ? grad(0, 0, w, 0, glossStops(false))
    : light.level !== null && !light.fromAbove
      ? grad(0, 0, 0, h, glossStops(true))
      : grad(0, 0, 0, h, glossStops(false));

  return {
    width: w,
    height: h,
    radius: r,
    mid: css(p.mid),
    fill,
    rimClip,
    rims,
    core,
    coreMargin: margin,
    gloss,
    hairline: "rgba(255,255,255,0.12)",
    grain: style.grain > 0 && light.level === null ? Math.min(1, style.grain) : 0,
  };
}
