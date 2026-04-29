import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, radius, typography } from "@/lib/theme";

export function Pill({
  label,
  tone = "neutral",
  style,
}: {
  label: string;
  tone?: "neutral" | "live" | "warn" | "claimed" | "primary";
  style?: ViewStyle;
}) {
  const palette = {
    neutral: { bg: colors.bg, fg: colors.muted, border: colors.border },
    live: { bg: "#e8f5ee", fg: colors.success, border: "#bfe5cf" },
    warn: { bg: "#fff5e6", fg: colors.warn, border: "#f4d9aa" },
    claimed: { bg: "#f0f0f0", fg: colors.muted, border: colors.border },
    primary: { bg: "#fde8e3", fg: colors.primaryDark, border: "#f5c5b8" },
  }[tone];

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.border }, style]}>
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
