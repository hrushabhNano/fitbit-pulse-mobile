// The Activity tab (unstrap docs/design/v2/spec.md § 5.3): Start a workout, Steps as the hero, Load beside Heart rate,
// the day's figures, and the workouts.

import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Bike, Dumbbell, Footprints, PersonStanding, Timer, Flame, type LucideIcon } from "lucide-react-native";
import { clock, durationWords, formatValue } from "@/lib/format";
import { dayHref } from "@/lib/url";
import { getChartDay } from "@/queries/chart";
import type { QueryCtx } from "@/queries/ctx";
import { getGoalsDay, type Goals } from "@/queries/goals";
import { getStrain } from "@/queries/strain";
import type { ActivityKind } from "@/queries/types";
import { useScreen } from "@/screens/useScreen";
import { useGoals } from "@/state/goals";
import { push } from "@/ui/navigate";
import { useSelectedDay } from "@/ui/shells/DateSwitcher";
import { useShellCalendar } from "@/ui/shells/ShellStatus";
import { HeartRateSmall, LoadSmall, StartWorkoutStrip } from "../Cards";
import { DotText } from "../DotText";
import { TabPage } from "../Frame";
import { GlowCard } from "../GlowCard";
import { limeHeroStyle } from "../light";
import { grouped } from "../model";
import { CardTitle, GText, ListPanel, ListRow, Pair, Tag } from "../Parts";
import { LevelBar } from "../Pictures";
import { INK, LAYOUT } from "../tokens";
import { DetailsStrip } from "./DetailsStrip";

const query = (d: string, goals: Goals) => async (ctx: QueryCtx) => {
  const [strain, goalDay, hr] = await Promise.all([getStrain(d, ctx), getGoalsDay(d, ctx, goals), getChartDay("hr", d, ctx).catch(() => null)]);
  return { strain, steps: goalDay.goals.find((g) => g.key === "steps") ?? null, hr, today: ctx.today };
};

const SPORT: Record<ActivityKind, LucideIcon> = { run: PersonStanding, ride: Bike, walk: Footprints, strength: Dumbbell, workout: Timer };

export function ActivityTab() {
  const { t } = useTranslation("glow");
  const [d] = useSelectedDay();
  const { goals, ready } = useGoals();
  const { data } = useScreen(query(d, goals), ["glow-activity", d, ready ? goals.targets.steps : "wait"]);
  const vm = data && data.strain.day === d ? data : undefined;
  return (
    <TabPage title={t("tabs.activity")} calendarPath="/strain">
      {vm ? <Cards vm={vm} /> : <View style={{ height: 300 }} />}
    </TabPage>
  );
}

function Cards({ vm }: { vm: Awaited<ReturnType<ReturnType<typeof query>>> }) {
  const { t } = useTranslation("glow");
  const { timeZone } = useShellCalendar();
  const { strain, steps, hr, today } = vm;
  const at = (href: string) => () => push(dayHref(href, strain.day, today));
  const value = steps?.value ?? null;
  const share = steps && value !== null ? Math.round((value / steps.target) * 100) : null;
  const target = strain.target.value ? ([strain.target.value.low, strain.target.value.high] as [number, number]) : null;
  return (
    <>
      {strain.isToday && <StartWorkoutStrip />}
      <GlowCard look={limeHeroStyle(INK.steps)} onPress={() => push("/goals")} minHeight={220}>
        <CardTitle title={t("card.steps")} opens note={steps ? grouped(steps.target) : undefined} />
        <View style={{ flex: 1, justifyContent: "center", paddingVertical: 18 }}>
          {steps && <LevelBar value={value ?? 0} max={steps.target} color="#FFFFFF" />}
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <DotText text={value === null ? "0" : grouped(value)} size="second" />
          {steps?.done && <Tag text={t("word.goalMet")} />}
        </View>
        {share !== null && (
          <GText kind="secondary" color="rgba(255,255,255,0.86)" style={{ marginTop: 6 }}>
            {t("card.goalShare", { value: share })}
          </GText>
        )}
      </GlowCard>
      <Pair>
        <LoadSmall strain={strain.strain} target={target} onPress={at("/strain")} />
        <HeartRateSmall hr={hr} onPress={at("/health/heart-rate")} />
      </Pair>
      {strain.summary.length > 0 && (
        <ListPanel title={t("card.today")} note={strain.soFar ? t("word.soFar") : undefined}>
          {strain.summary.map((s, i) => (
            <ListRow
              key={s.key}
              first={i === 0}
              icon={s.key.includes("cal") ? Flame : undefined}
              ink={s.key.includes("cal") ? "calories" : undefined}
              name={s.label}
              value={formatValue(s.format ?? (s.unit === "kcal" ? "grouped" : "int"), s.metric.value)}
              unit={s.unit}
              waiting={s.metric.value === null}
              onPress={s.href ? at(s.href) : undefined}
            />
          ))}
        </ListPanel>
      )}
      <ListPanel title={t("card.workouts")} note={t("card.allWorkouts")} onNote={() => push("/activities")}>
        {strain.activities.length === 0 ? (
          <View style={{ paddingVertical: LAYOUT.rowPadding }}>
            <GText kind="secondary">{t("card.noWorkouts")}</GText>
          </View>
        ) : (
          strain.activities.map((a, i) => (
            <ListRow
              key={a.id}
              first={i === 0}
              icon={SPORT[a.activityKind]}
              ink="heart"
              name={a.name}
              status={timeZone ? `${clock(a.start, timeZone)} · ${durationWords((a.end - a.start) / 60_000)}` : durationWords((a.end - a.start) / 60_000)}
              value={a.strain.value === null ? null : `${Math.round(a.strain.value)}%`}
              onPress={() => push(`/activity/${a.id}`)}
            />
          ))
        )}
      </ListPanel>
      <DetailsStrip onPress={at("/strain")} />
    </>
  );
}
