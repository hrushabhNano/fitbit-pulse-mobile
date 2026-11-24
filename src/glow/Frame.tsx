// The frame of the glow tabs (spec 3.1, 3.2): the moment header, the floating tab bar with its fade, and the scrolling
// page they hold.

import { useCallback, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Tabs } from "expo-router";
import { HeartPulse, Menu, NotebookPen, User, type LucideIcon } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import { HomeChart } from "@/ui/icons";
import { markDots, markHeight } from "./mark";
import { CalendarPanel } from "@/ui/shells/CalendarPanel";
import { useSelectedDay } from "@/ui/shells/DateSwitcher";
import { useShellCalendar, useShellSync } from "@/ui/shells/ShellStatus";
import { LiveWorkoutBar } from "@/ui/shells/LiveWorkoutBar";
import { push } from "@/ui/navigate";
import { Press } from "@/ui/Press";
import { haptic } from "@/ui/haptics";
import { calendarContext } from "@/lib/calendar";
import { addDays } from "@/lib/time";
import { DAY, formatDay } from "@/lib/format";
import { workoutRecorder } from "@/live/workoutRecorder";
import { GText } from "./Parts";
import { MoodProvider } from "./mood";
import { INK, LAYOUT, SURFACE, WHITE, type Mood } from "./tokens";

/** The tabs: Pulse's Home, Health, Journal and More, each with its section colour for the active capsule. */
export const GLOW_TABS: { route: string; key: "home" | "health" | "journal" | "more"; icon: LucideIcon; tint: string; calendar: string }[] = [
  { route: "index", key: "home", icon: HomeChart, tint: "#FFFFFF", calendar: "/" },
  { route: "health", key: "health", icon: HeartPulse, tint: INK.heart, calendar: "/health" },
  { route: "journal", key: "journal", icon: NotebookPen, tint: INK.evening, calendar: "/journal" },
  { route: "more", key: "more", icon: Menu, tint: "#FFFFFF", calendar: "/" },
];

const minutesAgo = (t: number | null) => (t === null ? null : Math.max(0, Math.round((Date.now() - t) / 60_000)));

