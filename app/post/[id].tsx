import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { colors, radius, space } from "@/lib/theme";
import { minutesLeft, timeAgo } from "@/lib/time";
import type { Post } from "@/lib/types";

type DetailRow = Post & {
  poster_handle: string;
  poster_karma: number;
  lat: number;
  lng: number;
};

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [row, setRow] = useState<DetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: p, error } = await supabase
      .from("posts")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !p) {
      setLoading(false);
      return;
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("handle, karma")
      .eq("id", (p as Post).poster_id)
      .single();

    // posts.location is geography; we re-query via RPC for parsed lat/lng
    // simpler: fetch via a small RPC-less round trip using PostGIS-as-text
    const { data: geo } = await supabase
      .rpc("nearby_posts", { lat: 0, lng: 0, radius_m: 999999999 })
      .then((r) => ({ data: (r.data as any[])?.find((x) => x.id === id) ?? null }));

    setRow({
      ...(p as Post),
      poster_handle: (prof as any)?.handle ?? "stooper",
      poster_karma: (prof as any)?.karma ?? 0,
      lat: geo?.lat ?? 0,
      lng: geo?.lng ?? 0,
    });
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // 1Hz countdown
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const claim = async () => {
    if (!session?.user || !row) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("claims")
        .insert({ post_id: row.id, claimer_id: session.user.id });
      if (error) {
        if (error.code === "23505") {
          Alert.alert("Already claimed", "Someone beat you to it.");
        } else {
          throw error;
        }
      }
      await load();
    } catch (e: any) {
      Alert.alert("Claim failed", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const markGone = async () => {
    if (!session?.user || !row) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("posts")
        .update({ status: "gone" })
        .eq("id", row.id);
      if (error) throw error;
      await load();
    } catch (e: any) {
      Alert.alert("Update failed", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!row) return <View style={styles.center}><Text style={{ color: colors.muted }}>Not found.</Text></View>;

  const isMine = session?.user?.id === row.poster_id;
  const isLive = row.status === "live" && minutesLeft(row.expires_at) > 0;
  const minsLeft = minutesLeft(row.expires_at);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: space.xl }}>
      <Image source={{ uri: row.photo_url }} style={styles.hero} />

      <View style={styles.body}>
        <Text style={styles.title}>{row.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.poster}>@{row.poster_handle} · ⭐ {row.poster_karma}</Text>
          <Text style={styles.muted}>{timeAgo(row.created_at)}</Text>
        </View>

        <View style={[styles.banner, statusStyle(row.status, minsLeft)]}>
          <Text style={styles.bannerText}>
            {row.status === "live" && minsLeft > 0
              ? `🟢 Live · ${minsLeft}m left in alert window`
              : row.status === "claimed"
                ? "✋ Claimed — someone's on the way"
                : row.status === "gone"
                  ? "✅ Gone — marked picked up"
                  : "⏰ Expired"}
          </Text>
        </View>

        {row.description ? <Text style={styles.desc}>{row.description}</Text> : null}

        {row.lat !== 0 || row.lng !== 0 ? (
          <View style={styles.mapWrap}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: row.lat,
                longitude: row.lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              pointerEvents="none"
            >
              <Marker coordinate={{ latitude: row.lat, longitude: row.lng }} pinColor={colors.pin} />
            </MapView>
          </View>
        ) : null}

        {!isMine && isLive ? (
          <Pressable
            onPress={claim}
            disabled={busy}
            style={({ pressed }) => [styles.primaryBtn, (busy || pressed) && { opacity: 0.7 }]}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>I'm grabbing it</Text>}
          </Pressable>
        ) : null}

        {isMine && row.status === "live" ? (
          <Pressable
            onPress={markGone}
            disabled={busy}
            style={({ pressed }) => [styles.secondaryBtn, (busy || pressed) && { opacity: 0.7 }]}
          >
            <Text style={styles.secondaryBtnText}>Mark as gone</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.back()} style={styles.linkBtn}>
          <Text style={styles.link}>← Back to map</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function statusStyle(status: string, minsLeft: number) {
  if (status === "live" && minsLeft > 0) return { backgroundColor: "#e8f5ee", borderColor: colors.primary };
  if (status === "claimed") return { backgroundColor: "#fff5e6", borderColor: colors.warn };
  return { backgroundColor: "#f0f0f0", borderColor: colors.border };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { width: "100%", aspectRatio: 4 / 3, backgroundColor: "#eee" },
  body: { padding: space.lg, gap: space.md },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  poster: { color: colors.text, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 13 },
  banner: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  bannerText: { fontWeight: "700", color: colors.text },
  desc: { color: colors.text, fontSize: 15, lineHeight: 22 },
  mapWrap: { borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  map: { width: "100%", height: 180 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: space.md,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  secondaryBtnText: { color: colors.text, fontWeight: "600" },
  linkBtn: { padding: space.sm, alignSelf: "center" },
  link: { color: colors.primary, fontWeight: "600" },
});
