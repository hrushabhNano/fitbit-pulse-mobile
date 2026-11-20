// The glow cards Today and the tabs share, each in its tier and with its own picture (spec 2.5, 2.7). They read the
// existing view models (src/queries) unchanged; a card with no data shows its reason, never a made-up number.

import type { ReactNode } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react-native";
import { durationWords } from "@/lib/format";
import { reasonCopy } from "@/lib/reasons";
import { push } from "@/ui/navigate";
import { Press } from "@/ui/Press";
import type { ChartDayVM } from "@/queries/chart";
import type { GoalRow } from "@/queries/goals";
import type { EnergyBankVM, HomeVM, Metric, RecoveryVM, SleepVM } from "@/queries/types";
import { DotText, HeroValue } from "./DotText";
import { GlowCard } from "./GlowCard";
import { heroStyle, levelStyle, secondStyle, type GlowStyle } from "./light";
import { changeSinceYesterday, grouped, inSentence, lastDays, leadingContributor, signed } from "./model";
import { CardTitle, GText, OutlineTag, PictureCard, SMALL, Strip, Tag } from "./Parts";
import { DayLine, DayStrip, LevelBar, StageBar, TrendDots, WeekRings, type Stage } from "./Pictures";
import { INK, LAYOUT, WHITE } from "./tokens";

/** The waiting line a card shows in place of a number. */
function Waiting({ metric }: { metric: Pick<Metric<unknown>, "reason" | "nightsLeft"> }) {
  return (
    <GText kind="secondary" numberOfLines={2}>
      {reasonCopy(metric.reason, metric.nightsLeft).short}
    </GText>
  );
}

const STAGES: Stage[] = ["deep", "rem", "light", "awake"];

/** The stage totals of a night, deep first. */
export function stageParts(sleep: Pick<SleepVM, "stages">): { stage: Stage; minutes: number }[] {
  const rows = sleep.stages?.value?.rows ?? [];
  return STAGES.map((stage) => ({ stage, minutes: rows.find((r) => r.stage === stage)?.minutes ?? 0 }));
}

// ── Recovery ────────────────────────────────────────────────────────────────

/**
 * The Recovery hero (spec 5.1, Today at waking): a sentence, the score in hero dots in a dark pool with its band word,
 * the change since yesterday, and the last 7 days as trend dots.
 */
export function RecoveryHero({ vm, lead, look, onPress }: { vm: RecoveryVM; lead?: string | null; look?: GlowStyle; onPress?: () => void }) {
  const { t } = useTranslation("glow");
  const score = vm.recovery.value;
  const change = changeSinceYesterday(vm.trend.points);
  const top = leadingContributor(vm.contributors);
  const sentence =
    score === null
      ? t("hero.recovery.waiting")
      : [
          lead,
          t(`hero.recovery.${vm.band ?? "yellow"}`),
          top ? t(top.way === "down" ? "hero.heldBack" : "hero.lifted", { what: inSentence(top.contributor.label) }) : null,
        ]
          .filter(Boolean)
          .join(" ");
  return (
    <GlowCard look={look ?? heroStyle(INK.recovery, 225)} onPress={onPress}>
      <CardTitle
        title={t("card.recovery")}
        opens={!!onPress}
        note={change === null ? undefined : change === 0 ? t("word.sameAsYesterday") : t("word.vsYesterday", { change: signed(change) })}
      />
      <GText kind="sentence" numberOfLines={3} style={{ marginTop: LAYOUT.titleGap }}>
        {sentence}
      </GText>
      <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 20, gap: 18 }}>
        <View style={{ gap: 6 }}>
          {score === null ? <DotText text="--" size="hero" color={WHITE.waiting} /> : <DotText text={String(Math.round(score))} size="hero" />}
          <GText kind="secondary">
            {score === null ? reasonCopy(vm.recovery.reason, vm.recovery.nightsLeft).short : t(`word.band.${vm.band ?? "yellow"}`)}
          </GText>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <TrendDots values={lastDays(vm.trend.points, 7)} />
          <GText kind="caption" style={{ alignSelf: "flex-start" }}>
            {t("word.last7")}
          </GText>
        </View>
      </View>
      {vm.recovery.provisional && (
        <View style={{ marginTop: 12 }}>
          <OutlineTag text={t("word.provisional")} />
        </View>
      )}
    </GlowCard>
  );
}

/** Recovery as a Small (Today at midday): the score in dots and a week of dots. */
export function RecoverySmall({ vm, onPress }: { vm: RecoveryVM; onPress?: () => void }) {
  const { t } = useTranslation("glow");
  const score = vm.recovery.value;
  return (
    <PictureCard style={SMALL} onPress={onPress} ink="recovery">
      <CardTitle title={t("card.recovery")} opens={!!onPress} />
      <View style={{ flex: 1, justifyContent: "center" }}>
        <TrendDots values={lastDays(vm.trend.points, 7)} height={30} color={INK.recovery} />
      </View>
      {score === null ? (
        <Waiting metric={vm.recovery} />
      ) : (
        <HeroValue value={String(Math.round(score))} unit={t(`word.band.${vm.band ?? "yellow"}`)} size="edge" />
      )}
    </PictureCard>
  );
}

