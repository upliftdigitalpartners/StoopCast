import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/Button";
import { Pill } from "@/components/Pill";
import { Countdown } from "@/components/Countdown";
import { MapPin } from "@/components/MapPin";
import { colors, radius, shadow, space, typography } from "@/lib/theme";
import { minutesLeft, timeAgo } from "@/lib/time";
import { formatDistance } from "@/lib/distance";
import type { Post } from "@/lib/types";

type DetailRow = Post & {
  poster_handle: string;
  poster_karma: number;
  lat: number;
  lng: number;
  distance_m: number | null;
};

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [row, setRow] = useState<DetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: p, error } = await supabase.from("posts").select("*").eq("id", id).single();
    if (error || !p) { setLoading(false); return; }

    const { data: prof } = await supabase
      .from("profiles")
      .select("handle, karma")
      .eq("id", (p as Post).poster_id)
      .single();

    let lat = 0, lng = 0;
    const { data: feed } = await supabase.rpc("nearby_posts", { lat: 0, lng: 0, radius_m: 999_999_999 });
    const fromFeed = (feed as any[])?.find((x) => x.id === id);
    if (fromFeed) { lat = fromFeed.lat; lng = fromFeed.lng; }

    let distance_m: number | null = null;
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.granted) {
        const me = await Location.getLastKnownPositionAsync();
        if (me) {
          const R = 6371000;
          const toRad = (d: number) => (d * Math.PI) / 180;
          const dLat = toRad(lat - me.coords.latitude);
          const dLng = toRad(lng - me.coords.longitude);
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(me.coords.latitude)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
          distance_m = 2 * R * Math.asin(Math.sqrt(a));
        }
      }
    } catch {}

    setRow({
      ...(p as Post),
      poster_handle: (prof as any)?.handle ?? "stooper",
      poster_karma: (prof as any)?.karma ?? 0,
      lat, lng, distance_m,
    });
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const claim = async () => {
    if (!session?.user || !row) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("claims")
        .insert({ post_id: row.id, claimer_id: session.user.id });
      if (error) {
        if (error.code === "23505") Alert.alert("Already claimed", "Someone beat you to it.");
        else throw error;
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
      const { error } = await supabase.from("posts").update({ status: "gone" }).eq("id", row.id);
      if (error) throw error;
      await load();
    } catch (e: any) {
      Alert.alert("Update failed", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (!row) return <View style={styles.center}><Text style={{ color: colors.muted }}>Not found.</Text></View>;

  const isMine = session?.user?.id === row.poster_id;
  const minsLeft = minutesLeft(row.expires_at);
  const isLive = row.status === "live" && minsLeft > 0;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <Image source={{ uri: row.photo_url }} style={styles.hero} />

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{row.title}</Text>
            <Pill
              label={row.status === "live" && minsLeft === 0 ? "expired" : row.status}
              tone={isLive ? (minsLeft <= 5 ? "warn" : "live") : row.status === "claimed" ? "warn" : "claimed"}
            />
          </View>

          <View style={styles.posterRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{row.poster_handle.slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.posterName}>@{row.poster_handle}</Text>
              <Text style={styles.posterMeta}>⭐ {row.poster_karma} · posted {timeAgo(row.created_at)}</Text>
            </View>
          </View>

          {isLive ? <Countdown expiresAt={row.expires_at} /> : null}

          {row.description ? (
            <View style={styles.descCard}>
              <Text style={styles.desc}>{row.description}</Text>
            </View>
          ) : null}

          {row.lat !== 0 || row.lng !== 0 ? (
            <View style={[styles.mapWrap, shadow(1)]}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: row.lat, longitude: row.lng,
                  latitudeDelta: 0.005, longitudeDelta: 0.005,
                }}
                pointerEvents="none"
              >
                <Marker
                  coordinate={{ latitude: row.lat, longitude: row.lng }}
                  anchor={{ x: 0.5, y: 1 }}
                  tracksViewChanges={false}
                >
                  <MapPin minutesLeft={minsLeft} status={row.status} />
                </Marker>
              </MapView>
              {row.distance_m !== null ? (
                <View style={styles.distancePill}>
                  <Text style={styles.distanceText}>{formatDistance(row.distance_m)}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={[styles.actionBar, shadow(3)]}>
        {!isMine && isLive ? (
          <Button label="I'm grabbing it" icon="🙌" onPress={claim} loading={busy} />
        ) : isMine && row.status === "live" ? (
          <Button label="Mark as gone" variant="secondary" onPress={markGone} loading={busy} />
        ) : (
          <Button label="Back to map" variant="secondary" onPress={() => router.back()} />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { width: "100%", aspectRatio: 4 / 3, backgroundColor: "#eee" },
  body: { padding: space.lg, gap: space.md },

  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: space.md },
  title: { ...typography.h1, color: colors.text, flex: 1 },

  posterRow: {
    flexDirection: "row", alignItems: "center", gap: space.md,
    backgroundColor: colors.bgElevated, padding: space.sm, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  posterName: { ...typography.bodyStrong, color: colors.text },
  posterMeta: { ...typography.small, color: colors.muted },

  descCard: {
    backgroundColor: colors.bgElevated,
    padding: space.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  desc: { ...typography.body, color: colors.text, lineHeight: 22 },

  mapWrap: { borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  map: { width: "100%", height: 200 },
  distancePill: {
    position: "absolute", bottom: 10, left: 10,
    backgroundColor: "rgba(20,20,20,0.85)",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
  },
  distanceText: { color: "#fff", fontWeight: "600", fontSize: 12 },

  actionBar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: space.lg, paddingTop: space.md,
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
});
