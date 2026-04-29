import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, shadow, useColors, useStyles, type ColorTokens } from "@/lib/theme";

export function Countdown({ expiresAt }: { expiresAt: string }) {
  const colors = useColors();
  const styles = useStyles(mkStyles);
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const totalMs = 15 * 60 * 1000;
  const leftMs = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const progress = Math.max(0, Math.min(1, leftMs / totalMs));
  const mins = Math.floor(leftMs / 60000);
  const secs = Math.floor((leftMs % 60000) / 1000);
  const isExpiring = mins < 5;
  const isExpired = leftMs === 0;

  const tone = isExpired ? colors.muted : isExpiring ? colors.warn : colors.success;

  return (
    <View style={[styles.wrap, shadow(1)]}>
      <View style={styles.row}>
        <Text style={[styles.big, { color: tone }]}>
          {isExpired ? "0:00" : `${mins}:${secs.toString().padStart(2, "0")}`}
        </Text>
        <Text style={styles.label}>
          {isExpired ? "window closed" : "left in alert window"}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: tone }]} />
      </View>
    </View>
  );
}

const mkStyles = (c: ColorTokens) => StyleSheet.create({
  wrap: {
    backgroundColor: c.bgElevated,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: c.border,
    gap: 10,
  },
  row: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  big: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  label: { color: c.muted, fontSize: 13, flex: 1 },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: c.border,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 3 },
});