// ── Energy ──────────────────────────────────────────────────────────────────

/** The Energy level glow: the light rises to the value (spec 2.1, Levels). `hero` leads Today at midday. */
export function EnergyCard({ energy, variant, onPress }: { energy: Metric<EnergyBankVM>; variant: "hero" | "second" | "tall"; onPress?: () => void }) {
  const { t } = useTranslation("glow");
  const e = energy.value;
  const level = e ? e.current / 100 : 0;
  const look = levelStyle(INK.energy, level, variant === "second");
  const hero = variant === "hero";
  return (
    <GlowCard
      look={look}
      onPress={onPress}
      minHeight={variant === "tall" ? LAYOUT.unit * 2 + LAYOUT.gap : hero ? 260 : 150}
      style={variant === "tall" ? { flex: 1 } : undefined}
    >
      <CardTitle title={t("card.energy")} opens={!!onPress} />
      {hero && (
        <GText kind="sentence" numberOfLines={3} style={{ marginTop: LAYOUT.titleGap }}>
          {e ? t(`hero.energy.${e.band}`) : t("hero.energy.waiting")}
        </GText>
      )}
      <View style={{ flex: 1 }} />
      {e ? (
        <View style={{ gap: 6, marginTop: 16 }}>
          <DotText text={String(Math.round(e.current))} size={hero ? "hero" : "second"} />
          <GText kind="secondary" color="rgba(255,255,255,0.86)">
            {hero
              ? `${t("card.recharged")} +${Math.round(e.charged)}  ·  ${t("card.drained")} −${Math.abs(Math.round(e.drained))}`
              : t("word.atWaking", { value: Math.round(e.startLevel) })}
          </GText>
        </View>
      ) : (
        <Waiting metric={energy} />
      )}
    </GlowCard>
  );
}

/** Recharged and Drained, the Smalls that break Energy down (plain: unlit, no tag, no caret). */
export function EnergyPart({ energy, kind }: { energy: Metric<EnergyBankVM>; kind: "recharged" | "drained" }) {
  const { t } = useTranslation("glow");
  const e = energy.value;
  const amount = e ? (kind === "recharged" ? Math.round(e.charged) : Math.abs(Math.round(e.drained))) : null;
  return (
    <PictureCard style={{ flex: 1, minHeight: LAYOUT.unit }}>
      <CardTitle title={t(`card.${kind}`)} />
      <View style={{ flex: 1, justifyContent: "center" }}>
        {e && amount !== null && (
          <LevelBar
            value={kind === "recharged" ? e.startLevel : amount}
            max={100}
            color={INK.energy}
            usual={kind === "recharged" ? [Math.max(0, e.startLevel - e.charged), e.startLevel] : null}
          />
        )}
      </View>
      <GText kind="smallValue">{amount === null ? "--" : kind === "recharged" ? `+${amount}` : `−${amount}`}</GText>
      {e && kind === "recharged" && (
        <GText kind="secondary" numberOfLines={1}>
          {t("word.overnight", { from: Math.max(0, Math.round(e.startLevel - e.charged)), to: Math.round(e.startLevel) })}
        </GText>
      )}
    </PictureCard>
  );
}

// ── Sleep ───────────────────────────────────────────────────────────────────

/** Last night as a Wide (Today at waking): the sleep score in dots, time asleep, the stage bar. */
export function LastNightCard({ sleep, size, onPress }: { sleep: SleepVM; size: "wide" | "small"; onPress?: () => void }) {
  const { t } = useTranslation("glow");
  const score = sleep.performance.value;
  const asleep = sleep.hours.value?.asleepMin ?? null;
  const small = size === "small";
  return (
    <PictureCard style={small ? SMALL : { minHeight: LAYOUT.unit }} onPress={onPress} ink="sleepDeep">
      <CardTitle title={t("card.lastNight")} opens={!!onPress} />
      <View style={{ flex: 1, justifyContent: "center", paddingVertical: small ? 0 : 12 }}>
        <StageBar parts={stageParts(sleep)} />
      </View>
      {score === null ? (
        <Waiting metric={sleep.performance} />
      ) : (
        <View style={{ gap: 4 }}>
          <HeroValue value={String(Math.round(score))} unit={small ? undefined : t("word.sleepScore")} size="edge" />
          {asleep !== null && (
            <GText kind="secondary" numberOfLines={1}>
              {durationWords(asleep)} {t("word.asleep")}
            </GText>
          )}
        </View>
      )}
    </PictureCard>
  );
}