/** The chip at the right of the header: the sync state, words only when they matter (spec 3.1). */
function SyncChip() {
  const { t } = useTranslation("glow");
  const sync = useShellSync();
  if (!sync) return <View style={{ width: LAYOUT.round }} />;
  const { state, lastSuccessAt } = sync.sync;
  const ago = minutesAgo(lastSuccessAt);
  const warn = state === "stale" || state === "error";
  const label =
    state === "syncing"
      ? t("header.sync.syncing")
      : warn
        ? ago !== null && ago < 24 * 60
          ? t("header.sync.ago", { time: ago < 60 ? `${ago} min` : `${Math.round(ago / 60)} h` })
          : t(`header.sync.${state}`)
        : t("header.sync.ok");
  return (
    <Press
      activeScale={0.96}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${t("header.sync.open")}`}
      onPress={() => push("/more/data")}
      style={{
        height: LAYOUT.round,
        borderRadius: LAYOUT.round / 2,
        backgroundColor: SURFACE.control,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        gap: 8,
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: warn ? INK.warn : INK.good }} />
      <GText kind="body" style={{ fontSize: 14 }}>
        {label}
      </GText>
    </Press>
  );
}

/**
 * The header on every tab (spec 3.1): the avatar opens You, the moment or tab name over the day sits in the middle (swipe
 * it to change day, tap it for the calendar, yesterday peeking in dimmed), the sync chip on the right.
 */
export function MomentHeader({ title, calendarPath, dated = true }: { title: string; calendarPath: string; /** false: the title alone, no day to change (Health, More). */ dated?: boolean }) {
  const { t } = useTranslation("glow");
  const [d, setDay] = useSelectedDay();
  const { today, firstDay } = useShellCalendar();
  const [open, setOpen] = useState(false);
  const prev = addDays(d, -1);
  const canPrev = !firstDay || prev >= firstDay;
  const canNext = d < today;
  const toPrev = () => canPrev && setDay(prev);
  const toNext = () => canNext && setDay(addDays(d, 1));
  // Pulling the day to the right brings the day before, as a page would.
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .runOnJS(true)
    .onEnd((e) => {
      if (e.translationX > 56) toPrev();
      else if (e.translationX < -56) toNext();
    });
  const date = formatDay(d, DAY.short);
  return (
    <View style={{ height: 60, flexDirection: "row", alignItems: "center" }}>
      <Press
        activeScale={0.94}
        accessibilityRole="button"
        accessibilityLabel={t("header.openSettings")}
        onPress={() => push("/settings")}
        style={{
          width: LAYOUT.round,
          height: LAYOUT.round,
          borderRadius: LAYOUT.round / 2,
          backgroundColor: SURFACE.control,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <User size={20} color={WHITE.secondary} strokeWidth={1.5} />
      </Press>
      {!dated ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <GText kind="headerDate" accessibilityRole="header" numberOfLines={1}>
            {title}
          </GText>
        </View>
      ) : (
      <GestureDetector gesture={pan}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
          {canPrev && (
            <GText
              kind="body"
              color={WHITE.waiting}
              style={{ marginRight: 14 }}
              numberOfLines={1}
              onPress={toPrev}
              accessibilityLabel={t("header.previousDay")}
            >
              {formatDay(prev, { weekday: "short" })}
            </GText>
          )}
          <Press
            accessibilityRole="button"
            accessibilityLabel={t("header.pickDay", { moment: title, date })}
            onPress={() => setOpen(true)}
            style={{ alignItems: "center", paddingHorizontal: 10, paddingVertical: 4 }}
          >
            <GText kind="moment" numberOfLines={1}>
              {title}
            </GText>
            <GText kind="headerDate" numberOfLines={1}>
              {date}
            </GText>
          </Press>
        </View>
      </GestureDetector>
      )}
      <SyncChip />
      <CalendarPanel
        open={open}
        onClose={() => setOpen(false)}
        selected={d}
        context={calendarContext(calendarPath)}
        onSelect={(day) => (setDay(day), setOpen(false))}
      />
    </View>
  );
}

/** How far a tab page leaves at its foot so its last card scrolls clear of the bar (spec 3.2: 24 dp above the pill). */
export function useTabClearance() {
  const bottom = Math.max(useSafeAreaInsets().bottom, 12);
  return bottom + LAYOUT.tabBarHeight + 24;
}

/** A tab's page: black, the header, the cards in one column with a 12 dp gap and 16 dp gutters, pull to sync. */
export function TabPage({ title, calendarPath, mood = "day", children }: { title: string; calendarPath: string; mood?: Mood; children: ReactNode }) {
  const top = useSafeAreaInsets().top;
  const clearance = useTabClearance();
  const sync = useShellSync();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    if (!sync?.syncNow) return;
    setRefreshing(true);
    sync
      .syncNow()
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [sync]);
  return (
    <MoodProvider value={mood}>
      <ScrollView
        style={{ flex: 1, backgroundColor: SURFACE.page }}
        contentContainerStyle={{ paddingTop: top, paddingHorizontal: LAYOUT.gutter, paddingBottom: clearance, gap: LAYOUT.gap }}
        refreshControl={
          sync?.syncNow ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" colors={["#000000"]} progressBackgroundColor="#FFFFFF" />
          ) : undefined
        }
      >
        <MomentHeader title={title} calendarPath={calendarPath} />
        {children}
      </ScrollView>
    </MoodProvider>
  );
}

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

/**
 * Four tabs in a pill, centred, and nothing else (spec 3.2). The active capsule takes its section's colour. A black fade
 * behind the pill lets cards slide under it softly. The live workout capsule sits above it while a workout records.
 */
export function GlowTabBar({ state, navigation }: TabBarProps) {
  const { t } = useTranslation("glow");
  const bottom = Math.max(useSafeAreaInsets().bottom, 12);
  const current = state.routes[state.index]?.name;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.85)", "#000000"]}
        locations={[0, 0.45, 1]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: LAYOUT.tabFade + bottom }}
      />
      <View pointerEvents="box-none" style={{ paddingHorizontal: LAYOUT.gutter, gap: 8, marginBottom: bottom, alignItems: "center" }}>
        <View pointerEvents="box-none" style={{ alignSelf: "stretch" }}>
          <LiveWorkoutBar />
        </View>
        <View pointerEvents="box-none" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          accessibilityRole="tablist"
          accessibilityLabel={t("tabs.label")}
          style={{
            flexDirection: "row",
            height: LAYOUT.tabBarHeight,
            borderRadius: LAYOUT.tabBarHeight / 2,
            backgroundColor: SURFACE.sheet,
            borderWidth: 1,
            borderColor: WHITE.hairline,
            padding: 5,
            gap: 2,
          }}
        >
          {GLOW_TABS.map((tab) => {
            const route = state.routes.find((r) => r.name === tab.route);
            const on = current === tab.route;
            const Icon = tab.icon;
            const label = t(`tabs.${tab.key}`);
            return (
              <Press
                key={tab.route}
                activeScale={0.96}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: on }}
                onPress={() => {
                  if (!route) return;
                  const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                  if (!on && !event.defaultPrevented) {
                    haptic.select();
                    navigation.navigate(route.name);
                  }
                }}
                style={{
                  width: 64,
                  borderRadius: (LAYOUT.tabBarHeight - 10) / 2,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  backgroundColor: on ? `${tab.tint}2E` : "transparent",
                }}
              >
                <Icon size={22} color={on ? "#FFFFFF" : WHITE.secondary} strokeWidth={on ? 2.25 : 1.5} />
                <GText kind="tab" color={on ? "#FFFFFF" : WHITE.secondary}>
                  {label}
                </GText>
              </Press>
            );
          })}
        </View>
        <GlowCheckIn />
        </View>
      </View>
    </View>
  );
}

/** The heartbeat mark (src/glow/mark.ts) in white, `width` wide. */
export function GlowMark({ width, color = "#FFFFFF" }: { width: number; color?: string }) {
  const dots = markDots(width);
  return (
    <Svg width={width} height={markHeight(width)} accessibilityElementsHidden>
      {dots.map((d) => (
        <Circle key={`${d.x},${d.y}`} cx={d.x} cy={d.y} r={d.r} fill={color} />
      ))}
    </Svg>
  );
}

/**
 * The round action beside the tabs: the AI coach, always (`/coach`, which asks for a key first when none is saved). The
 * check-in stays one tap away in the + menu and on Journal.
 */
function GlowCheckIn() {
  const { t } = useTranslation("glow");
  return (
    <Press
      activeScale={0.94}
      accessibilityRole="button"
      accessibilityLabel={t("header.openCoach")}
      onPress={() => {
        haptic.tap();
        push("/coach");
      }}
      style={{
        width: LAYOUT.tabBarHeight,
        height: LAYOUT.tabBarHeight,
        borderRadius: LAYOUT.tabBarHeight / 2,
        backgroundColor: SURFACE.sheet,
        borderWidth: 1,
        borderColor: WHITE.hairline,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <GlowMark width={30} />
    </Press>
  );
}

/** Whether a workout is recording on the phone now. */
export function useRecording() {
  return useSyncExternalStore(
    workoutRecorder.subscribe,
    () => workoutRecorder.getSnapshot().active?.status === "recording",
    () => false,
  );
}

/** The heart rate of the workout recording now, or null. */
export function useRecordingBpm() {
  return useSyncExternalStore(
    workoutRecorder.subscribe,
    () => workoutRecorder.getSnapshot().active?.lastBpm ?? null,
    () => null,
  );
}
