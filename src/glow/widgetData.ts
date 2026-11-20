// Reads what the glow widgets need (src/glow/widget.ts) through the same queries the glow tabs use. Called by the widget
// publication (src/widgets/publish.ts) next to Home; any failure leaves the glow widgets on their last data.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { localMinutes } from "@/lib/time";
import { getActivities } from "@/queries/activities";
import type { QueryCtx } from "@/queries/ctx";
import { getGoalsDay } from "@/queries/goals";
import { getRecovery } from "@/queries/recovery";
import { getSleep } from "@/queries/sleep";
import type { HomeVM } from "@/queries/types";
import { GOALS_KEY, parseGoals } from "@/state/goals";
import { resolveMoment } from "./moment";
import { buildGlowWidget, type GlowWidgetData } from "./widget";

export async function glowWidgetData(ctx: QueryCtx, home: HomeVM): Promise<GlowWidgetData> {
  const goals = parseGoals(await AsyncStorage.getItem(GOALS_KEY).catch(() => null));
  const [recovery, sleep, goalDay, activities] = await Promise.all([getRecovery(ctx.today, ctx), getSleep(ctx.today, ctx), getGoalsDay(ctx.today, ctx, goals), getActivities(28, ctx)]);
  const now = ctx.now * 1000;
  const workouts = activities.groups.flatMap((g) => g.items.flatMap((it) => (it.kind === "activity" ? [{ start: it.start, end: it.end }] : [])));
  const plan = home.tonight.value?.plans.find((p) => p.key === "perform") ?? home.tonight.value?.plans[0];
  const moment = resolveMoment({
    now,
    timeZone: ctx.timeZone,
    day: ctx.today,
    recording: false,
    lastWorkoutEnd: workouts.reduce<number | null>((m, w) => (m === null || w.end > m ? w.end : m), null),
    sleepEnd: sleep.stages?.value?.wake ?? home.energyBank.value?.startAt ?? null,
    usualBedtimeMin: plan ? localMinutes(plan.bedtimeAt / 1000, ctx.timeZone) : null,
    workoutStarts: workouts.map((w) => w.start),
  });
  return buildGlowWidget({
    moment,
    home,
    recovery,
    sleep,
    steps: goalDay.goals.find((g) => g.key === "steps") ?? null,
    bedtimeIn: plan ? Math.round((plan.bedtimeAt - now) / 60_000) : null,
  });
}