/** Last night collapsed to a strip (the evening, the workout window). */
export function LastNightStrip({ sleep, onPress }: { sleep: SleepVM; onPress?: () => void }) {
  const { t } = useTranslation("glow");
  const asleep = sleep.hours.value?.asleepMin ?? null;
  return (
    <Strip onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <GText kind="cardTitle">{t("card.lastNight")}</GText>
        <View style={{ flex: 1 }} />
        {sleep.performance.value !== null && <DotText text={String(Math.round(sleep.performance.value))} size="row" />}
        {asleep !== null && <GText kind="secondary">{durationWords(asleep)}</GText>}
      </View>
    </Strip>
  );
}

// ── Activity ────────────────────────────────────────────────────────────────

/** Steps (Wide or Small): the count in dots, its goal as the title's note, the share as a level bar. */
export function StepsCard({ steps, size, onPress }: { steps: GoalRow | null; size: "wide" | "small"; onPress?: () => void }) {
  const { t } = useTranslation("glow");
  const value = steps?.value ?? null;
  const small = size === "small";
  return (
    <PictureCard style={small ? SMALL : { minHeight: LAYOUT.unit }} onPress={onPress} ink="steps">
      <CardTitle title={t("card.steps")} opens={!!onPress} note={!small && steps ? grouped(steps.target) : undefined} />
      <View style={{ flex: 1, justifyContent: "center", paddingVertical: small ? 0 : 12 }}>
        {steps && <LevelBar value={value ?? 0} max={steps.target} color={INK.steps} />}
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
        <HeroValue value={value === null ? "0" : grouped(value)} unit={small ? undefined : t("word.steps")} size="edge" />
        {steps?.done && <Tag text={t("word.goalMet")} />}
      </View>
    </PictureCard>
  );
}

/** Heart rate as a Small: the day's line, the latest reading in dots. */
export function HeartRateSmall({ hr, onPress }: { hr: ChartDayVM | null; onPress?: () => void }) {
  const { t } = useTranslation("glow");
  const ys = hr?.ys ?? [];
  let latest: number | null = null;
  for (let i = ys.length - 1; i >= 0 && latest === null; i--) latest = ys[i];
  const resting = hr?.refs.resting ?? null;
  return (
    <PictureCard style={SMALL} onPress={onPress} ink="heart">
      <CardTitle title={t("card.heartRate")} opens={!!onPress} />
      <View style={{ flex: 1, justifyContent: "center" }}>
        {hr && (
          <DayLine xs={hr.xs} ys={hr.ys} from={hr.from} to={hr.to} color={INK.heart} band={resting !== null ? [resting - 4, resting + 4] : null} height={44} />
        )}
      </View>
      {latest === null ? <GText kind="secondary">{t("word.noData")}</GText> : <HeroValue value={String(Math.round(latest))} unit={t("word.bpm")} size="edge" />}
    </PictureCard>
  );
}

/** Stress as a Small: the day as one strip, calm to high, the day's level in words. */
export function StressSmall({ stress, level, onPress }: { stress: ChartDayVM | null; level: HomeVM["stress"]; onPress?: () => void }) {
  const { t } = useTranslation("glow");
  const s = level.value;
  return (
    <PictureCard style={SMALL} onPress={onPress} ink="stress">
      <CardTitle title={t("card.stress")} opens={!!onPress} />
      <View style={{ flex: 1, justifyContent: "center" }}>{stress && <DayStrip values={bucket(stress.ys, 24)} color={INK.stress} />}</View>
      {s ? <HeroValue value={String(Math.round(s.value))} unit={t(`word.stressLevel.${s.level}`)} size="edge" /> : <Waiting metric={level} />}
    </PictureCard>
  );
}

/** Averages `ys` into `n` buckets for a strip; an empty bucket is null. */
function bucket(ys: (number | null)[], n: number): (number | null)[] {
  if (!ys.length) return [];
  const size = Math.ceil(ys.length / n);
  return Array.from({ length: n }, (_, i) => {
    const part = ys.slice(i * size, (i + 1) * size).filter((v): v is number => v !== null);
    return part.length ? part.reduce((a, b) => a + b, 0) / part.length : null;
  });
}

