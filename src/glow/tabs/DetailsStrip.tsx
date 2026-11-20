import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Caret, GText, Strip } from "../Parts";

/** The way from a tab into its full page (charts, trends, how it's worked out): an unlit strip. */
export function DetailsStrip({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation("glow");
  return (
    <Strip onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <GText kind="body">{t("card.details")}</GText>
          <GText kind="secondary">{t("card.detailsNote")}</GText>
        </View>
        <Caret dim={0.5} size={18} />
      </View>
    </Strip>
  );
}
