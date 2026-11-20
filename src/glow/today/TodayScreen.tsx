// Today (unstrap docs/design/v2/spec.md § 4): the screen follows the day. One hero whose content changes with the moment
// (waking up, midday, workout time, during and after a workout, evening, night), then a grid one size down with Smalls in
// pairs. It reads the existing view models; nothing about scoring changes.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { durationWords } from "@/lib/format";
import { localMinutes } from "@/lib/time";
import { dayHref } from "@/lib/url";
import { getActivities } from "@/queries/activities";
import { getChartDay } from "@/queries/chart";
import type { QueryCtx } from "@/queries/ctx";
import { getGoalsDay, type Goals } from "@/queries/goals";
import { getHome } from "@/queries/home";
import { getRecovery } from "@/queries/recovery";
import { getSleep } from "@/queries/sleep";
import { useScreen } from "@/screens/useScreen";
import { useGoals } from "@/state/goals";
import { useSelectedDay } from "@/ui/shells/DateSwitcher";
import { useShellCalendar } from "@/ui/shells/ShellStatus";
import { push } from "@/ui/navigate";
import {
  EnergyCard,
  HeartRateSmall,
  LastNightCard,
  LastNightStrip,
  LoadSmall,
  RecoveryHero,
  RecoverySmall,
  SentenceHero,
  StartButton,
  StartWorkoutStrip,
  StepsCard,
  StressSmall,
  YourWeek,
} from "../Cards";
import { DotText, HeroValue } from "../DotText";
import { TabPage, useRecording, useRecordingBpm } from "../Frame";
import { heroStyle, secondStyle } from "../light";
import { MOMENT_LOOK, resolveMoment, type Moment } from "../moment";
import { ListPanel, ListRow, Pair } from "../Parts";
import { DayLine } from "../Pictures";
import { INK } from "../tokens";
import { Activity, HeartPulse, Thermometer, Wind } from "lucide-react-native";
import { grouped } from "../model";

const todayQuery = (d: string, goals: Goals) => async (ctx: QueryCtx) => {
  const [home, recovery, sleep, hr, stress, goalDay, activities] = await Promise.all([
    getHome(d, ctx),
    getRecovery(d, ctx),
    getSleep(d, ctx),
    getChartDay("hr", d, ctx).catch(() => null),
    getChartDay("stress", d, ctx).catch(() => null),
    getGoalsDay(d, ctx, goals),
    getActivities(28, ctx),
  ]);
  const workouts = activities.groups.flatMap((g) => g.items.flatMap((it) => (it.kind === "activity" ? [{ name: it.name, start: it.start, end: it.end }] : [])));
  return { home, recovery, sleep, hr, stress, steps: goalDay.goals.find((g) => g.key === "steps") ?? null, workouts };
};
type TodayVM = Awaited<ReturnType<ReturnType<typeof todayQuery>>>;

