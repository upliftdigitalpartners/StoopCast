import { StyleSheet, Text, View } from "react-native";
import { radius, shadow, typography, useColors, useStyles, type ColorTokens } from "@/lib/theme";
import type { Achievement } from "@/lib/achievements";

export function AchievementBadge({ a }: { a: Achievement }) {
  const colors = useColors();
  const styles = useStyles(mkStyles);
  return (
    <View style={[
      styles.card,
      a.earned ? { backgroundColor: colors.bgElevated, borderColor: colors.primary } :
                 { backgroundColor: colors.bg, borderColor: colors.border, opacity: 0.85 },
      a.earned && shadow(1),
    ]}>
      <Text style={[styles.emoji, !a.earned && { opacity: 0.4 }]}>{a.emoji}</Text>
      <Text style={[styles.name, !a.earned && { color: colors.muted }]} numberOfLines={1}>
        {a.name}
      </Text>
      <Text style={styles.hint} numberOfLines={2}>{a.hint}</Text>
    </View>
  );
}

const mkStyles = (c: ColorTokens) => StyleSheet.create({
  card: {
    width: 110,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
  },
  emoji: { fontSize: 30 },
  name: { ...typography.smallStrong, color: c.text, textAlign: "center" },
  hint: { ...typography.tiny, color: c.muted, textAlign: "center", textTransform: "none", fontWeight: "400" },
});
