import { useState, type ComponentProps, type ReactNode } from "react";
import { StyleSheet, Text as RNText, View, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { Canvas, RadialGradient, RoundedRect, vec } from "@shopify/react-native-skia";
import { ChevronRight, Info, type LucideIcon } from "lucide-react-native";
import { Press } from "@/ui/Press";
import { Pressed } from "./Pressed";
import { INK, LAYOUT, SURFACE, TYPE, WHITE, type Ink } from "./tokens";

type Role = keyof typeof TYPE;

/** Text in one of the type roles (spec 2.3), white unless the role or `color` says otherwise. */
export function GText({ kind = "body", color, style, ...props }: ComponentProps<typeof RNText> & { kind?: Role; color?: string }) {
  return <RNText {...props} style={[{ color: "#FFFFFF" }, TYPE[kind] as TextStyle, color ? { color } : null, style]} />;
}

/** The 14 dp caret after a card title that opens something (spec 2.5, Tappable says so). */
export const Caret = ({ dim = 0.5, size = 14 }: { dim?: number; size?: number }) => (
  <ChevronRight size={size} color={`rgba(255,255,255,${dim})`} strokeWidth={2} />
);

/** The round (i) on a card that has an explanation. */
export function InfoButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Press
      activeScale={0.94}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center" }}
    >
      <Info size={16} color={WHITE.secondary} strokeWidth={1.75} />
    </Press>
  );
}

/** A card's title row: the title with its caret when the card opens something, then a note or (i) at the right. */
export function CardTitle({ title, opens, note, right }: { title: string; opens?: boolean; note?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 1, gap: 6 }}>
        <GText kind="cardTitle" numberOfLines={1} style={{ flexShrink: 1 }}>
          {title}
        </GText>
        {opens && <Caret />}
      </View>
      <View style={{ flex: 1 }} />
      {note ? (
        <GText kind="secondary" numberOfLines={1}>
          {note}
        </GText>
      ) : null}
      {right}
    </View>
  );
}

/** News next to a number: a filled pill, white at 12%, Caption type in white (spec 2.5, Tags). */
export function Tag({ text }: { text: string }) {
  return (
    <View style={{ backgroundColor: WHITE.tag, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" }}>
      <GText kind="caption" color="#FFFFFF">
        {text}
      </GText>
    </View>
  );
}

/** A tag about the data, not your body ("Provisional", "Partial day"): outlined, beside the title. */
export function OutlineTag({ text }: { text: string }) {
  return (
    <View
      style={{ borderColor: "rgba(255,255,255,0.24)", borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, alignSelf: "flex-start" }}
    >
      <GText kind="caption">{text}</GText>
    </View>
  );
}

/** Where a picture card's L2 rim lights, as fractions of the card, and how far it reaches. */
export type Rim = { x: number; y: number; reach?: number };

function RimLight({ rim, ink, w, h }: { rim: Rim; ink: string; w: number; h: number }) {
  const r = LAYOUT.cardCorner;
  const reach = Math.max(1, (rim.reach ?? 0.6) * w);
  const c = vec(rim.x * w, rim.y * h);
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <RoundedRect x={0} y={0} width={w} height={h} r={r}>
        <RadialGradient c={c} r={reach * 0.7} colors={[`${ink}21`, `${ink}00`]} />
      </RoundedRect>
      <RoundedRect x={1} y={1} width={w - 2} height={h - 2} r={r - 1} style="stroke" strokeWidth={2}>
        <RadialGradient c={c} r={reach} colors={[ink, `${ink}59`, `${ink}00`]} positions={[0, 0.5, 1]} />
      </RoundedRect>
    </Canvas>
  );
}

/**
 * The picture card (spec 2.5): near-black with a hairline, the metric's picture in its ink, the number in white dots.
 * Off your normal it lights the L2 rim next to the part of the picture that is off (`rim`), and says so in a tag.
 */
export function PictureCard({
  children,
  onPress,
  ink,
  rim,
  style,
  height,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  ink?: Ink;
  rim?: Rim | null;
  style?: StyleProp<ViewStyle>;
  height?: number;
  accessibilityLabel?: string;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  return (
    <Pressed
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={[
        { backgroundColor: SURFACE.card, borderRadius: LAYOUT.cardCorner, borderWidth: 1, borderColor: WHITE.hairline, height, overflow: "hidden" },
        style,
      ]}
    >
      <View onLayout={rim ? onLayout : undefined} style={{ flex: 1, padding: LAYOUT.cardPadding - 1 }}>
        {rim && ink && size && <RimLight rim={rim} ink={INK[ink]} w={size.w} h={size.h} />}
        {children}
      </View>
    </Pressed>
  );
}

/** A strip (spec 2.4): full width, 68 dp, a state or an action. Unlit. */
export function Strip({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <Pressed
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          backgroundColor: SURFACE.card,
          borderRadius: LAYOUT.cardCorner,
          borderWidth: 1,
          borderColor: WHITE.hairline,
          minHeight: LAYOUT.strip,
          paddingHorizontal: LAYOUT.cardPadding,
          justifyContent: "center",
        },
        style,
      ]}
    >
      {children}
    </Pressed>
  );
}

