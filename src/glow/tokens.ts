// The glow design system's tokens (unstrap docs/design/v2/spec.md § 2.2 to 2.4): each metric's one ink, the surfaces,
// the type roles and the layout numbers. Pure data, no React Native import, so it is shared by the components and the
// tests. The app is dark only in this design: everything sits on OLED black.

/** Each metric's one ink: colour says which metric it is, never how it is going (spec 2.2). */
export const INK = {
  heart: "#FF5A5F",
  steps: "#C3F53C",
  sleepDeep: "#4C6FFF",
  sleepLight: "#8FA8FF",
  sleepRem: "#B37CFF",
  sleepAwake: "#FFB547",
  spo2: "#38BDF8",
  stress: "#F062C0",
  hrv: "#2DD4BF",
  temperature: "#FF8A3D",
  /** Recovery: one teal on every surface. */
  recovery: "#7CF2C9",
  /** Energy: Ember orange on every surface, whatever the level. */
  energy: "#F66C28",
  calories: "#FFD23F",
  /** Load (Strain): violet. */
  load: "#A78BFA",
  /** Pulse Age. */
  age: "#D86BEA",
  /** The evening hero's light: a moment, not a metric. */
  evening: "#A274F2",
  /** Green and amber are for the source and the sync only, never a health value. */
  good: "#3DDC97",
  warn: "#FFB547",
} as const;
export type Ink = keyof typeof INK;

/** Surfaces and greys (spec 2.2). */
export const SURFACE = {
  page: "#000000",
  card: "#0A0A0B",
  list: "#0F0F11",
  sheet: "#141416",
  control: "#1F1F22",
} as const;

/** White at the four text strengths, and the lines. */
export const WHITE = {
  primary: "rgba(255,255,255,1)",
  secondary: "rgba(255,255,255,0.72)",
  caption: "rgba(255,255,255,0.5)",
  waiting: "rgba(255,255,255,0.3)",
  hairline: "rgba(255,255,255,0.08)",
  cardEdge: "rgba(255,255,255,0.12)",
  divider: "rgba(255,255,255,0.06)",
  tag: "rgba(255,255,255,0.12)",
} as const;

/** The font files, one family name per weight (React Native picks a custom font by its exact name). */
export const FONT = {
  displayLight: "FunnelDisplay-Light",
  display: "FunnelDisplay-Regular",
  displayMedium: "FunnelDisplay-Medium",
  displaySemibold: "FunnelDisplay-SemiBold",
  sans: "FunnelSans-Regular",
  sansMedium: "FunnelSans-Medium",
  sansSemibold: "FunnelSans-SemiBold",
  sansBold: "FunnelSans-Bold",
} as const;

type Role = { fontFamily: string; fontSize: number; lineHeight: number; letterSpacing?: number; color?: string; fontVariant?: "tabular-nums"[] };
const tabular: "tabular-nums"[] = ["tabular-nums"];

/** The type roles (spec 2.3): every text in a glow screen uses one of these. */
export const TYPE = {
  /** Every detail and settings page: Display 400, 24 on 28. */
  pageTitle: { fontFamily: FONT.display, fontSize: 24, lineHeight: 28 },
  /** The day in the moment header: Display 500, 20 on 24. */
  headerDate: { fontFamily: FONT.displayMedium, fontSize: 20, lineHeight: 24 },
  /** The moment over the header date: Sans 500, 13, at 60%. */
  moment: { fontFamily: FONT.sansMedium, fontSize: 13, lineHeight: 16, color: "rgba(255,255,255,0.6)" },
  /** Every card's title on every tier: Sans 500, 17 on 22. */
  cardTitle: { fontFamily: FONT.sansMedium, fontSize: 17, lineHeight: 22 },
  /** The sentence that leads a hero: Display 300, 20 on 24.4, three lines at most. */
  sentence: { fontFamily: FONT.displayLight, fontSize: 20, lineHeight: 24.4, letterSpacing: -0.2 },
  /** Row names, buttons, the word after a number: Sans 400, 15 on 20. */
  body: { fontFamily: FONT.sans, fontSize: 15, lineHeight: 20 },
  /** Status lines, notes: Sans 400, 13 on 18, at 72%. */
  secondary: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 18, color: WHITE.secondary },
  /** Axes, times, tags: Sans 500, 11 on 14, tabular, at 50%. */
  caption: { fontFamily: FONT.sansMedium, fontSize: 11, lineHeight: 14, color: WHITE.caption, fontVariant: tabular },
  /** A list row's value: Sans 500, 20 on 24, tabular. Plain text, never dots. */
  rowValue: { fontFamily: FONT.sansMedium, fontSize: 20, lineHeight: 24, fontVariant: tabular },
  /** A Small that breaks down the card beside it (Recharged, Drained): Display 300, 34 on 36. */
  smallValue: { fontFamily: FONT.displayLight, fontSize: 34, lineHeight: 36, letterSpacing: -0.68, fontVariant: tabular },
  /** Tab labels: Sans 500, 11. */
  tab: { fontFamily: FONT.sansMedium, fontSize: 11, lineHeight: 14 },
} as const satisfies Record<string, Role>;

/** Shape, space and grid (spec 2.4). */
export const LAYOUT = {
  cardCorner: 28,
  tileCorner: 16,
  cardPadding: 20,
  rowPadding: 14,
  gap: 12,
  gutter: 16,
  /** Smalls and Wides are a unit high; Talls two units plus the gap. */
  unit: 160,
  strip: 68,
  titleGap: 12,
  /** The tab bar pill and the fade behind it (spec 3.2). */
  tabBarHeight: 64,
  tabFade: 120,
  /** The round header buttons. */
  round: 44,
} as const;

/** Light levels: how far a hero's fill reaches (spec 2.1). */
export const MOOD = {
  day: { glow: 1, edge: 1, tone: true, belowOnly: false },
  evening: { glow: 0.8, edge: 0.9, tone: false, belowOnly: false },
  night: { glow: 0.65, edge: 0.8, tone: true, belowOnly: true },
} as const;
export type Mood = keyof typeof MOOD;

/** Where the light comes from, in degrees counterclockwise from the right edge (spec 2.5, Glow card). */
export const ANGLE = { right: 0, upperRight: 45, above: 90, upperLeft: 135, left: 180, lowerLeft: 225, below: 270, lowerRight: 315 } as const;
