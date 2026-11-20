import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Press } from "@/ui/Press";

/**
 * A card or row that opens something: pressed, it scales to 0.98 (spec 3.5), no ripple. Without `onPress` it is a plain
 * view, so a card that opens nothing doesn't pretend to.
 */
export function Pressed({
  onPress,
  children,
  style,
  accessibilityLabel,
}: {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Press activeScale={0.98} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={style}>
      {children}
    </Press>
  );
}
