// Each metric's own picture (spec 2.7): drawn solid in the metric's ink, never dotted or dashed (only digits are dots),
// your normal as a dim band of the ink, a gap in the data left open. Each picture measures its width and draws its Skia
// part (a *Draw component) inside its own canvas.

import { useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { Canvas, Circle, Group, Line, Path, Rect, RoundedRect, Skia, vec } from "@shopify/react-native-skia";
import { INK, TYPE, WHITE } from "./tokens";

/** The width a picture is laid out at, 0 until measured. */
function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(e.nativeEvent.layout.width)];
}

const hexA = (hex: string, a: number) =>
  `${hex.slice(0, 7)}${Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, "0")}`;

// ── Trend dots ──────────────────────────────────────────────────────────────

function TrendDotsDraw({ values, w, height, color }: { values: (number | null)[]; w: number; height: number; color: string }) {
  const n = values.length;
  const known = values.filter((v): v is number => v !== null);
  if (n === 0 || known.length === 0) return null;
  const lo = Math.min(...known);
  const hi = Math.max(...known);
  const pad = 10;
  const x = (i: number) => (n === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (n - 1));
  const y = (v: number) => (hi === lo ? height / 2 : height - 8 - ((v - lo) / (hi - lo)) * (height - 16));
  const path = Skia.Path.Make();
  let open = false;
  values.forEach((v, i) => {
    if (v === null) {
      open = false;
      return;
    }
    if (!open) path.moveTo(x(i), y(v));
    else path.lineTo(x(i), y(v));
    open = true;
  });
  return (
    <Group>
      <Path path={path} style="stroke" strokeWidth={1.5} color={hexA(color, 0.35)} />
      {values.map((v, i) =>
        v === null ? null : i === n - 1 ? (
          <Group key={i}>
            <Circle cx={x(i)} cy={y(v)} r={9} color={hexA(color, 0.25)} />
            <Circle cx={x(i)} cy={y(v)} r={6} color={color} />
          </Group>
        ) : (
          <Circle key={i} cx={x(i)} cy={y(v)} r={3.5} color={hexA(color, 0.55)} />
        ),
      )}
    </Group>
  );
}

/** Trend dots (the Recovery hero's last 7 days): a dot a day joined by a thin line, today the only full dot. */
export function TrendDots({ values, height = 36, color = "#FFFFFF" }: { values: (number | null)[]; height?: number; color?: string }) {
  const [w, onLayout] = useWidth();
  return (
    <View style={{ height, alignSelf: "stretch" }} onLayout={onLayout}>
      {w > 0 && (
        <Canvas style={{ width: w, height }} pointerEvents="none">
          <TrendDotsDraw values={values} w={w} height={height} color={color} />
        </Canvas>
      )}
    </View>
  );
}

// ── Sleep stages ────────────────────────────────────────────────────────────

export type Stage = "awake" | "rem" | "light" | "deep";
export const STAGE_INK: Record<Stage, string> = { deep: INK.sleepDeep, light: INK.sleepLight, rem: INK.sleepRem, awake: INK.sleepAwake };

function StageBarDraw({ parts, w, height }: { parts: { stage: Stage; minutes: number }[]; w: number; height: number }) {
  const total = parts.reduce((s, p) => s + p.minutes, 0);
  if (total <= 0) return <RoundedRect x={0} y={0} width={w} height={height} r={height / 2} color={WHITE.hairline} />;
  const gap = 2;
  const shown = parts.filter((p) => p.minutes > 0);
  const room = w - gap * (shown.length - 1);
  const widthOf = (p: { minutes: number }) => Math.max(2, (p.minutes / total) * room);
  const xs = shown.reduce<number[]>((acc, _p, i) => [...acc, i === 0 ? 0 : acc[i - 1] + widthOf(shown[i - 1]) + gap], []);
  return (
    <Group>
      {shown.map((p, i) => (
        <RoundedRect key={p.stage} x={xs[i]} y={0} width={widthOf(p)} height={height} r={height / 2} color={STAGE_INK[p.stage]} />
      ))}
    </Group>
  );
}

/** One 8 dp bar split by stage, in the stage colours (the sleep hero, Last night). */
export function StageBar({ parts, height = 8 }: { parts: { stage: Stage; minutes: number }[]; height?: number }) {
  const [w, onLayout] = useWidth();
  return (
    <View style={{ height, alignSelf: "stretch" }} onLayout={onLayout}>
      {w > 0 && (
        <Canvas style={{ width: w, height }} pointerEvents="none">
          <StageBarDraw parts={parts} w={w} height={height} />
        </Canvas>
      )}
    </View>
  );
}

const STAGE_ROW: Record<Stage, number> = { awake: 0, rem: 1, light: 2, deep: 3 };
type Segment = { stage: Stage; start: number; end: number };

