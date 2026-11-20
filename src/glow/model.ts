// Pure helpers that turn the view models into what the glow cards say: against your normal, the change since
// yesterday, the contributor that held Recovery back. No React Native, so the tests run in Node.

import type { Contributor, DayPoint, GoodDirection } from "@/queries/types";

/** How a value sits against your normal (mean ± 1 SD): usual inside it, else above or below. */
export type Against = "usual" | "above" | "below";

export function against(value: number | null, baseline: { mean: number; sd: number } | null | undefined): Against | null {
  if (value === null || !baseline || !(baseline.sd > 0)) return null;
  const z = (value - baseline.mean) / baseline.sd;
  return z > 1 ? "above" : z < -1 ? "below" : "usual";
}

/**
 * A contributor bar's fill, 0..1: half at your normal's mean, toward full the better it is for you (the direction says
 * which way is good), clamped two SDs out.
 */
export function contributorShare(c: Pick<Contributor, "metric" | "baseline" | "direction">): number | null {
  const v = c.metric.value;
  if (v === null || !c.baseline || !(c.baseline.sd > 0)) return null;
  const z = (v - c.baseline.mean) / c.baseline.sd;
  const good = goodSign(c.direction) * z;
  return Math.min(1, Math.max(0, 0.5 + good / 4));
}

/** +1 when up is good, -1 when down is, 0 for neither. */
export const goodSign = (d: GoodDirection) => (d === "up" ? 1 : d === "down" ? -1 : 0);

/** The contributor that moved Recovery the most, down (held back) or up (lifted), by its points. */
export function leadingContributor(cs: Contributor[]): { contributor: Contributor; way: "down" | "up" } | null {
  const scored = cs.filter((c) => c.points !== null && Math.abs(c.points) >= 1);
  if (!scored.length) return null;
  const top = scored.reduce((a, b) => (Math.abs(b.points!) > Math.abs(a.points!) ? b : a));
  return { contributor: top, way: top.points! < 0 ? "down" : "up" };
}

/** The last `n` days' values, oldest first, null for a missing day. */
export const lastDays = (points: DayPoint[], n: number) => points.slice(-n).map((p) => p.value);

/** Today's value against yesterday's, or null when either is missing. */
export function changeSinceYesterday(points: DayPoint[]): number | null {
  if (points.length < 2) return null;
  const a = points[points.length - 2].value;
  const b = points[points.length - 1].value;
  return a === null || b === null ? null : Math.round(b) - Math.round(a);
}

/** A signed whole number with a real minus sign (spec 2.3): "+3", "−2". */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

/** A whole number with a thousands separator, as the dot font draws it ("8,432"). */
export const grouped = (n: number) => Math.round(n).toLocaleString("en-US");

/** The median of the positive values, or null. */
export function median(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** A metric's name inside a sentence: "Resting heart rate" becomes "resting heart rate", "HRV" stays. */
export const inSentence = (label: string) => (/^[A-Z]{2}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1));
