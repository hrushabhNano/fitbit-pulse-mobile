// The Sleep tab (unstrap docs/design/v2/spec.md § 5.2), night mood always: the night as a hero with one dotted score, the
// hypnogram and the stage bar with its legend; Night vitals; Regularity with the week's bed and wake bars.

import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Activity, Droplet, HeartPulse, Thermometer, Wind } from "lucide-react-native";
import { clock, durationWords, formatValue } from "@/lib/format";
import { dayHref } from "@/lib/url";
import type { QueryCtx } from "@/queries/ctx";
import { getSleep } from "@/queries/sleep";
import type { KeyStat, SleepVM } from "@/queries/types";
import { useScreen } from "@/screens/useScreen";
import { push } from "@/ui/navigate";
import { useSelectedDay } from "@/ui/shells/DateSwitcher";
import { useShellCalendar } from "@/ui/shells/ShellStatus";
import { stageParts } from "../Cards";
import { DotText, HeroValue } from "../DotText";
import { TabPage } from "../Frame";
import { GlowCard } from "../GlowCard";
import { heroStyle } from "../light";
import { CardTitle, GText, ListPanel, ListRow, PictureCard } from "../Parts";
import { Hypnogram, NightBars, StageBar, STAGE_INK } from "../Pictures";
import { INK, LAYOUT, type Ink } from "../tokens";
import { DetailsStrip } from "./DetailsStrip";
import type { LucideIcon } from "lucide-react-native";

const query = (d: string) => async (ctx: QueryCtx) => ({ sleep: await getSleep(d, ctx), today: ctx.today });

export function SleepTab() {
  const { t } = useTranslation("glow");
  const [d] = useSelectedDay();
  const { data } = useScreen(query(d), ["glow-sleep", d]);
  const vm = data && data.sleep.day === d ? data : undefined;
  return (
    <TabPage title={t("tabs.sleep")} calendarPath="/sleep" mood="night">
      {vm ? <Cards sleep={vm.sleep} today={vm.today} /> : <View style={{ height: 300 }} />}
    </TabPage>
  );
}

const VITAL: Record<string, { icon: LucideIcon; ink: Ink }> = {
  rhr: { icon: HeartPulse, ink: "heart" },
  restingHr: { icon: HeartPulse, ink: "heart" },
  hrv: { icon: Activity, ink: "hrv" },
  resp: { icon: Wind, ink: "sleepLight" },
  spo2: { icon: Droplet, ink: "spo2" },
  skinTemp: { icon: Thermometer, ink: "temperature" },
};

function Cards({ sleep, today }: { sleep: SleepVM; today: string }) {
  const { t } = useTranslation("glow");
  const at = (href: string) => () => push(dayHref(href, sleep.day, today));
  const vitals: KeyStat[] = [...sleep.summary, ...sleep.details].filter((s, i, all) => all.findIndex((x) => x.key === s.key) === i && s.key in VITAL);
  const consistency = sleep.consistency.value;
  return (
    <>
      <LastNightHero sleep={sleep} onPress={at("/sleep")} />
      {vitals.length > 0 && (
        <ListPanel title={t("card.nightVitals")}>
          {vitals.map((s, i) => {
            const v = s.metric.value;
            const look = VITAL[s.key];
            const off = v !== null && s.average !== null && s.sd ? (v - s.average) / s.sd : 0;
            return (
              <ListRow
                key={s.key}
                first={i === 0}
                icon={look.icon}
                ink={look.ink}
                name={s.label}
                status={
                  s.average !== null
                    ? t("word.average", { value: formatValue(s.format ?? (s.unit === "bpm" || s.unit === "ms" ? "int" : "decimal1"), s.average) })
                    : null
                }
                tag={off > 1 ? t("word.aboveNormal") : off < -1 ? t("word.belowNormal") : null}
                value={formatValue(s.format ?? (s.unit === "bpm" || s.unit === "ms" ? "int" : "decimal1"), v)}
                unit={s.unit}
                waiting={v === null}
                onPress={s.href ? at(s.href) : undefined}
              />
            );
          })}
        </ListPanel>
      )}
      {consistency && (
        <PictureCard ink="sleepDeep" onPress={at("/sleep")} style={{ minHeight: LAYOUT.unit }}>
          <CardTitle title={t("card.regularity")} opens />
          <View style={{ flex: 1, justifyContent: "center", paddingVertical: 12 }}>
            <NightBars nights={consistency.nights} color={INK.sleepDeep} />
          </View>
          <HeroValue value={`${Math.round(consistency.pct)}%`} unit={t("word.regular")} size="edge" />
        </PictureCard>
      )}
      <DetailsStrip onPress={at("/sleep")} />
    </>
  );
}

/** Last night's hero: the time asleep, the Sleep Performance in dots, the night's stages. The tab and /sleep both use it. */
export function LastNightHero({ sleep, onPress }: { sleep: Pick<SleepVM, "stages" | "hours" | "performance">; onPress?: () => void }) {
  const { t } = useTranslation("glow");
  const { timeZone } = useShellCalendar();
  const stages = sleep.stages?.value ?? null;
  const asleep = sleep.hours.value?.asleepMin ?? null;
  const score = sleep.performance.value;
  const parts = stageParts(sleep);
  return (
  <GlowCard look={heroStyle(INK.sleepDeep, 270)} onPress={onPress}>
    <CardTitle
      title={t("card.lastNight")}
      opens={!!onPress}
      note={stages && timeZone ? t("hero.bedToWake", { bed: clock(stages.bed, timeZone), wake: clock(stages.wake, timeZone) }) : undefined}
    />
    <GText kind="sentence" style={{ marginTop: LAYOUT.titleGap }} numberOfLines={3}>
      {asleep !== null ? t("hero.asleep", { time: durationWords(asleep) }) : t("hero.noSleep")}
    </GText>
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 14, marginTop: 18 }}>
      {score === null ? <DotText text="--" size="hero" color="rgba(255,255,255,0.3)" /> : <DotText text={String(Math.round(score))} size="hero" />}
      <GText kind="secondary" style={{ marginBottom: -2 }}>
        {t("word.sleepScore")}
      </GText>
    </View>
    {stages && (
      <View style={{ marginTop: 18, gap: 14 }}>
        <Hypnogram segments={stages.segments} from={stages.bed} to={stages.wake} />
        <StageBar parts={parts} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 6 }}>
          {parts.map((p) => (
            <View key={p.stage} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: STAGE_INK[p.stage] }} />
              <GText kind="secondary">
                {t(`stage.${p.stage}`)} {durationWords(p.minutes)}
              </GText>
            </View>
          ))}
        </View>
      </View>
    )}
  </GlowCard>
  );
}
