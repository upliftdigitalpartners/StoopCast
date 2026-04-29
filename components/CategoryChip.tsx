import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, shadow, typography } from "@/lib/theme";
import { categoryOf, type CategoryId } from "@/lib/categories";

export function CategoryChip({
  id,
  selected,
  onPress,
  size = "md",
}: {
  id: CategoryId | string;
  selected?: boolean;
  onPress?: () => void;
  size?: "sm" | "md";
}) {
  const c = categoryOf(id);
  const small = size === "sm";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        small && styles.chipSm,
        selected && styles.chipOn,
        selected && shadow(1),
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.emoji, small && { fontSize: 13 }]}>{c.emoji}</Text>
      <Text style={[styles.label, small && styles.labelSm, selected && styles.labelOn]}>
        {c.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1, borderColor: colors.border,
  },
  chipSm: { paddingHorizontal: 10, paddingVertical: 5 },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  emoji: { fontSize: 15 },
  label: { ...typography.smallStrong, color: colors.text },
  labelSm: { fontSize: 12 },
  labelOn: { color: "#fff" },
});