/** A grouped list (spec 2.5): the List surface, a title row, then rows. */
export function ListPanel({ title, note, onNote, children }: { title?: string; note?: string; onNote?: () => void; children: ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: SURFACE.list,
        borderRadius: LAYOUT.cardCorner,
        borderWidth: 1,
        borderColor: WHITE.divider,
        paddingHorizontal: LAYOUT.cardPadding,
        paddingTop: title ? LAYOUT.cardPadding : 6,
        paddingBottom: 6,
      }}
    >
      {title ? (
        <Pressed onPress={onNote} style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <GText kind="cardTitle" style={{ flex: 1 }}>
              {title}
            </GText>
            {note ? <GText kind="secondary">{note}</GText> : null}
            {note && onNote ? <Caret dim={0.5} /> : null}
          </View>
        </Pressed>
      ) : null}
      {children}
    </View>
  );
}

/**
 * A list row (spec 2.5): the metric's icon in its ink, the name with its status under it, the value as plain Row value
 * text, and the caret when the row opens something. Off your normal the status becomes the off tag.
 */
export function ListRow({
  icon,
  ink,
  name,
  status,
  value,
  unit,
  tag,
  onPress,
  first,
  waiting,
}: {
  icon?: LucideIcon;
  ink?: Ink;
  name: string;
  status?: string | null;
  value?: string | null;
  unit?: string;
  tag?: string | null;
  onPress?: () => void;
  first?: boolean;
  waiting?: boolean;
}) {
  const Icon = icon;
  return (
    <Pressed onPress={onPress} accessibilityLabel={[name, value, unit].filter(Boolean).join(" ")}>
      <View
        style={{ flexDirection: "row", alignItems: "center", paddingVertical: LAYOUT.rowPadding, borderTopWidth: first ? 0 : 1, borderTopColor: WHITE.divider }}
      >
        {Icon && (
          <View style={{ marginRight: 14, opacity: waiting ? 0.3 : 1 }}>
            <Icon size={20} color={ink ? INK[ink] : WHITE.secondary} strokeWidth={1.5} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <GText kind="body" numberOfLines={1}>
            {name}
          </GText>
          {tag ? (
            <View style={{ marginTop: 4 }}>
              <Tag text={tag} />
            </View>
          ) : status ? (
            <GText kind="secondary" numberOfLines={1}>
              {status}
            </GText>
          ) : null}
        </View>
        {value != null && (
          <View style={{ flexDirection: "row", alignItems: "baseline", marginLeft: 12 }}>
            <GText kind="rowValue" color={waiting ? WHITE.waiting : undefined}>
              {value}
            </GText>
            {unit ? (
              <GText kind="secondary" style={{ marginLeft: 4 }}>
                {unit}
              </GText>
            ) : null}
          </View>
        )}
        {onPress && (
          <View style={{ marginLeft: 8 }}>
            <Caret dim={0.3} />
          </View>
        )}
      </View>
    </Pressed>
  );
}

/** A contributor row (What drove it): name, a bar of how it sits, and its word or off tag. No icon. */
export function ContributorRow({
  name,
  share,
  word,
  tag,
  onPress,
  first,
}: {
  name: string;
  share: number | null;
  word: string;
  tag?: string | null;
  onPress?: () => void;
  first?: boolean;
}) {
  const s = share === null ? 0 : Math.min(1, Math.max(0.04, share));
  return (
    <Pressed onPress={onPress} accessibilityLabel={`${name}, ${tag ?? word}`}>
      <View style={{ paddingVertical: LAYOUT.rowPadding, borderTopWidth: first ? 0 : 1, borderTopColor: WHITE.divider }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <GText kind="body" style={{ flex: 1 }} numberOfLines={1}>
            {name}
          </GText>
          {onPress && <Caret dim={0.3} />}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 14 }}>
          <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <View style={{ width: `${s * 100}%`, height: 6, borderRadius: 3, backgroundColor: share === null ? "transparent" : "rgba(255,255,255,0.8)" }} />
          </View>
          {tag ? <Tag text={tag} /> : <GText kind="secondary">{word}</GText>}
        </View>
      </View>
    </Pressed>
  );
}

/** Rows of the grid (spec 2.4): Smalls in pairs side by side, with the gap between. */
export function Pair({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", gap: LAYOUT.gap }}>{children}</View>;
}

/** A Small: one unit high, half the row. */
export const SMALL: ViewStyle = { flex: 1, minWidth: 0, height: LAYOUT.unit };
