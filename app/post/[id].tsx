import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
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
import { CategoryChip } from "@/components/CategoryChip";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { Comments } from "@/components/Comments";
import { ReserveBanner } from "@/components/ReserveBanner";
import { buzz } from "@/lib/haptics";
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
  reserved_until: string | null;
};

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [row, setRow] = useState<DetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [reportText, setReportText] = useState("");
  const [showReport, setShowReport] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: p, error } = await supabase.from("posts").select("*").eq("id", id).single();
    if (error || !p) { setLoading(false); return; }

    const { data: prof } = await supabase
      .from("profiles")
      .select("handle, karma")
      .eq("id", (p as Post).poster_id)
      .single();

    const { data: claim } = await supabase
      .from("claims")
      .select("reserved_until")
      .eq("post_id", id)
      .maybeSingle();

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
      reserved_until: (claim as any)?.reserved_until ?? null,
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
        if (error.code === "23505") { buzz.warn(); Alert.alert("Already claimed", "Someone beat you to it."); }
        else throw error;
      } else { buzz.success(); }
      await load();
    } catch (e: any) {
      buzz.error();
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
      buzz.success();
      await load();
    } catch (e: any) {
      buzz.error();
      Alert.alert("Update failed", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const deletePost = () => {
    if (!row) return;
    setShowActions(false);
    Alert.alert("Delete this post?", "It will disappear from the map. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            const { error } = await supabase.rpc("delete_my_post", { p_id: row.id });
            if (error) throw error;
            buzz.success();
            router.back();
          } catch (e: any) {
            buzz.error();
            Alert.alert("Delete failed", e.message ?? String(e));
          } finally { setBusy(false); }
        },
      },
    ]);
  };

  const sharePost = async () => {
    if (!row) return;
    buzz.light();
    try {
      await Share.share({
        title: row.title,
        message: `📦 ${row.title} — free on a stoop, 15-min window. Open in StoopCast: stoopcast://post/${row.id}`,
      });
    } catch {}
  };

  const submitReport = async () => {
    if (!row) return;
    if (!reportText.trim()) return Alert.alert("Tell us why", "A short reason helps moderation.");
    try {
      const { error } = await supabase.rpc("report_post", { p_id: row.id, p_reason: reportText.trim() });
      if (error) throw error;
      buzz.success();
      setReportText(""); setShowReport(false); setShowActions(false);
      Alert.alert("Reported", "Thanks — we'll review it.");
    } catch (e: any) {
      buzz.error();
      Alert.alert("Couldn't report", e.message ?? String(e));
    }
  };

  const blockPoster = async () => {
    if (!row) return;
    setShowActions(false);
    Alert.alert(
      `Block @${row.poster_handle}?`,
      "You won't see their posts on the map or in activity.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block", style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.rpc("block_user", { p_user: row.poster_id });
              if (error) throw error;
              buzz.success();
              router.back();
            } catch (e: any) {
              buzz.error();
              Alert.alert("Couldn't block", e.message ?? String(e));
            }
          },
        },
      ],
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (!row) return <View style={styles.center}><Text style={{ color: colors.muted }}>Not found.</Text></View>;

  const isMine = session?.user?.id === row.poster_id;
  const minsLeft = minutesLeft(row.expires_at);
  const isLive = row.status === "live" && minsLeft > 0;
  const allPhotos = [row.photo_url, ...(row.photos ?? [])].filter(Boolean);
  const reserved = row.status === "claimed"
    && row.reserved_until
    && new Date(row.reserved_until).getTime() > Date.now();

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View>
          <PhotoCarousel uris={allPhotos} />
          <View style={styles.heroOverlay}>
            <CategoryChip id={row.category} size="sm" />
            <View style={{ flex: 1 }} />
            <Pressable onPress={sharePost} style={[styles.heroBtn, shadow(2)]}>
              <Text style={styles.heroBtnText}>↗</Text>
            </Pressable>
            <Pressable onPress={() => setShowActions((v) => !v)} style={[styles.heroBtn, shadow(2)]}>
              <Text style={styles.heroBtnText}>⋯</Text>
            </Pressable>
          </View>

          {showActions ? (
            <View style={[styles.actionsMenu, shadow(2)]}>
              {isMine ? (
                <Pressable onPress={deletePost} style={styles.actionItem}>
                  <Text style={[styles.actionText, { color: colors.danger }]}>🗑  Delete post</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable onPress={() => setShowReport(true)} style={styles.actionItem}>
                    <Text style={styles.actionText}>🚩  Report this post</Text>
                  </Pressable>
                  <View style={styles.menuSep} />
                  <Pressable onPress={blockPoster} style={styles.actionItem}>
                    <Text style={[styles.actionText, { color: colors.danger }]}>
                      🚫  Block @{row.poster_handle}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : null}
        </View>

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

          {reserved ? <ReserveBanner reservedUntil={row.reserved_until!} /> : null}
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

          <Comments postId={row.id} />
        </View>
      </ScrollView>

      {showReport ? (
        <View style={styles.reportBackdrop}>
          <View style={[styles.reportSheet, shadow(3)]}>
            <Text style={styles.reportTitle}>Report this post</Text>
            <Text style={styles.reportSub}>Spam, offensive, not actually free, etc.</Text>
            <TextInput
              style={styles.reportInput}
              placeholder="What's wrong?"
              placeholderTextColor={colors.muted}
              value={reportText}
              onChangeText={setReportText}
              multiline
              maxLength={200}
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Button label="Cancel" variant="secondary" onPress={() => setShowReport(false)} style={{ flex: 1 }} />
              <Button label="Send report" onPress={submitReport} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      ) : null}

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

  heroOverlay: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    flexDirection: "row", alignItems: "center", gap: space.sm,
    paddingHorizontal: space.md, paddingVertical: space.sm,
  },
  heroBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center", justifyContent: "center",
  },
  heroBtnText: { fontSize: 16 },

  actionsMenu: {
    position: "absolute", right: space.md, top: -4,
    backgroundColor: colors.bgElevated, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, minWidth: 200,
  },
  actionItem: { paddingHorizontal: 14, paddingVertical: 12 },
  actionText: { ...typography.bodyStrong, color: colors.text },
  menuSep: { height: 1, backgroundColor: colors.border, marginHorizontal: 8 },

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

  reportBackdrop: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(20,20,20,0.55)",
    alignItems: "center", justifyContent: "center", padding: space.lg,
  },
  reportSheet: {
    backgroundColor: colors.bgElevated, borderRadius: radius.lg,
    padding: space.lg, gap: space.md, width: "100%",
    borderWidth: 1, borderColor: colors.border,
  },
  reportTitle: { ...typography.h3, color: colors.text },
  reportSub: { ...typography.small, color: colors.muted, marginTop: -8 },
  reportInput: {
    minHeight: 80,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: space.md, backgroundColor: colors.bg, color: colors.text,
    fontSize: 15, textAlignVertical: "top",
  },
});