/** Load (the day's Strain) as a Small: a level fill over today's target band. */
export function LoadSmall({ strain, target, onPress }: { strain: Metric<number>; target: [number, number] | null; onPress?: () => void }) {
  const { t } = useTranslation("glow");
  const v = strain.value;
  const max = Math.max(100, v ?? 0, target?.[1] ?? 0);
  const word = v !== null && target ? (v > target[1] ? t("word.aboveUsual") : v < target[0] ? null : t("word.usual")) : null;
  return (
    <PictureCard style={SMALL} onPress={onPress} ink="load" rim={v !== null && target && v > target[1] ? { x: 1, y: 0.55 } : null}>
      <CardTitle title={t("card.load")} opens={!!onPress} />
      <View style={{ flex: 1, justifyContent: "center" }}>{v !== null && <LevelBar value={v} max={max} usual={target} color={INK.load} />}</View>
      {v === null ? <Waiting metric={strain} /> : <HeroValue value={`${Math.round(v)}%`} unit={word ?? undefined} size="edge" />}
    </PictureCard>
  );
}

/** Strain's hero for its detail page: the day's strain in dots against the Strain Target (spec 4.4, in the load ink). */
export function StrainHero({ strain, target, soFar }: { strain: Metric<number>; target: [number, number] | null; soFar?: boolean }) {
  const { t } = useTranslation("glow");
  const v = strain.value;
  const max = Math.max(100, v ?? 0, target?.[1] ?? 0);
  const where = v === null ? "waiting" : !target ? "noTarget" : v > target[1] ? "above" : v < target[0] ? "below" : "within";
  return (
    <GlowCard look={heroStyle(INK.load, 270)}>
      <CardTitle title={t("card.load")} note={target ? t("card.loadTarget", { low: Math.round(target[0]), high: Math.round(target[1]) }) : undefined} />
      <GText kind="sentence" numberOfLines={3} style={{ marginTop: LAYOUT.titleGap }}>
        {t(`hero.strain.${where}`)}
      </GText>
      <View style={{ marginTop: 20, gap: 14 }}>
        {v === null ? <DotText text="--" size="hero" color={WHITE.waiting} /> : <HeroValue value={`${Math.round(v)}%`} unit={soFar ? t("word.soFar") : undefined} size="hero" />}
        {v !== null && <LevelBar value={v} max={max} usual={target} color={WHITE.primary} />}
      </View>
      {strain.provisional && (
        <View style={{ marginTop: 12 }}>
          <OutlineTag text={t("word.provisional")} />
        </View>
      )}
    </GlowCard>
  );
}

/** Your week: a ring a day in Steps' lime, full at goal (spec 4.2). */
export function YourWeek({ steps, onPress }: { steps: GoalRow | null; onPress?: () => void }) {
  const { t } = useTranslation("glow");
  if (!steps) return null;
  const met = steps.history.filter((h) => h.done).length;
  const label = (day: string) => new Intl.DateTimeFormat(undefined, { weekday: "narrow", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
  return (
    <PictureCard onPress={onPress}>
      <CardTitle title={t("card.yourWeek")} opens={!!onPress} note={`${met}/${steps.history.length}`} />
      <View style={{ marginTop: 16 }}>
        <WeekRings days={steps.history.map((h, i) => ({ label: label(h.day), share: h.progress, today: i === steps.history.length - 1 }))} color={INK.steps} />
      </View>
    </PictureCard>
  );
}

/** Start a workout: the one action the screens offer, a strip with a white play button (spec 2.5, 4.2). */
export function StartWorkoutStrip() {
  const { t } = useTranslation("glow");
  return (
    <Strip onPress={() => push("/workout/start")} accessibilityLabel={t("card.startWorkout")}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ flex: 1 }}>
          <GText kind="cardTitle">{t("card.startWorkout")}</GText>
          <GText kind="secondary">{t("card.startWorkoutNote")}</GText>
        </View>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
          <Play size={18} color="#000000" fill="#000000" />
        </View>
      </View>
    </Strip>
  );
}

/** A hero that leads with a sentence (the workout window, after a workout, the evening and the night). */
export function SentenceHero({
  look,
  title,
  sentence,
  children,
  onPress,
}: {
  look: GlowStyle;
  title: string;
  sentence: string;
  children?: ReactNode;
  onPress?: () => void;
}) {
  return (
    <GlowCard look={look} onPress={onPress} minHeight={200}>
      <CardTitle title={title} opens={!!onPress} />
      <GText kind="sentence" numberOfLines={4} style={{ marginTop: LAYOUT.titleGap }}>
        {sentence}
      </GText>
      <View style={{ flex: 1 }} />
      {children}
    </GlowCard>
  );
}

/** The white Start button of the workout window's hero. */
export function StartButton({ label }: { label: string }) {
  return (
    <Press
      activeScale={0.96}
      onPress={() => push("/workout/start")}
      accessibilityRole="button"
      style={{
        marginTop: 18,
        alignSelf: "flex-start",
        height: 48,
        paddingHorizontal: 22,
        borderRadius: 24,
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Play size={16} color="#000000" fill="#000000" />
      <GText kind="body" color="#000000" style={{ fontFamily: "FunnelSans-Medium" }}>
        {label}
      </GText>
    </Press>
  );
}

export { heroStyle, secondStyle };
