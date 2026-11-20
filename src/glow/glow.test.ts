import { describe, expect, it } from "vitest";
import { fromWall } from "@/lib/time";
import { hex, hsl, hslOf, luminance, whiteContrast } from "./color";
import { DOT_GAP, dotColumns, dotFitScale, dotLayout, dotTextWidth, glyph, hasGlyph } from "./dotFont";
import { glowPaint, heroStyle, levelStyle, lightOf, paletteOf, secondStyle } from "./light";
import { resolveMoment, usualWorkoutMin, type MomentInput } from "./moment";
import { INK } from "./tokens";
import { against, changeSinceYesterday, contributorShare, inSentence, leadingContributor, signed } from "./model";
import type { Contributor } from "@/queries/types";

describe("dot font", () => {
  it("draws every digit as 5 by 7", () => {
    for (const d of "0123456789") {
      expect(glyph(d)).toHaveLength(7);
      expect(glyph(d).every((row) => row.length === 5)).toBe(true);
    }
  });

  it("falls back to a space for unknown characters", () => {
    expect(hasGlyph("x")).toBe(false);
    expect(glyph("x")).toEqual(glyph(" "));
  });

  it("puts one empty column between glyphs", () => {
    expect(dotColumns("77")).toBe(11);
    expect(dotColumns("6:01")).toBe(5 + 1 + 1 + 1 + 5 + 1 + 5);
  });

  it("lays out the dots on a pitch of the dot plus its gap", () => {
    const l = dotLayout("1", 4);
    const pitch = 4 * (1 + DOT_GAP);
    expect(l.height).toBeCloseTo(pitch * 7 - 4 * DOT_GAP);
    expect(l.width).toBeCloseTo(dotTextWidth("1", 4));
    // The 1's top dot sits in its third column.
    expect(l.centers[0]).toEqual({ x: 2 * pitch + 2, y: 2 });
    // 7 + 1 + 1 + 1 + 1 + 1 + 3 dots.
    expect(l.centers).toHaveLength(10);
  });

  it("shrinks to fit and never grows", () => {
    expect(dotFitScale("77", 4.5, 1000)).toBe(1);
    expect(dotFitScale("12,345", 4.5, dotTextWidth("12,345", 4.5) / 2)).toBeCloseTo(0.5);
  });
});

describe("colour", () => {
  it("round-trips HSL", () => {
    const c = hex(INK.recovery);
    const [h, s, l] = hslOf(c);
    const back = hsl(h, s, l);
    expect(back.r).toBeCloseTo(c.r);
    expect(back.g).toBeCloseTo(c.g);
    expect(back.b).toBeCloseTo(c.b);
  });

  it("reads Compose's ARGB hex", () => {
    expect(hex("#80FF0000")).toEqual({ a: 128 / 255, r: 1, g: 0, b: 0 });
  });
});

