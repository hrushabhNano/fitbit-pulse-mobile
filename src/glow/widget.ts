// What the glow home screen widgets show (modules/pulse-widgets, GlowWidgets.kt): the four of unstrap's widget set that
// fit Pulse (Today, Recovery, Sleep, Steps), worked out here from the same view models the tabs read, so the native side
// only draws. Pure apart from i18n; the result rides in the widget snapshot as `glow`.

import { i18n } from "@/i18n/config";
import { durationWords } from "@/lib/format";
import { reasonCopy } from "@/lib/reasons";
import type { GoalRow } from "@/queries/goals";
import type { HomeVM, RecoveryVM, SleepVM } from "@/queries/types";
import { changeSinceYesterday, grouped, inSentence, lastDays, leadingContributor, signed } from "./model";
import { MOMENT_LOOK, type Moment } from "./moment";
import { INK } from "./tokens";

export type GlowWidgetData = {
  moment: Moment;
  /** The Today widget's hero: its title, sentence, ink, light and the one dotted number. */
  hero: { title: string; sentence: string; ink: string; angle: number | null; rim: number; mood: "day" | "evening" | "night"; value: string | null; unit: string; href: string };
  recovery: { title: string; score: string | null; word: string; note: string; sentence: string; week: (number | null)[]; waiting: string | null; href: string };
  sleep: { title: string; score: string | null; word: string; asleep: string | null; asleepShort: string | null; stages: { deep: number; rem: number; light: number; awake: number }; waiting: string | null; href: string };
  steps: { title: string; value: string; goal: string; share: number; met: boolean; word: string; week: (number | null)[]; href: string };
  energy: { title: string; value: string | null; level: number; word: string };
  /** The day's Strain against today's target band, for the Overview. */
  load: { title: string; value: string | null; level: number; target: [number, number] | null; word: string };
  /** Overview tile titles. */
  titles: { overview: string; heartRate: string; stress: string; sync: string };
};

/** The glow namespace by a key worked out at run time (moments, bands, stages). */
const t = (key: string, opts?: Record<string, unknown>) => (i18n.t as unknown as (k: string, o?: Record<string, unknown>) => string)(`glow:${key}`, opts);

export type GlowWidgetInput = {
  moment: Moment;
  home: HomeVM;
  recovery: RecoveryVM;
  sleep: SleepVM;
  steps: GoalRow | null;
  /** Minutes until the usual bedtime, or null. */
  bedtimeIn: number | null;
};