function HypnogramDraw({ segments, from, to, w, height }: { segments: Segment[]; from: number; to: number; w: number; height: number }) {
  const span = Math.max(1, to - from);
  const row = height / 4;
  const band = Math.min(14, row * 0.62);
  return (
    <Group>
      {[0, 1, 2, 3].map((r) => (
        <Line key={r} p1={vec(0, r * row + row / 2)} p2={vec(w, r * row + row / 2)} color={WHITE.hairline} strokeWidth={1} />
      ))}
      {segments.map((s, i) => {
        const x = ((s.start - from) / span) * w;
        const sw = Math.max(1.5, ((s.end - s.start) / span) * w);
        const y = STAGE_ROW[s.stage] * row + (row - band) / 2;
        return <RoundedRect key={i} x={x} y={y} width={sw} height={band} r={Math.min(band / 2, sw / 2)} color={STAGE_INK[s.stage]} />;
      })}
    </Group>
  );
}

/** The hypnogram: solid rounded bands in the stage colours on four hairlines (Sleep's hero). */
export function Hypnogram({ segments, from, to, height = 96 }: { segments: Segment[]; from: number; to: number; height?: number }) {
  const [w, onLayout] = useWidth();
  return (
    <View style={{ height, alignSelf: "stretch" }} onLayout={onLayout}>
      {w > 0 && (
        <Canvas style={{ width: w, height }} pointerEvents="none">
          <HypnogramDraw segments={segments} from={from} to={to} w={w} height={height} />
        </Canvas>
      )}
    </View>
  );
}

// ── Lines and levels ────────────────────────────────────────────────────────

type DayLineProps = { xs: number[]; ys: (number | null)[]; from?: number; to?: number; band?: [number, number] | null; color: string; height?: number };

function DayLineDraw({ xs, ys, from = 0, to = 1440, band, color, w, height }: DayLineProps & { w: number; height: number }) {
  const known = ys.filter((v): v is number => v !== null);
  if (known.length < 2) return null;
  let lo = Math.min(...known, ...(band ? [band[0]] : []));
  let hi = Math.max(...known, ...(band ? [band[1]] : []));
  if (hi - lo < 1) {
    hi += 1;
    lo -= 1;
  }
  const X = (m: number) => ((m - from) / Math.max(1, to - from)) * w;
  const Y = (v: number) => height - 3 - ((v - lo) / (hi - lo)) * (height - 6);
  const path = Skia.Path.Make();
  let open = false;
  xs.forEach((m, i) => {
    const v = ys[i];
    if (v === null || v === undefined) {
      open = false;
      return;
    }
    if (!open) path.moveTo(X(m), Y(v));
    else path.lineTo(X(m), Y(v));
    open = true;
  });
  return (
    <Group>
      {band && <Rect x={0} y={Y(band[1])} width={w} height={Math.max(1, Y(band[0]) - Y(band[1]))} color={hexA(color, 0.12)} />}
      <Path path={path} style="stroke" strokeWidth={2} strokeJoin="round" strokeCap="round" color={color} />
    </Group>
  );
}

/** A day's line through your normal band (Heart rate's Small): the line in the ink, the band at 12%, a gap left open. */
export function DayLine(props: DayLineProps) {
  const height = props.height ?? 56;
  const [w, onLayout] = useWidth();
  return (
    <View style={{ height, alignSelf: "stretch" }} onLayout={onLayout}>
      {w > 0 && (
        <Canvas style={{ width: w, height }} pointerEvents="none">
          <DayLineDraw {...props} w={w} height={height} />
        </Canvas>
      )}
    </View>
  );
}

type LevelProps = { value: number; max: number; usual?: [number, number] | null; color: string; height?: number };

function LevelBarDraw({ value, max, usual, color, w, height }: LevelProps & { w: number; height: number }) {
  const k = (v: number) => Math.min(1, Math.max(0, v / Math.max(1e-9, max))) * w;
  const bar = 6;
  const y = (height - bar) / 2;
  return (
    <Group>
      <RoundedRect x={0} y={y} width={w} height={bar} r={bar / 2} color={WHITE.hairline} />
      {usual && (
        <RoundedRect x={k(usual[0])} y={y - 3} width={Math.max(2, k(usual[1]) - k(usual[0]))} height={bar + 6} r={(bar + 6) / 2} color={hexA(color, 0.18)} />
      )}
      <RoundedRect x={0} y={y} width={Math.max(bar, k(value))} height={bar} r={bar / 2} color={color} />
      <Circle cx={Math.max(bar / 2, k(value) - bar / 2)} cy={height / 2} r={5} color="#FFFFFF" />
    </Group>
  );
}

/** A level fill over your usual band (Load, Steps): a bar filling to the value, a dot at its end. */
export function LevelBar(props: LevelProps) {
  const height = props.height ?? 16;
  const [w, onLayout] = useWidth();
  return (
    <View style={{ height, alignSelf: "stretch" }} onLayout={onLayout}>
      {w > 0 && (
        <Canvas style={{ width: w, height }} pointerEvents="none">
          <LevelBarDraw {...props} w={w} height={height} />
        </Canvas>
      )}
    </View>
  );
}

