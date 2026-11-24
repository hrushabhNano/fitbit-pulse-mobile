import { Tabs } from "expo-router";
import { GlowTabBar } from "@/glow/Frame";
import { SURFACE } from "@/glow/tokens";

// The bottom tabs: Pulse's Home, Health, Journal and More, in the glow design's floating pill (src/glow/Frame.tsx) with
// the round check-in action beside it. Home opens on the time-of-day hero, then everything Pulse's Home shows.
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlowTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: SURFACE.page }, animation: "fade" }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="health" />
      <Tabs.Screen name="journal" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
