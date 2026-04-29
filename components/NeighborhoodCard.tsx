import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { supabase } from "@/lib/supabase";
import { Pill } from "@/components/Pill";
import { colors, radius, shadow, space, typography } from "@/lib/theme";

export function NeighborhoodCard({
  isSet,
  onChanged,
}: {
  isSet: boolean;
  onChanged: () => void;
}) {
  const [home, setHome] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSet) { setHome(null); return; }
    supabase.rpc("my_home").then(({ data }) => {
      const r = (data as any[])?.[0];
      if (r) setHome({ lat: r.lat, lng: r.lng });
    });
  }, [isSet]);

  const setNow = async () => {
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Location needed", "Allow location to set your neighborhood.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { error } = await supabase.rpc("set_home_location", {
        p_lat: loc.coords.latitude,
        p_lng: loc.coords.longitude,
      });
      if (error) throw error;
      onChanged();
    } catch (e: any) {
      Alert.alert("Couldn't save", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, isSet ? styles.cardSet : styles.cardUnset, shadow(1)]}>
      <View style={styles.row}>
        <Text style={styles.emoji}>🏠</Text>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Your neighborhood</Text>
            <Pill label={isSet ? "set" : "off"} tone={isSet ? "live" : "neutral"} />
          </View>
          <Text style={styles.body}>
            {isSet
              ? "You'll get pushes only for stoops within 1.5km of this spot."
              : "Set a center so we only ping you about stoops near home."}
          </Text>
          {home ? (
            <Text style={styles.coords}>
              📍 {home.lat.toFixed(4)}, {home.lng.toFixed(4)}
            </Text>
          ) : null}
        </View>
      </View>
      <Pressable
        onPress={setNow}
        disabled={busy}
        style={({ pressed }) => [styles.cta, (busy || pressed) && { opacity: 0.7 }]}
      >
        <Text style={styles.ctaText}>
          {busy ? "Saving…" : isSet ? "Update to current location" : "Use current location"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    gap: space.sm,
  },
  cardSet: { borderColor: colors.success },
  cardUnset: { borderColor: colors.border },
  row: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  emoji: { fontSize: 28 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  title: { ...typography.bodyStrong, color: colors.text },
  body: { ...typography.small, color: colors.muted, lineHeight: 18 },
  coords: { ...typography.smallStrong, color: colors.text, marginTop: 6 },
  cta: {
    alignSelf: "flex-start",
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border,
  },
  ctaText: { ...typography.smallStrong, color: colors.primary },
});