/** Now, read again every minute so the moment moves on while the screen is open. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function TodayScreen() {
  const { t } = useTranslation("glow");
  const [d] = useSelectedDay();
  const { timeZone } = useShellCalendar();
  const { goals, ready } = useGoals();
  const { data } = useScreen(todayQuery(d, goals), ["glow-today", d, ready ? JSON.stringify(goals.targets.steps) : "wait"]);
  const recording = useRecording();
  const now = useNow();
  const vm = data && data.home.day === d ? data : undefined;
  const moment: Moment = useMemo(() => {
    if (!vm || !timeZone) return "midday";
    const plan = vm.home.tonight.value?.plans.find((p) => p.key === "perform") ?? vm.home.tonight.value?.plans[0];
    const last = vm.workouts.reduce<number | null>((m, w) => (m === null || w.end > m ? w.end : m), null);
    return resolveMoment({
      now,
      timeZone,
      day: d,
      recording,
      lastWorkoutEnd: last,
      sleepEnd: vm.sleep.stages?.value?.wake ?? vm.home.energyBank.value?.startAt ?? null,
      usualBedtimeMin: plan ? localMinutes(plan.bedtimeAt / 1000, timeZone) : null,
      workoutStarts: vm.workouts.map((w) => w.start),
    });
  }, [vm, timeZone, now, d, recording]);
  const past = vm ? !vm.home.isToday : false;
  const title = past ? t("moment.past") : t(`moment.${moment}`);
  return (
    <TabPage title={title} calendarPath="/" mood={MOMENT_LOOK[moment].mood}>
      {vm ? <TodayCards vm={vm} moment={moment} now={now} /> : <View style={{ height: 300 }} />}
    </TabPage>
  );
}

function TodayCards({ vm, moment, now }: { vm: TodayVM; moment: Moment; now: number }) {
  const { t } = useTranslation("glow");
  const { home, recovery, sleep, hr, stress, steps } = vm;
  const d = home.day;
  const at = (href: string) => () => push(dayHref(href, d, home.today));
  const look = MOMENT_LOOK[moment];
  const bpm = useRecordingBpm();
  const asleep = sleep.hours.value?.asleepMin ?? null;
  const slept =
    asleep !== null ? t("hero.slept", { time: durationWords(asleep) }) : sleep.performance.value === null && home.isToday ? t("hero.noSleep") : null;

  const recoveryHero = <RecoveryHero vm={recovery} lead={slept} look={heroStyle(INK.recovery, look.angle)} onPress={at("/recovery")} />;
  const energyHero = <EnergyCard energy={home.energyBank} variant="hero" onPress={at("/chart?metric=energy&r=w")} />;
  const energySecond = <EnergyCard energy={home.energyBank} variant="second" onPress={at("/chart?metric=energy&r=w")} />;
  const lastNightWide = <LastNightCard sleep={sleep} size="wide" onPress={at("/sleep")} />;
  const lastNightSmall = <LastNightCard sleep={sleep} size="small" onPress={at("/sleep")} />;
  const lastNightStrip = <LastNightStrip sleep={sleep} onPress={at("/sleep")} />;
  const stepsWide = <StepsCard steps={steps} size="wide" onPress={() => push("/goals")} />;
  const stepsSmall = <StepsCard steps={steps} size="small" onPress={() => push("/goals")} />;
  const heart = <HeartRateSmall hr={hr} onPress={at("/health/heart-rate")} />;
  const stressCard = <StressSmall stress={stress} level={home.stress} onPress={at("/health/stress")} />;
  const recoverySmall = <RecoverySmall vm={recovery} onPress={at("/recovery")} />;
  const load = <LoadSmall strain={home.dials.strain} target={home.dials.strainTarget} onPress={at("/strain")} />;
  const week = <YourWeek steps={steps} onPress={() => push("/goals")} />;
  const start = home.isToday ? <StartWorkoutStrip /> : null;

  const bodyMorning = (
    <ListPanel title={t("card.bodyMorning")}>
      {recovery.contributors
        .filter((c) => c.key !== "sleep")
        .map((c, i) => {
          const v = c.metric.value;
          const icon = c.key === "hrv" ? Activity : c.key === "rhr" ? HeartPulse : c.key === "resp" ? Wind : Thermometer;
          const ink = c.key === "hrv" ? "hrv" : c.key === "rhr" ? "heart" : c.key === "resp" ? "sleepLight" : "temperature";
          const off = v !== null && c.baseline && c.baseline.sd > 0 ? (v - c.baseline.mean) / c.baseline.sd : 0;
          return (
            <ListRow
              key={c.key}
              first={i === 0}
              icon={icon}
              ink={ink}
              name={c.label}
              status={c.baseline ? t("word.usual") : null}
              tag={off > 1 ? t("word.aboveNormal") : off < -1 ? t("word.belowNormal") : null}
              value={
                v === null ? "--" : c.key === "skinTemp" ? v.toFixed(1) : String(Math.round(v * (c.key === "resp" ? 10 : 1)) / (c.key === "resp" ? 10 : 1))
              }
              unit={c.unit}
              waiting={v === null}
              onPress={at("/recovery")}
            />
          );
        })}
    </ListPanel>
  );

  const layout: ReactNode[] = (() => {
    if (!home.isToday)
      return [
        recoveryHero,
        bodyMorning,
        lastNightWide,
        <Pair key="p">
          {heart}
          {stepsSmall}
        </Pair>,
      ];
    switch (moment) {
      case "waking":
        return [
          recoveryHero,
          bodyMorning,
          lastNightWide,
          <Pair key="p1">
            {heart}
            {stepsSmall}
          </Pair>,
          week,
          start,
        ];
      case "midday":
        return [
          energyHero,
          <Pair key="p1">
            {recoverySmall}
            {lastNightSmall}
          </Pair>,
          stepsWide,
          <Pair key="p2">
            {heart}
            {stressCard}
          </Pair>,
          week,
          start,
        ];
      case "window":
        return [
          <SentenceHero
            key="h"
            look={heroStyle(INK.heart, look.angle, look.rim)}
            title={t("moment.window")}
            sentence={recovery.band === "red" ? t("hero.windowLow") : t("hero.windowLine")}
          >
            <StartButton label={t("card.startWorkout")} />
          </SentenceHero>,
          energySecond,
          <Pair key="p1">
            {load}
            {recoverySmall}
          </Pair>,
          stepsWide,
          lastNightStrip,
        ];
      case "during":
        return [
          <SentenceHero
            key="h"
            look={heroStyle(INK.heart, look.angle, look.rim)}
            title={t("moment.during")}
            sentence={t("hero.duringLine")}
            onPress={() => push("/workout/live")}
          >
            {bpm !== null ? <HeroValue value={String(Math.round(bpm))} unit={t("word.bpm")} size="detail" /> : null}
          </SentenceHero>,
          stepsWide,
          <Pair key="p1">
            {recoverySmall}
            {lastNightSmall}
          </Pair>,
        ];
      case "after": {
        const last = vm.workouts.reduce((a, b) => (b.end > a.end ? b : a), vm.workouts[0]);
        const since = last ? Math.round((now - last.end) / 60_000) : 0;
        return [
          <SentenceHero
            key="h"
            look={heroStyle(INK.recovery, look.angle, look.rim)}
            title={t("moment.after")}
            sentence={t("hero.afterLine", { name: (last?.name ?? "").toLowerCase(), time: durationWords(since) })}
            onPress={at("/strain")}
          >
            {hr ? (
              <DayLine
                xs={hr.xs}
                ys={hr.ys}
                from={hr.from}
                to={hr.to}
                color="#FFFFFF"
                height={52}
                band={hr.refs.resting !== null ? [hr.refs.resting - 4, hr.refs.resting + 4] : null}
              />
            ) : null}
          </SentenceHero>,
          <Pair key="p1">
            {load}
            {recoverySmall}
          </Pair>,
          energySecond,
          <Pair key="p2">
            {stepsSmall}
            {lastNightSmall}
          </Pair>,
        ];
      }
      case "evening":
      case "night": {
        const plan = home.tonight.value?.plans.find((p) => p.key === "perform") ?? home.tonight.value?.plans[0];
        const until = plan ? Math.round((plan.bedtimeAt - now) / 60_000) : null;
        const parts = [
          steps?.value != null ? t("hero.evening", { steps: grouped(steps.value) }) : null,
          moment === "night" ? t("hero.nightLine") : null,
          until !== null && until > 0 ? t("hero.bedtimeIn", { time: durationWords(until) }) : null,
        ].filter(Boolean);
        return [
          <SentenceHero
            key="h"
            look={heroStyle(moment === "night" ? INK.sleepDeep : INK.evening, look.angle, look.rim)}
            title={t(`moment.${moment}`)}
            sentence={parts.join(" ") || t("hero.nightLine")}
            onPress={at("/sleep")}
          >
            {steps?.value != null ? <DotText text={grouped(steps.value)} size="hero" /> : null}
          </SentenceHero>,
          energySecond,
          <Pair key="p1">
            {stepsSmall}
            {heart}
          </Pair>,
          lastNightStrip,
          moment === "evening" ? start : null,
        ];
      }
    }
  })();
  return <>{layout.map((node, i) => (node ? <View key={i}>{node}</View> : null))}</>;
}

export { secondStyle };
