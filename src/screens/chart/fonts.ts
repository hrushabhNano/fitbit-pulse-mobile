// Funnel Display (numerals) and Funnel Sans (words) as Skia fonts for the chart explorer, whose axes and readout are drawn on the
// UI thread inside the canvas (our other charts lay RN <Text> over theirs; a chart that pans every frame can't). From
// halo src/ui/components/ChartFrame.tsx's typeface loader: the same TTFs expo-font registers, read once.
import { useEffect, useSyncExternalStore } from "react";
import { loadData, Skia, type SkFont, type SkTypeface } from "@shopify/react-native-skia";
import { FUNNEL_FONTS } from "@/glow/fonts";
import { FONT } from "@/glow/tokens";

export type FaceWeight = 500 | 600 | 700;
export type ChartFonts = { num: (weight: FaceWeight, size: number) => SkFont; sans: (weight: FaceWeight, size: number) => SkFont };

const SOURCES = {
  n500: FUNNEL_FONTS[FONT.displayMedium],
  n600: FUNNEL_FONTS[FONT.displaySemibold],
  n700: FUNNEL_FONTS[FONT.displaySemibold],
  s500: FUNNEL_FONTS[FONT.sansMedium],
  s600: FUNNEL_FONTS[FONT.sansSemibold],
  s700: FUNNEL_FONTS[FONT.sansBold],
} as const;
type FaceKey = keyof typeof SOURCES;
const KEYS = Object.keys(SOURCES) as FaceKey[];

let faces: Record<FaceKey, SkTypeface> | null = null;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

function loadFaces(): Promise<void> {
  if (faces) return Promise.resolve();
  if (!pending)
    pending = Promise.all(KEYS.map((k) => loadData<SkTypeface>(SOURCES[k], (d) => Skia.Typeface.MakeFreeTypeFaceFromData(d))))
      .then((list) => {
        if (list.some((t) => !t)) throw new Error("A chart typeface did not load");
        faces = Object.fromEntries(KEYS.map((k, i) => [k, list[i]])) as Record<FaceKey, SkTypeface>;
        listeners.forEach((l) => l());
      })
      .catch(() => {
        // A failed read retries on the next mount.
        pending = null;
      });
  return pending;
}

const cache = new Map<string, SkFont>();
function fontOf(face: FaceKey, size: number): SkFont {
  const key = `${face}:${size}`;
  let f = cache.get(key);
  if (!f) {
    f = Skia.Font(faces![face], size);
    cache.set(key, f);
  }
  return f;
}
const FONTS: ChartFonts = { num: (w, s) => fontOf(`n${w}`, s), sans: (w, s) => fontOf(`s${w}`, s) };
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const ready = () => faces !== null;

/** The chart fonts, or null until the typefaces have loaded. */
export function useChartFonts(): ChartFonts | null {
  const ok = useSyncExternalStore(subscribe, ready, ready);
  useEffect(() => {
    if (!ok) void loadFaces();
  }, [ok]);
  return ok ? FONTS : null;
}

/** Width of `text` set in `font`. */
export const measure = (font: SkFont, text: string) => (text ? font.getTextWidth(text) : 0);