function DayStripDraw({ values, color, w, height }: { values: (number | null)[]; color: string; w: number; height: number }) {
  const cw = w / Math.max(1, values.length);
  return (
    <Group clip={Skia.RRectXY(Skia.XYWHRect(0, 0, w, height), height / 2, height / 2)}>
      <Rect x={0} y={0} width={w} height={height} color={WHITE.hairline} />
      {values.map((v, i) =>
        v === null ? null : (
          <Rect key={i} x={i * cw} y={0} width={cw + 0.5} height={height} color={hexA(color, 0.15 + 0.85 * Math.min(1, Math.max(0, v / 100)))} />
        ),
      )}
    </Group>
  );
}

/** The day as one rounded strip, each stretch's level as the ink's strength (Stress). */
export function DayStrip({ values, color, height = 18 }: { values: (number | null)[]; color: string; height?: number }) {
  const [w, onLayout] = useWidth();
  return (
    <View style={{ height, alignSelf: "stretch" }} onLayout={onLayout}>
      {w > 0 && (
        <Canvas style={{ width: w, height }} pointerEvents="none">
          <DayStripDraw values={values} color={color} w={w} height={height} />
        </Canvas>
      )}
    </View>
  );
}

// ── Week rings ──────────────────────────────────────────────────────────────

function RingDraw({ share, size, color }: { share: number; size: number; color: string }) {
  const r = size / 2 - 3;
  const arc = Skia.Path.Make();
  if (share > 0) arc.addArc(Skia.XYWHRect(3, 3, size - 6, size - 6), -90, share >= 1 ? 359.9 : share * 360);
  return (
    <Group>
      <Circle cx={size / 2} cy={size / 2} r={r} style="stroke" strokeWidth={3} color={WHITE.hairline} />
      {share > 0 && <Path path={arc} style="stroke" strokeWidth={3} strokeCap="round" color={color} />}
      {share >= 1 && <Circle cx={size / 2} cy={size / 2} r={r - 4} color={hexA(color, 0.25)} />}
    </Group>
  );
}

/** A week of rings, one a day, full at goal (Your week). */
export function WeekRings({ days, color, size = 28 }: { days: { label: string; share: number | null; today?: boolean }[]; color: string; size?: number }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      {days.map((d, i) => (
        <View key={i} style={{ alignItems: "center", gap: 6 }}>
          <Canvas style={{ width: size, height: size }} pointerEvents="none">
            <RingDraw share={d.share === null ? 0 : Math.min(1, Math.max(0, d.share))} size={size} color={color} />
          </Canvas>
          <Text style={[TYPE.caption, d.today ? { color: "#FFFFFF" } : null]}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Bed and wake ────────────────────────────────────────────────────────────

type Night = { bed: number; wake: number; typicalBed: number | null; typicalWake: number | null } | null;

function NightBarsDraw({ nights, color, w, height }: { nights: Night[]; color: string; w: number; height: number }) {
  const known = nights.filter((n): n is NonNullable<Night> => n !== null);
  if (!known.length) return null;
  const lo = Math.min(...known.map((n) => n.bed)) - 30;
  const hi = Math.max(...known.map((n) => n.wake)) + 30;
  const Y = (m: number) => ((m - lo) / Math.max(1, hi - lo)) * height;
  const slot = w / nights.length;
  const bw = Math.min(14, slot * 0.4);
  const last = known[known.length - 1];
  return (
    <Group>
      {last.typicalBed !== null && <Rect x={0} y={Y(last.typicalBed) - 6} width={w} height={12} color={hexA(color, 0.12)} />}
      {last.typicalWake !== null && <Rect x={0} y={Y(last.typicalWake) - 6} width={w} height={12} color={hexA(color, 0.12)} />}
      {nights.map((n, i) =>
        n === null ? null : (
          <RoundedRect key={i} x={i * slot + (slot - bw) / 2} y={Y(n.bed)} width={bw} height={Math.max(bw, Y(n.wake) - Y(n.bed))} r={bw / 2} color={color} />
        ),
      )}
    </Group>
  );
}

/** Bed and wake bars (Regularity): a bar a night from bed to wake against dim bands at your usual times. */
export function NightBars({ nights, color, height = 64 }: { nights: Night[]; color: string; height?: number }) {
  const [w, onLayout] = useWidth();
  return (
    <View style={{ height, alignSelf: "stretch" }} onLayout={onLayout}>
      {w > 0 && (
        <Canvas style={{ width: w, height }} pointerEvents="none">
          <NightBarsDraw nights={nights} color={color} w={w} height={height} />
        </Canvas>
      )}
    </View>
  );
}
