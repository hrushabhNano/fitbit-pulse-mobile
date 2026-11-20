// The glow design's faces (unstrap's Funnel Display and Funnel Sans, SIL OFL 1.1: assets/fonts/OFL-Funnel.txt), as
// static instances of the variable fonts: React Native picks a custom font by its exact family name, one per weight.
import { FONT } from "./tokens";

export const FUNNEL_FONTS = {
  [FONT.displayLight]: require("../../assets/fonts/FunnelDisplay-Light.ttf"),
  [FONT.display]: require("../../assets/fonts/FunnelDisplay-Regular.ttf"),
  [FONT.displayMedium]: require("../../assets/fonts/FunnelDisplay-Medium.ttf"),
  [FONT.displaySemibold]: require("../../assets/fonts/FunnelDisplay-SemiBold.ttf"),
  [FONT.sans]: require("../../assets/fonts/FunnelSans-Regular.ttf"),
  [FONT.sansMedium]: require("../../assets/fonts/FunnelSans-Medium.ttf"),
  [FONT.sansSemibold]: require("../../assets/fonts/FunnelSans-SemiBold.ttf"),
  [FONT.sansBold]: require("../../assets/fonts/FunnelSans-Bold.ttf"),
} as const;
