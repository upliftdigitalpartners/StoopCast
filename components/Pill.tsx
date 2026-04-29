import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { radius, typography, useColors, type ColorTokens } from "@/lib/theme";

export function Pill({
  label, tone = "neutral", style,
}: {
  label: string;
  tone?: "neutral" | "live" | "warn" | "claimed" | "primary";
  style?: ViewStyle;
}) {
  const colors = useColors();
  const palette = {
    neutral: { bg: colors.bg,            fg: colors.muted, border: colors.border },
    live:    { bg: colors.liveSurface,   fg: colors.success, border: colors.liveBorder },
    warn:    { bg: colors.warnSurface,   fg: colors.warn,    border: colors.warnBorder },
    claimed: { bg: colors.bg,            fg: colors.muted, border: colors.border },
    primary: { bg: colors.primarySurface,fg: colors.primaryDark, border: colors.primaryBorder },
  }[tone];

  return (
    <View style={[
      styles.pill,
      { backgroundColor: palette.bg, borderColor: palette.border },
      style,
    ]}>
      <Text style={[styles.text, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: { ...typography.tiny, textTransform: "uppercase" },
});

// Suppress unused import warning by referencing the type (no-op).
type _ = ColorTokens;