describe("glow light", () => {
  it("keeps white text readable on every ink's body (spec 2.1)", () => {
    for (const ink of Object.values(INK)) {
      const p = paletteOf(heroStyle(ink, 225));
      expect(luminance(p.mid)).toBeLessThanOrEqual(0.18 + 1e-9);
      expect(whiteContrast(p.mid)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("puts the core opposite the light", () => {
    const below = lightOf(heroStyle(INK.recovery, 270));
    expect(below.core.y).toBeLessThan(0.5);
    const lowerLeft = lightOf(heroStyle(INK.recovery, 225));
    expect(lowerLeft.core.x).toBeGreaterThan(0.5);
    expect(lowerLeft.core.y).toBeLessThan(0.5);
  });

  it("brings every light from below at night", () => {
    expect(lightOf({ ...heroStyle(INK.sleepDeep, 225), mood: "night" }).angle).toBe(270);
  });

  it("dims the hero in the evening but never a level", () => {
    expect(lightOf({ ...heroStyle(INK.evening, 315), mood: "evening" }).brightness).toBe(0.8);
    expect(lightOf({ ...levelStyle(INK.energy, 0.4), mood: "evening" }).brightness).toBe(1);
  });

  it("draws the second glow softer than the hero", () => {
    expect(lightOf(secondStyle(INK.energy)).rim).toBeCloseTo(0.7);
    expect(lightOf(heroStyle(INK.energy, 225)).rim).toBe(1);
  });

  it("darkens a level card above its value", () => {
    const paint = glowPaint(levelStyle(INK.energy, 0.3), 170, 340);
    expect(paint.core.kind).toBe("level");
    // The lit part (bottom) is clipped for the rim.
    expect(paint.rimClip?.y).toBeGreaterThan(0);
    if (paint.core.kind === "level") {
      const ps = paint.core.gradient.positions;
      for (let i = 1; i < ps.length; i++) expect(ps[i]).toBeGreaterThanOrEqual(ps[i - 1]);
    }
    expect(paint.grain).toBe(0);
  });

  it("fills a hero from its lit edge to the body by 45%", () => {
    const paint = glowPaint(heroStyle(INK.recovery, 270), 360, 300);
    expect(paint.fill.positions).toEqual([0, 0.16, 0.45, 1]);
    expect(paint.fill.colors[2]).toBe(paint.fill.colors[3]);
    expect(paint.core.kind).toBe("shapes");
  });
});

describe("moments", () => {
  const tz = "Asia/Kolkata";
  const at = (civil: string) => fromWall(civil, tz) * 1000;
  const base: Omit<MomentInput, "now"> = {
    timeZone: tz,
    day: "2026-11-20",
    recording: false,
    lastWorkoutEnd: null,
    sleepEnd: at("2026-11-20T06:30"),
    usualBedtimeMin: 22 * 60 + 30,
    workoutStarts: [],
  };
  const m = (civil: string, extra: Partial<MomentInput> = {}) => resolveMoment({ ...base, now: at(civil), ...extra });

  it("runs through the day", () => {
    expect(m("2026-11-20T07:00")).toBe("waking");
    expect(m("2026-11-20T09:31")).toBe("midday");
    expect(m("2026-11-20T18:10")).toBe("evening");
    expect(m("2026-11-20T21:50")).toBe("night");
    expect(m("2026-11-21T01:30", { day: "2026-11-21", sleepEnd: null })).toBe("night");
  });

  it("puts a recording and a just-finished workout first", () => {
    expect(m("2026-11-20T07:00", { recording: true })).toBe("during");
    expect(m("2026-11-20T19:00", { lastWorkoutEnd: at("2026-11-20T18:00") })).toBe("after");
    expect(m("2026-11-20T21:00", { lastWorkoutEnd: at("2026-11-20T18:00") })).toBe("evening");
  });

  it("shows a past day as its morning", () => {
    expect(m("2026-11-21T20:00", { day: "2026-11-20" })).toBe("waking");
  });

  it("opens the workout window around the usual time once there are three", () => {
    const starts = ["2026-11-17T17:00", "2026-11-18T17:20", "2026-11-19T16:50"].map(at);
    expect(usualWorkoutMin(starts.slice(0, 2), at("2026-11-20T12:00"), tz)).toBeNull();
    expect(usualWorkoutMin(starts, at("2026-11-20T12:00"), tz)).toBe(17 * 60);
    expect(m("2026-11-20T16:30", { workoutStarts: starts })).toBe("window");
    expect(m("2026-11-20T16:00", { workoutStarts: starts })).toBe("midday");
  });

  it("starts the morning at 05:00 without a night", () => {
    expect(m("2026-11-20T06:00", { sleepEnd: null })).toBe("waking");
    expect(m("2026-11-20T08:30", { sleepEnd: null })).toBe("midday");
  });
});

describe("model", () => {
  const c = (key: Contributor["key"], value: number, points: number | null, direction: Contributor["direction"] = "up"): Contributor => ({
    key,
    label: key,
    unit: "",
    metric: { value, reason: null, provisional: false },
    baseline: { mean: 50, sd: 10 },
    points,
    direction,
  });

  it("reads a value against the normal band", () => {
    expect(against(55, { mean: 50, sd: 10 })).toBe("usual");
    expect(against(65, { mean: 50, sd: 10 })).toBe("above");
    expect(against(30, { mean: 50, sd: 10 })).toBe("below");
    expect(against(30, null)).toBeNull();
  });

  it("fills a bar further the better the value is for you", () => {
    expect(contributorShare(c("hrv", 50, 0))).toBe(0.5);
    expect(contributorShare(c("hrv", 70, 0))).toBe(1);
    expect(contributorShare(c("rhr", 70, 0, "down"))).toBe(0);
  });

  it("names what held Recovery back", () => {
    const top = leadingContributor([c("hrv", 40, -6), c("sleep", 60, 3), c("rhr", 50, 0.5)]);
    expect(top?.contributor.key).toBe("hrv");
    expect(top?.way).toBe("down");
    expect(leadingContributor([c("hrv", 40, 0.2)])).toBeNull();
  });

  it("puts a metric's name inside a sentence", () => {
    expect(inSentence("Resting heart rate")).toBe("resting heart rate");
    expect(inSentence("HRV")).toBe("HRV");
  });

  it("signs a change with a real minus", () => {
    expect(signed(3)).toBe("+3");
    expect(signed(-2)).toBe("−2");
    expect(
      changeSinceYesterday([
        { day: "a", value: 70.4 },
        { day: "b", value: 66.6 },
      ]),
    ).toBe(-3);
  });
});
