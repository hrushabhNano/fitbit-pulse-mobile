// The opening: takes over from the native splash screen, beats the Pulse Glow mark once (the heartbeat in dots, a warm
// glow behind it that swells and goes), then fades to the first screen.
//
// Its first frame is the native splash: the expo-splash-screen plugin (app.json) centres a square `imageWidth` box on
// black, the mark spanning the box's width (assets/images/splash-icon.png, written by scripts/brand/glow-icon.py from
// src/glow/mark.ts). This overlay draws the same box at the window's centre, so the native splash hides with no fade
// over an identical picture. With reduce motion the overlay never shows: the native splash hands straight over.
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { markDots } from "@/glow/mark";
import { INK } from "@/glow/tokens";

/** app.json's expo-splash-screen `backgroundColor` and `imageWidth`. */
const GROUND = "#000000";
const MARK = 160;
const DOTS = markDots(MARK);

/** One beat: the mark swells 6 % and settles; the glow peaks with it and is gone before the fade ends. */
const EASE = Easing.bezier(0.37, 0, 0.63, 1);
const OUT_MS = 168;
const BACK_MS = 216;
const GLOW_PEAK_MS = 216;
const GLOW_PEAK = 0.7;
/** The overlay fades as the beat settles: 520 ms in, 300 ms long, so the whole opening is 820 ms. */
const FADE_AT_MS = 520;
const FADE_MS = 300;
const GLOW = MARK * 1.6;

/** Mounted over the app from the first render; `ready` is when the app below can paint its first screen. */
export function Opening({ ready }: { ready: boolean }) {
  const reduce = useReducedMotion();
  const [laidOut, setLaidOut] = useState(false);
  const [done, setDone] = useState(false);
  const beat = useSharedValue(0);
  const glow = useSharedValue(0);
  const shown = useSharedValue(1);

  useEffect(() => {
    if (!ready || !laidOut) return;
    // The overlay is on screen under the native splash: the splash goes at once (no fade, app/_layout.tsx), the picture
    // does not change.
    SplashScreen.hide();
    if (reduce) return;
    beat.value = withSequence(withTiming(1, { duration: OUT_MS, easing: EASE }), withTiming(0, { duration: BACK_MS, easing: EASE }));
    glow.value = withSequence(withTiming(1, { duration: GLOW_PEAK_MS, easing: EASE }), withTiming(0, { duration: FADE_AT_MS + FADE_MS - GLOW_PEAK_MS, easing: EASE }));
    shown.value = withDelay(
      FADE_AT_MS,
      withTiming(0, { duration: FADE_MS, easing: Easing.bezier(0.2, 0, 0, 1) }, (finished) => {
        if (finished) runOnJS(setDone)(true);
      }),
    );
  }, [ready, laidOut, reduce, beat, glow, shown]);

  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.06 * beat.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: GLOW_PEAK * glow.value, transform: [{ scale: 1 + 0.06 * glow.value }] }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: shown.value }));

  if (done || (reduce && ready && laidOut)) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={() => setLaidOut(true)}
      style={[StyleSheet.absoluteFill, { backgroundColor: GROUND, alignItems: "center", justifyContent: "center" }, overlayStyle]}
    >
      <Animated.View style={[{ position: "absolute", width: GLOW, height: GLOW }, glowStyle]}>
        <Svg width={GLOW} height={GLOW}>
          <Defs>
            <RadialGradient id="opening-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={INK.energy} stopOpacity={1} />
              <Stop offset="0.55" stopColor={INK.energy} stopOpacity={0.35} />
              <Stop offset="1" stopColor={INK.energy} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#opening-glow)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ width: MARK, height: MARK, justifyContent: "center" }, markStyle]}>
        <Svg width={MARK} height={DOTS.reduce((h, d) => Math.max(h, d.y + d.r), 0)}>
          {DOTS.map((d) => (
            <Circle key={`${d.x},${d.y}`} cx={d.x} cy={d.y} r={d.r} fill="#ffffff" />
          ))}
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
