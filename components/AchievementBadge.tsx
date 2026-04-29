import { StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow, typography } from "@/lib/theme";
import type { Achievement } from "@/lib/achievements";

export function AchievementBadge({ a }: { a: Achievement }) {
  return (
    <View style={[styles.card, a.earned ? styles.on : styles.off, a.earned && shadow(1)]}>
      <Text style={[styles.emoji, !a.earned && { opacity: 0.4 }]}>{a.emoji}</Text>
      <Text style={[styles.name, !a.earned && { color: colors.muted }]} numberOfLines={1}>
        {a.name}
      </Text>
      <Text style={styles.hint} numberOfLines={2}>{a.hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 110,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
  },
  on:  { backgroundColor: colors.bgElevated, borderColor: colors.primary },
  off: { backgroundColor: colors.bg, borderColor: colors.border, opacity: 0.85 },
  emoji: { fontSize: 30 },
  name: { ...typography.smallStrong, color: colors.text, textAlign: "center" },
  hint: { ...typography.tiny, color: colors.muted, textAlign: "center", textTransform: "none", fontWeight: "400" },
});
