import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import { radius, shadow, typography, useColors, useStyles, type ColorTokens } from "@/lib/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  label, onPress, loading, disabled, variant = "primary", icon, style,
}: {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  icon?: string;
  style?: ViewStyle;
}) {
  const colors = useColors();
  const styles = useStyles(mkStyles);

  const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary:  { bg: colors.primary,    fg: "#fff",         border: colors.primary },
    secondary:{ bg: colors.bgElevated, fg: colors.text,    border: colors.borderStrong },
    ghost:    { bg: "transparent",     fg: colors.primary, border: "transparent" },
    danger:   { bg: colors.bgElevated, fg: colors.danger,  border: colors.border },
  };
  const p = palette[variant];
  const isElevated = variant === "primary";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: p.bg, borderColor: p.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        isElevated && shadow(1),
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon ? <Text style={[styles.icon, { color: p.fg }]}>{icon}</Text> : null}
          <Text style={[styles.label, { color: p.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const mkStyles = (_c: ColorTokens) => StyleSheet.create({
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