export function buildGlowWidget({ moment, home, recovery, sleep, steps, bedtimeIn }: GlowWidgetInput): GlowWidgetData {
  const score = recovery.recovery.value;
  const band = recovery.band ?? "yellow";
  const change = changeSinceYesterday(recovery.trend.points);
  const top = leadingContributor(recovery.contributors);
  const asleepMin = sleep.hours.value?.asleepMin ?? null;
  const slept = asleepMin !== null ? t("hero.slept", { time: durationWords(asleepMin) }) : null;
  const recoverySentence =
    score === null
      ? t("hero.recovery.waiting")
      : [slept, t(`hero.recovery.${band}`), top ? t(top.way === "down" ? "hero.heldBack" : "hero.lifted", { what: inSentence(top.contributor.label) }) : null].filter(Boolean).join(" ");

  const rows = sleep.stages?.value?.rows ?? [];
  const stage = (s: "deep" | "rem" | "light" | "awake") => Math.round(rows.find((r) => r.stage === s)?.minutes ?? 0);
  const sleepScore = sleep.performance.value;

  const e = home.energyBank.value;
  const strain = home.dials.strain.value;
  const stepCount = steps?.value ?? null;

  const look = MOMENT_LOOK[moment];
  const hero = ((): GlowWidgetData["hero"] => {
    const base = { angle: look.angle, rim: look.rim, mood: look.mood, title: t(`moment.${moment}`) };
    switch (moment) {
      case "waking":
        return { ...base, ink: INK.recovery, sentence: recoverySentence, value: score === null ? null : String(Math.round(score)), unit: t(`word.band.${band}`), href: "pulse://recovery" };
      case "midday":
        return { ...base, ink: INK.energy, sentence: e ? t(`hero.energy.${e.band}`) : t("hero.energy.waiting"), value: e ? String(Math.round(e.current)) : null, unit: t("card.energy"), href: "pulse://" };
      case "window":
        return { ...base, ink: INK.heart, sentence: band === "red" ? t("hero.windowLow") : t("hero.windowLine"), value: null, unit: "", href: "pulse://workout/start" };
      case "during":
        return { ...base, ink: INK.heart, sentence: t("hero.duringLine"), value: null, unit: "", href: "pulse://workout/live" };
      case "after":
        return { ...base, ink: INK.recovery, sentence: t("hero.afterShort"), value: null, unit: "", href: "pulse://strain" };
      case "evening":
      case "night": {
        const parts = [
          stepCount !== null ? t("hero.evening", { steps: grouped(stepCount) }) : null,
          moment === "night" ? t("hero.nightLine") : null,
          bedtimeIn !== null && bedtimeIn > 0 ? t("hero.bedtimeIn", { time: durationWords(bedtimeIn) }) : null,
        ].filter(Boolean);
        return {
          ...base,
          ink: moment === "night" ? INK.sleepDeep : INK.evening,
          sentence: parts.join(" ") || t("hero.nightLine"),
          value: stepCount !== null ? grouped(stepCount) : null,
          unit: t("word.steps"),
          href: "pulse://sleep",
        };
      }
    }
  })();

  return {
    moment,
    hero,
    recovery: {
      title: t("card.recovery"),
      score: score === null ? null : String(Math.round(score)),
      word: t(`word.band.${band}`),
      note: change === null ? "" : change === 0 ? t("word.sameAsYesterday") : t("word.vsYesterday", { change: signed(change) }),
      sentence: recoverySentence,
      week: lastDays(recovery.trend.points, 7).map((v) => (v === null ? null : Math.round(v))),
      waiting: score === null ? reasonCopy(recovery.recovery.reason, recovery.recovery.nightsLeft).short : null,
      href: "pulse://recovery",
    },
    sleep: {
      title: t("card.lastNight"),
      score: sleepScore === null ? null : String(Math.round(sleepScore)),
      word: t("word.sleepScore"),
      asleep: asleepMin === null ? null : t("hero.asleep", { time: durationWords(asleepMin) }).replace(/\.$/, ""),
      asleepShort: asleepMin === null ? null : `${Math.floor(asleepMin / 60)} h ${String(Math.round(asleepMin) % 60).padStart(2, "0")}`,
      stages: { deep: stage("deep"), rem: stage("rem"), light: stage("light"), awake: stage("awake") },
      waiting: sleepScore === null ? reasonCopy(sleep.performance.reason, sleep.performance.nightsLeft).short : null,
      href: "pulse://sleep",
    },
    steps: {
      title: t("card.steps"),
      value: grouped(stepCount ?? 0),
      goal: steps ? grouped(steps.target) : "",
      share: steps ? Math.min(1, Math.max(0, steps.progress)) : 0,
      met: !!steps?.done,
      word: steps?.done ? t("word.goalMet") : steps ? t("card.goalShare", { value: Math.round(Math.min(1, steps.progress) * 100) }) : "",
      week: steps ? steps.history.map((h) => (h.progress === null ? null : Math.min(1, Math.max(0, h.progress)))) : [],
      href: "pulse://strain",
    },
    energy: {
      title: t("card.energy"),
      value: e ? String(Math.round(e.current)) : null,
      level: e ? Math.min(1, Math.max(0, e.current / 100)) : 0,
      word: e ? t("word.atWaking", { value: Math.round(e.startLevel) }) : t("hero.energy.waiting"),
    },
    load: {
      title: t("card.load"),
      value: strain === null ? null : `${Math.round(strain)}%`,
      level: strain === null ? 0 : Math.min(1, Math.max(0, strain / 100)),
      target: home.dials.strainTarget,
      word:
        strain === null || !home.dials.strainTarget
          ? ""
          : strain > home.dials.strainTarget[1]
            ? t("word.aboveUsual")
            : strain < home.dials.strainTarget[0]
              ? t("card.loadTarget", { low: Math.round(home.dials.strainTarget[0]), high: Math.round(home.dials.strainTarget[1]) })
              : t("word.usual"),
    },
    titles: { overview: t("widget.overviewTitle"), heartRate: t("card.heartRate"), stress: t("card.stress"), sync: t("header.sync.ok") },
  };
}
