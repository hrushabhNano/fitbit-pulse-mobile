// The Recovery tab (unstrap docs/design/v2/spec.md § 5.1): the hero with the score in a dark pool, What drove it, Energy
// as a tall battery beside Recharged and Drained, Body signals, and the way into the full Recovery page.

import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { CalendarHeart, Thermometer, Wind } from "lucide-react-native";
import { dayHref } from "@/lib/url";
import type { QueryCtx } from "@/queries/ctx";
import { getHome } from "@/queries/home";
import { getRecovery } from "@/queries/recovery";
import { useScreen } from "@/screens/useScreen";
import { push } from "@/ui/navigate";
import { useSelectedDay } from "@/ui/shells/DateSwitcher";
import { EnergyCard, EnergyPart, RecoveryHero } from "../Cards";
import { TabPage } from "../Frame";
import { heroStyle } from "../light";
import { against, contributorShare } from "../model";
import { ContributorRow, ListPanel, ListRow } from "../Parts";
import { INK, LAYOUT } from "../tokens";
import { DetailsStrip } from "./DetailsStrip";

const query = (d: string) => async (ctx: QueryCtx) => {
  const [recovery, home] = await Promise.all([getRecovery(d, ctx), getHome(d, ctx)]);
  return { recovery, home };
};

export function RecoveryTab() {
  const { t } = useTranslation("glow");
  const [d] = useSelectedDay();
  const { data } = useScreen(query(d), ["glow-recovery", d]);
  const vm = data && data.recovery.day === d ? data : undefined;
  return (
    <TabPage title={t("tabs.recovery")} calendarPath="/recovery">
      {vm ? <Cards vm={vm} /> : <View style={{ height: 300 }} />}
    </TabPage>
  );
}

function Cards({ vm }: { vm: { recovery: Awaited<ReturnType<typeof getRecovery>>; home: Awaited<ReturnType<typeof getHome>> } }) {
  const { t } = useTranslation("glow");
  const { recovery, home } = vm;
  const at = (href: string) => () => push(dayHref(href, recovery.day, home.today));
  const sorted = [...recovery.contributors].sort((a, b) => Math.abs(b.points ?? 0) - Math.abs(a.points ?? 0));
  const word = (k: ReturnType<typeof against>) => (k === "above" ? t("word.aboveNormal") : k === "below" ? t("word.belowNormal") : null);
  const signals = recovery.contributors.filter((c) => c.key === "resp" || c.key === "skinTemp");
  return (
    <>
      {/* The number sits in a dark pool: the core behind it, light all round (spec 2.6). */}
      <RecoveryHero vm={recovery} look={heroStyle(INK.recovery, null)} onPress={at("/recovery")} />
      <ListPanel title={t("card.whatDrove")} note={t("card.allOf", { count: recovery.contributors.length })} onNote={at("/recovery")}>
        {sorted.slice(0, 3).map((c, i) => {
          const k = against(c.metric.value, c.baseline);
          return (
            <ContributorRow
              key={c.key}
              first={i === 0}
              name={c.label}
              share={contributorShare(c)}
              word={c.metric.value === null ? t("word.noData") : t("word.usual")}
              tag={word(k)}
              onPress={at("/recovery")}
            />
          );
        })}
      </ListPanel>
      <View style={{ flexDirection: "row", gap: LAYOUT.gap }}>
        <View style={{ flex: 1 }}>
          <EnergyCard energy={home.energyBank} variant="tall" onPress={at("/chart?metric=energy&r=w")} />
        </View>
        <View style={{ flex: 1, gap: LAYOUT.gap }}>
          <EnergyPart energy={home.energyBank} kind="recharged" />
          <EnergyPart energy={home.energyBank} kind="drained" />
        </View>
      </View>
      <ListPanel title={t("card.bodySignals")}>
        {signals.map((c, i) => {
          const v = c.metric.value;
          return (
            <ListRow
              key={c.key}
              first={i === 0}
              icon={c.key === "resp" ? Wind : Thermometer}
              ink={c.key === "resp" ? "sleepLight" : "temperature"}
              name={c.label}
              status={c.baseline ? t("word.usual") : null}
              tag={word(against(v, c.baseline))}
              value={v === null ? "--" : v.toFixed(1)}
              unit={c.unit}
              waiting={v === null}
              onPress={at("/recovery")}
            />
          );
        })}
        <ListRow
          first={signals.length === 0}
          icon={CalendarHeart}
          ink="age"
          name={t("card.healthspan")}
          status={t("card.healthspanNote")}
          onPress={() => push("/health/healthspan")}
        />
      </ListPanel>
      <DetailsStrip onPress={at("/recovery")} />
    </>
  );
}
