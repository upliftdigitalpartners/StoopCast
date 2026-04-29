import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { Pill } from "@/components/Pill";
import { Button } from "@/components/Button";
import { radius, shadow, space, typography, useColors, useStyles, type ColorTokens } from "@/lib/theme";
import { timeAgo } from "@/lib/time";
import { formatDistance } from "@/lib/distance";
import { categoryOf } from "@/lib/categories";
import { buzz } from "@/lib/haptics";
import type { ActivityRow } from "@/lib/types";

export default function ActivityScreen() {
  const colors = useColors();
  const styles = useStyles(mkStyles);
  const router = useRouter();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) { setDenied(true); setLoading(false); return; }
      const me = await Location.getLastKnownPositionAsync()
        ?? await Location.getCurrentPositionAsync({});
      const { data } = await supabase.rpc("recent_neighborhood_activity", {
        lat: me.coords.latitude, lng: me.coords.longitude,
        radius_m: 3000, since_hours: 48,
      });
      setRows((data as ActivityRow[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (denied) {
    return (
      <SafeAreaView style={styles.center} edges={["top","bottom"]}>
        <Text style={styles.h2}>Location needed</Text>
        <Text style={styles.bodyMuted}>Activity is filtered to your block.</Text>
      </SafeAreaView>
    );
  }
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.h1}>Activity</Text>
        <Text style={styles.sub}>What's happened on your block in the last 48h.</Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👀</Text>
            <Text style={styles.h2}>Quiet on your block</Text>
            <Text style={styles.bodyMuted}>No stoop finds in the last 2 days.</Text>
            <Button label="Post a find" icon="📷" onPress={() => router.push("/(tabs)/post")} style={{ marginTop: space.md }} />
          </View>
        }
        renderItem={({ item }) => {
          const cat = categoryOf(item.category);
          const tone =
            item.status === "live" ? "live" :
            item.status === "claimed" ? "warn" :
            "claimed";
          return (
            <Pressable
              style={[styles.row, shadow(1)]}
              onPress={() => { buzz.light(); router.push(`/post/${item.id}`); }}
            >
              <Image source={{ uri: item.photo_url }} style={styles.thumb} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.catEmoji}>{cat.emoji}</Text>
                  <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Pill label={item.status} tone={tone} />
                  <Text style={styles.meta}>{timeAgo(item.created_at)} · {formatDistance(item.distance_m)}</Text>
                </View>
                <Text style={styles.metaSoft}>@{item.poster_handle}</Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const mkStyles = (c: ColorTokens) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: 6, backgroundColor: c.bg },
  header: { padding: space.lg, paddingBottom: 0, gap: 4 },
  h1: { ...typography.h1, color: c.text },
  h2: { ...typography.h2, color: c.text },
  sub: { ...typography.body, color: c.muted },
  bodyMuted: { ...typography.body, color: c.muted, textAlign: "center" },
  empty: { alignItems: "center", padding: space.xl, gap: 4 },
  emptyEmoji: { fontSize: 38 },

  row: {
    flexDirection: "row", alignItems: "center", gap: space.md,
    backgroundColor: c.bgElevated,
    borderRadius: radius.md, padding: space.sm,
    borderWidth: 1, borderColor: c.border,
  },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: c.bg },
  catEmoji: { fontSize: 16 },
  title: { ...typography.bodyStrong, color: c.text, flex: 1 },
  meta: { ...typography.small, color: c.textSoft, fontWeight: "600" },
  metaSoft: { ...typography.small, color: c.muted },
  chev: { fontSize: 24, color: c.muted },
});
