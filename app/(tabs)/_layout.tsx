import { Tabs } from "expo-router";
import { GlowTabBar } from "@/glow/Frame";
import { SURFACE } from "@/glow/tokens";

// The bottom tabs of the glow design (src/glow, unstrap's design v2 § 3.2): Today, Recovery, Sleep, Activity, in a
// floating pill with a fade behind it. Health, Journal and More open from You (the avatar), as pages over the tabs.
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlowTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: SURFACE.page }, animation: "fade" }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tab-recovery" />
      <Tabs.Screen name="tab-sleep" />
      <Tabs.Screen name="tab-activity" />
    </Tabs>
  );
}
