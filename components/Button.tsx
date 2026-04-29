import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import { colors, radius, shadow, typography } from "@/lib/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  icon?: string;
  style?: ViewStyle;
}) {
  const palette = {
    primary: { bg: colors.primary, fg: "#fff", border: colors.primary },
    secondary: { bg: colors.bgElevated, fg: colors.text, border: colors.borderStrong },
    ghost: { bg: "transparent", fg: colors.primary, border: "transparent" },
    danger: { bg: colors.bgElevated, fg: colors.danger, border: colors.border },
  }[variant];

  const isElevated = variant === "primary";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        isElevated && shadow(1),
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon ? <Text style={[styles.icon, { color: palette.fg }]}>{icon}</Text> : null}
          <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: { ...typography.bodyStrong, fontSize: 16 },
  icon: { fontSize: 18 },
});
