import { useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { BlurMask, Canvas, DiffRect, FractalNoise, Group, LinearGradient, Oval, Rect, RoundedRect, rect, rrect, vec } from "@shopify/react-native-skia";
import { glowPaint, type GlowPaint, type GlowStyle, type Gradient } from "./light";
import { LAYOUT } from "./tokens";
import { useMood } from "./mood";
import { Pressed } from "./Pressed";

/** A gradient spec as a Skia shader, for the drawing it sits in. */
function Shader({ g }: { g: Gradient }) {
  return <LinearGradient start={vec(g.x0, g.y0)} end={vec(g.x1, g.y1)} colors={g.colors} positions={g.positions} />;
}

/** The light of a glow card, drawn behind its content: fill, rim, dark core, grain and the glossy hairline. */
function GlowBackground({ paint }: { paint: GlowPaint }) {
  const { width: w, height: h, radius: r } = paint;
  const card = rrect(rect(0, 0, w, h), r, r);
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group clip={card}>
        <Rect x={0} y={0} width={w} height={h}>
          <Shader g={paint.fill} />
        </Rect>
        <Group clip={paint.rimClip ? rect(paint.rimClip.x, paint.rimClip.y, paint.rimClip.width, paint.rimClip.height) : undefined}>
          {paint.rims.map((s, i) => {
            const pad = s.blur * 2 + Math.abs(s.dx) + Math.abs(s.dy) + Math.abs(s.spread) + 4;
            const hole = Math.max(0, r - s.spread);
            return (
              <DiffRect
                key={i}
                outer={rrect(rect(-pad, -pad, w + pad * 2, h + pad * 2), 0, 0)}
                inner={rrect(rect(s.spread + s.dx, s.spread + s.dy, w - s.spread * 2, h - s.spread * 2), hole, hole)}
                color={s.color}
              >
                <BlurMask blur={s.blur / 2} style="normal" />
              </DiffRect>
            );
          })}
        </Group>
        {paint.core.kind === "level" ? (
          <Rect x={-paint.coreMargin} y={-paint.coreMargin} width={w + paint.coreMargin * 2} height={h + paint.coreMargin * 2}>
            <Shader g={paint.core.gradient} />
          </Rect>
        ) : (
          <Group>
            {paint.core.tone &&
              (paint.core.shape === "radial" ? (
                <Oval rect={rect(paint.core.tone.x, paint.core.tone.y, paint.core.tone.width, paint.core.tone.height)} color={paint.core.toneColor}>
                  <BlurMask blur={paint.core.blur} style="normal" />
                </Oval>
              ) : (
                <RoundedRect
                  x={paint.core.tone.x}
                  y={paint.core.tone.y}
                  width={paint.core.tone.width}
                  height={paint.core.tone.height}
                  r={paint.core.toneRadius}
                  color={paint.core.toneColor}
                >
                  <BlurMask blur={paint.core.blur} style="normal" />
                </RoundedRect>
              ))}
            {paint.core.shape === "radial" ? (
              <Oval rect={rect(paint.core.core.x, paint.core.core.y, paint.core.core.width, paint.core.core.height)} color={paint.core.coreColor}>
                <BlurMask blur={paint.core.blur} style="normal" />
              </Oval>
            ) : (
              <RoundedRect
                x={paint.core.core.x}
                y={paint.core.core.y}
                width={paint.core.core.width}
                height={paint.core.core.height}
                r={paint.core.coreRadius}
                color={paint.core.coreColor}
              >
                <BlurMask blur={paint.core.blur} style="normal" />
              </RoundedRect>
            )}
          </Group>
        )}
        {paint.grain > 0 && (
          <Rect x={0} y={0} width={w} height={h} opacity={paint.grain * 1.6} blendMode="overlay">
            <FractalNoise freqX={0.9} freqY={0.9} octaves={2} />
          </Rect>
        )}
      </Group>
      <RoundedRect x={0.5} y={0.5} width={w - 1} height={h - 1} r={r - 0.5} color={paint.hairline} style="stroke" strokeWidth={1} />
      <RoundedRect x={0.5} y={0.5} width={w - 1} height={h - 1} r={r - 0.5} style="stroke" strokeWidth={1}>
        <Shader g={paint.gloss} />
      </RoundedRect>
    </Canvas>
  );
}

/**
 * The glow card (spec 2.5): the main card of a screen, lit from its rim with a dark core floating inside. One hero
 * (L4) per screen plus at most one second glow (L3). The screen's mood (useMood) softens it in the evening and brings
 * the light from below at night. Tapped, it scales to 0.98.
 */
export function GlowCard({
  look,
  children,
  onPress,
  style,
  minHeight,
  padding = LAYOUT.cardPadding,
  accessibilityLabel,
}: {
  look: GlowStyle;
  children?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  minHeight?: number;
  padding?: number;
  accessibilityLabel?: string;
}) {
  const mood = useMood();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const lit = useMemo(() => ({ ...look, mood }), [look, mood]);
  const paint = useMemo(() => (size ? glowPaint(lit, size.w, size.h) : null), [lit, size]);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.w - width) > 0.5 || Math.abs(size.h - height) > 0.5) setSize({ w: width, h: height });
  };
  return (
    <Pressed
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={[{ borderRadius: look.radius, overflow: "hidden", minHeight, backgroundColor: paint?.mid ?? "#0A0A0B" }, style]}
    >
      <View onLayout={onLayout} style={{ flex: 1, padding }}>
        {paint && <GlowBackground paint={paint} />}
        {children}
      </View>
    </Pressed>
  );
}
