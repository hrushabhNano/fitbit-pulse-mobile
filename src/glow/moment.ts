// Which part of the day Today is shaped for (unstrap docs/design/v2/spec.md § 4.1, ported from MomentResolver.kt). It
// reads only what the app already has (a recording, the day's workouts, the night's sleep, the usual bedtime) and works
// out nothing about the body. Pure: the clock and the zone come in as arguments. Instants are epoch milliseconds.

import { localDay, localMinutes } from "@/lib/time";

/** Highest priority first: when moments overlap, the first wins. */
export const MOMENTS = ["during", "after", "window", "waking", "night", "evening", "midday"] as const;
export type Moment = (typeof MOMENTS)[number];

/** How long after waking the morning lasts, with Recovery as the hero; Energy leads after it. */
export const WAKING_MS = 3 * 3600_000;
/** How long a finished workout stays the moment. */
export const AFTER_MS = 2 * 3600_000;
/** The workout window runs this long either side of the usual workout time. */
export const WINDOW_MIN = 45;
/** Night starts this long before the usual bedtime; evening three hours before it, or at 18:00 if that's earlier. */
export const NIGHT_LEAD_MIN = 45;
export const EVENING_MIN = 180;
export const EVENING_LATEST_MIN = 18 * 60;
/** Night ends here, the morning after. */
export const NIGHT_ENDS_MIN = 4 * 60;
/** The morning starts here when no main sleep ended today. */
export const WAKE_FALLBACK_MIN = 5 * 60;
/** Bedtime when none is known yet. */
export const BEDTIME_FALLBACK_MIN = 22 * 60;
/** The usual workout time looks back this far and needs this many workouts. */
export const USUAL_WORKOUT_DAYS = 28;
export const USUAL_WORKOUT_MIN = 3;

export type MomentInput = {
  now: number;
  timeZone: string;
  /** The day on screen, `YYYY-MM-DD`. */
  day: string;
  /** A workout is recording on the phone. */
  recording: boolean;
  /** When the latest workout ended. */
  lastWorkoutEnd: number | null;
  /** When today's main sleep ended. */
  sleepEnd: number | null;
  /** The usual bedtime, minutes after midnight (22:30 is 1350, 00:30 is 30). */
  usualBedtimeMin: number | null;
  /** Start of every workout, for the usual workout time. */
  workoutStarts: number[];
};

/** Minutes after noon, so evening and night read on one clock that runs past midnight to 04:00. */
const afterNoon = (m: number) => (((m - 720) % 1440) + 1440) % 1440;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * The usual workout time (minutes after midnight): the median start of the last 28 days' workouts on this weekday when
 * there are 3 or more, else across all days when there are 3 or more; null until then.
 */
export function usualWorkoutMin(starts: number[], now: number, timeZone: string): number | null {
  const recent = starts.filter((t) => t <= now && now - t <= USUAL_WORKOUT_DAYS * 86_400_000);
  if (recent.length < USUAL_WORKOUT_MIN) return null;
  const weekday = (t: number) => new Date(`${localDay(t / 1000, timeZone)}T00:00:00Z`).getUTCDay();
  const today = weekday(now);
  const same = recent.filter((t) => weekday(t) === today);
  const pick = same.length >= USUAL_WORKOUT_MIN ? same : recent;
  return Math.round(median(pick.map((t) => localMinutes(t / 1000, timeZone))));
}

/** The moment at `now` for the day on screen. A past day is always waking: it shows how that day began. */
export function resolveMoment(input: MomentInput): Moment {
  const { now, timeZone, day } = input;
  if (day < localDay(now / 1000, timeZone)) return "waking";
  if (input.recording) return "during";
  if (input.lastWorkoutEnd !== null && now >= input.lastWorkoutEnd && now - input.lastWorkoutEnd < AFTER_MS) return "after";
  const clock = localMinutes(now / 1000, timeZone);
  const usual = usualWorkoutMin(input.workoutStarts, now, timeZone);
  if (usual !== null) {
    const d = Math.abs(clock - usual);
    if (Math.min(d, 1440 - d) <= WINDOW_MIN) return "window";
  }
  const wake = input.sleepEnd ?? now - (clock - WAKE_FALLBACK_MIN) * 60_000;
  if (now >= wake && now - wake < WAKING_MS) return "waking";
  const bed = afterNoon(input.usualBedtimeMin ?? BEDTIME_FALLBACK_MIN);
  const nightEnds = afterNoon(NIGHT_ENDS_MIN);
  const nightStarts = Math.max(0, bed - NIGHT_LEAD_MIN);
  const m = afterNoon(clock);
  if (m >= nightStarts && m < nightEnds) return "night";
  const eveningStarts = Math.max(0, Math.min(bed - EVENING_MIN, afterNoon(EVENING_LATEST_MIN)));
  if (m >= eveningStarts && m < Math.min(nightStarts, nightEnds)) return "evening";
  return "midday";
}

/** Each moment's look (spec 4.2): which ink lights the hero, from where, how strong, and the screen's mood. */
export const MOMENT_LOOK: Record<Moment, { mood: "day" | "evening" | "night"; angle: number | null; rim: number }> = {
  waking: { mood: "day", angle: 225, rim: 1 },
  midday: { mood: "day", angle: 270, rim: 1 },
  window: { mood: "day", angle: 45, rim: 1.2 },
  during: { mood: "day", angle: 270, rim: 1 },
  after: { mood: "day", angle: 270, rim: 0.8 },
  evening: { mood: "evening", angle: 315, rim: 1 },
  night: { mood: "night", angle: 270, rim: 1 },
};
