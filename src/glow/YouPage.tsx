// You (unstrap docs/design/v2/spec.md § 3.4), opened from the avatar: the way into everything that isn't one of the
// four tabs. Health, Journal and More keep their own pages, now one tap down.

import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookOpen, ChartLine, ChevronLeft, HeartPulse, MessageCircle, Settings2, Target } from "lucide-react-native";
import { push } from "@/ui/navigate";
import { Press } from "@/ui/Press";
import { GText, ListPanel, ListRow } from "./Parts";
import { LAYOUT, SURFACE } from "./tokens";

/** A page over a tab (spec 3.4): a 44 dp round back button, the title in Page title type, then cards. */
export function GlowPage({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation("common");
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: SURFACE.page }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: LAYOUT.gutter, gap: LAYOUT.gap }}
    >
      <Press
        activeScale={0.94}
        accessibilityRole="button"
        accessibilityLabel={t("actions.back")}
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        style={{
          width: LAYOUT.round,
          height: LAYOUT.round,
          borderRadius: LAYOUT.round / 2,
          backgroundColor: SURFACE.control,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronLeft size={22} color="#FFFFFF" strokeWidth={1.75} />
      </Press>
      <GText kind="pageTitle" accessibilityRole="header" style={{ marginTop: 8, marginBottom: 8 }}>
        {title}
      </GText>
      {children}
    </ScrollView>
  );
}

export function YouPage() {
  const { t } = useTranslation("glow");
  return (
    <GlowPage title={t("you.title")}>
      <ListPanel>
        <ListRow first icon={HeartPulse} ink="heart" name={t("you.health")} status={t("you.healthNote")} onPress={() => push("/health")} />
        <ListRow icon={BookOpen} ink="evening" name={t("you.journal")} status={t("you.journalNote")} onPress={() => push("/journal")} />
        <ListRow icon={ChartLine} ink="recovery" name={t("card.trends")} onPress={() => push("/trends")} />
        <ListRow icon={Target} ink="steps" name={t("card.goals")} onPress={() => push("/goals")} />
        <ListRow icon={MessageCircle} ink="sleepLight" name={t("card.coach")} onPress={() => push("/coach")} />
      </ListPanel>
      <View>
        <ListPanel>
          <ListRow first icon={Settings2} name={t("you.more")} status={t("you.moreNote")} onPress={() => push("/more")} />
        </ListPanel>
      </View>
    </GlowPage>
  );
}
