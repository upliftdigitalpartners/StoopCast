import { Pressable, StyleSheet, Text } from "react-native";
import { radius, shadow, typography, useColors, useStyles, type ColorTokens } from "@/lib/theme";
import { categoryOf, type CategoryId } from "@/lib/categories";

export function CategoryChip({
  id, selected, onPress, size = "md",
}: {
  id: CategoryId | string;
  selected?: boolean;
  onPress?: () => void;
  size?: "sm" | "md";
}) {
  const c = categoryOf(id);
  const small = size === "sm";
  const colors = useColors();
  const styles = useStyles(mkStyles);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        small && styles.chipSm,
        selected && { backgroundColor: colors.primary, borderColor: colors.primary },
        selected && shadow(1),
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.emoji, small && { fontSize: 13 }]}>{c.emoji}</Text>
      <Text style={[styles.label, small && styles.labelSm, selected && { color: "#fff" }]}>
        {c.label}
      </Text>
    </Pressable>
  );
}

const mkStyles = (c: ColorTokens) => StyleSheet.create({
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: c.bgElevated,
    borderWidth: 1, borderColor: c.border,
  },
  chipSm: { paddingHorizontal: 10, paddingVertical: 5 },
  emoji: { fontSize: 15 },
  label: { ...typography.smallStrong, color: c.text },
  labelSm: { fontSize: 12 },
});
