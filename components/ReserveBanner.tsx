import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, typography, useStyles, type ColorTokens } from "@/lib/theme";

export function ReserveBanner({ reservedUntil }: { reservedUntil: string }) {
  const styles = useStyles(mkStyles);
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const leftMs = Math.max(0, new Date(reservedUntil).getTime() - Date.now());
  const m = Math.floor(leftMs / 60000);
  const s = Math.floor((leftMs % 60000) / 1000);

  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>✋</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Reserved for the claimer</Text>
        <Text style={styles.sub}>
          {leftMs > 0
            ? `Hold expires in ${m}:${s.toString().padStart(2, "0")} — give them a chance to grab it.`
            : "Hold expired."}
        </Text>
      </View>
    </View>
  );
}

const mkStyles = (c: ColorTokens) => StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: c.warnSurface,
    borderColor: c.warnBorder, borderWidth: 1,
    borderRadius: radius.md, padding: 12,
  },
  emoji: { fontSize: 22 },
  title: { ...typography.bodyStrong, color: c.text },
  sub: { ...typography.small, color: c.muted, marginTop: 2 },
});
