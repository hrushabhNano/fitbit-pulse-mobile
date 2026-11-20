import { memo, useMemo } from "react";
import { Text as RNText, View, type StyleProp, type ViewStyle } from "react-native";
import { Canvas, Circle, Group } from "@shopify/react-native-skia";
import { DOT_SIZE, dotFitScale, dotLayout, type DotSize } from "./dotFont";
import { TYPE, WHITE } from "./tokens";

/**
 * A number drawn as round dots, like an LED matrix (spec 2.3): one of the six dot sizes for where it sits. Digits, `.`,
 * `,`, `:`, `-`, `−`, `+`, `k` and `%` have glyphs; anything else draws as a space. `maxWidth` shrinks it to fit.
 */
export const DotText = memo(function DotText({
  text,
  size = "edge",
  color = "#FFFFFF",
  maxWidth,
  style,
}: {
  text: string;
  size?: DotSize;
  color?: string;
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const base = DOT_SIZE[size];
  const dot = maxWidth ? base * dotFitScale(text, base, maxWidth) : base;
  const layout = useMemo(() => dotLayout(text, dot), [text, dot]);
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={text} style={[{ width: layout.width, height: layout.height }, style]}>
      <Canvas style={{ width: layout.width, height: layout.height }} pointerEvents="none">
        <Group color={color}>
          {layout.centers.map((c, i) => (
            <Circle key={i} cx={c.x} cy={c.y} r={layout.radius} />
          ))}
        </Group>
      </Canvas>
    </View>
  );
});

/**
 * A card's one dotted number with the word after it on the digits' baseline, in Body at 72% (spec 2.3): "42 min",
 * "78 bpm". A blank unit leaves the number alone.
 */
export function HeroValue({
  value,
  unit,
  size = "hero",
  gap = 8,
  maxWidth,
}: {
  value: string;
  unit?: string;
  size?: DotSize;
  gap?: number;
  maxWidth?: number;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
      <DotText text={value} size={size} maxWidth={maxWidth} />
      {unit ? (
        <RNText numberOfLines={2} style={[TYPE.body, { color: WHITE.secondary, marginLeft: gap, flexShrink: 1, marginBottom: -3 }]}>
          {unit}
        </RNText>
      ) : null}
    </View>
  );
}
