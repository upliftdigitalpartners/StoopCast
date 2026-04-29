import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { registerForPushAsync } from "@/lib/notifications";
import { colors, radius, shadow, space, typography } from "@/lib/theme";
import { minutesLeft, timeAgo } from "@/lib/time";
import { formatDistance } from "@/lib/distance";
import { CATEGORIES, categoryOf, type CategoryId } from "@/lib/categories";
import { MapPin } from "@/components/MapPin";
import { Pill } from "@/components/Pill";
import { Button } from "@/components/Button";
import { CategoryChip } from "@/components/CategoryChip";
import { buzz } from "@/lib/haptics";
import type { NearbyPost } from "@/lib/types";

const DEFAULT_RADIUS_M = 2000;

export default function MapScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [posts, setPosts] = useState<NearbyPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [denied, setDenied] = useState(false);
  const [filters, setFilters] = useState<Set<CategoryId>>(new Set());

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setDenied(true);
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    })();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      registerForPushAsync(session.user.id).catch(() => {});
    }
  }, [session?.user?.id]);

  const loadPosts = useCallback(async (lat: number, lng: number) => {
    const { data, error } = await supabase.rpc("nearby_posts", {
      lat, lng, radius_m: DEFAULT_RADIUS_M,
    });
    if (!error && data) setPosts(data as NearbyPost[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (region) loadPosts(region.latitude, region.longitude);
  }, [region, loadPosts]);

  useFocusEffect(
    useCallback(() => {
      if (region) loadPosts(region.latitude, region.longitude);
      const channel = supabase
        .channel("posts-feed")
        .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
          if (region) loadPosts(region.latitude, region.longitude);
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }, [region, loadPosts]),
  );

  const onRefresh = useCallback(async () => {
    if (!region) return;
    setRefreshing(true);
    await loadPosts(region.latitude, region.longitude);
    setRefreshing(false);
  }, [region, loadPosts]);

  const recenter = async () => {
    buzz.light();
    const loc = await Location.getCurrentPositionAsync({});
    const r = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
    setRegion(r);
    mapRef.current?.animateToRegion(r, 600);
  };

  const toggleFilter = (id: CategoryId) => {
    buzz.light();
    setFilters((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const visiblePosts = useMemo(() => {
    if (filters.size === 0) return posts;
    return posts.filter((p) => filters.has((p.category as CategoryId) ?? "other"));
  }, [posts, filters]);

  if (denied) {
    return (
      <SafeAreaView style={styles.center} edges={["top", "bottom"]}>
        <Text style={styles.deniedTitle}>Location is needed</Text>
        <Text style={styles.deniedBody}>
          StoopCast shows free stuff near you and lets you alert neighbors when you spot something. Enable location in Settings to continue.
        </Text>
      </SafeAreaView>
    );
  }
  if (loading || !region) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loading}>Finding your block…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {visiblePosts.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            onPress={() => { buzz.light(); router.push(`/post/${p.id}`); }}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 1 }}
          >
            <MapPin minutesLeft={minutesLeft(p.expires_at)} status={p.status} />
          </Marker>
        ))}
      </MapView>

      <SafeAreaView edges={["top"]} style={styles.topBar} pointerEvents="box-none">
        <View style={[styles.brandPill, shadow(2)]}>
          <View style={styles.livePulse} />
          <Text style={styles.brandText}>StoopCast</Text>
          <Text style={styles.brandCount}>{visiblePosts.length} live</Text>
        </View>
        <Pressable onPress={recenter} style={[styles.fab, shadow(2)]}>
          <Text style={{ fontSize: 18 }}>🎯</Text>
        </Pressable>
      </SafeAreaView>

      <View style={styles.filterRow} pointerEvents="box-none">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {filters.size > 0 ? (
            <Pressable onPress={() => { buzz.light(); setFilters(new Set()); }} style={styles.clearChip}>
              <Text style={styles.clearChipText}>✕ All</Text>
            </Pressable>
          ) : null}
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c.id}
              id={c.id}
              size="sm"
              selected={filters.has(c.id)}
              onPress={() => toggleFilter(c.id)}
            />
          ))}
        </ScrollView>
      </View>

      <SafeAreaView edges={["bottom"]} style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Nearby stoops</Text>
          <Text style={styles.sheetSub}>
            {filters.size > 0 ? `${filters.size} filter${filters.size === 1 ? "" : "s"}` : "within 2km"}
          </Text>
        </View>
        {visiblePosts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🛋️</Text>
            <Text style={styles.emptyTitle}>
              {filters.size > 0 ? "Nothing matches that filter" : "Nothing live right now"}
            </Text>
            <Text style={styles.emptyBody}>
              {filters.size > 0
                ? "Clear the filter to see everything nearby."
                : "Be the first today — snap a photo of free stuff on a stoop nearby."}
            </Text>
            {filters.size > 0 ? (
              <Button
                label="Clear filter"
                variant="secondary"
                onPress={() => setFilters(new Set())}
                style={{ marginTop: space.md }}
              />
            ) : (
              <Button
                label="Post a find"
                icon="📷"
                onPress={() => router.push("/(tabs)/post")}
                style={{ marginTop: space.md }}
              />
            )}
          </View>
        ) : (
          <FlatList
            data={visiblePosts}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            renderItem={({ item }) => {
              const left = minutesLeft(item.expires_at);
              const tone = left <= 5 ? "warn" : "live";
              const cat = categoryOf(item.category);
              return (
                <Pressable
                  style={[styles.card, shadow(1)]}
                  onPress={() => { buzz.light(); router.push(`/post/${item.id}`); }}
                >
                  <Image source={{ uri: item.photo_url }} style={styles.cardImg} />
                  <View style={styles.catBadge}>
                    <Text style={styles.catBadgeText}>{cat.emoji} {cat.label}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <Pill label={`${left}m left`} tone={tone} />
                    <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardMeta}>{formatDistance(item.distance_m)}</Text>
                    <Text style={styles.cardMetaSoft}>
                      @{item.poster_handle} · ⭐ {item.poster_karma} · {timeAgo(item.created_at)}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: space.xl, backgroundColor: colors.bg, gap: space.md,
  },
  loading: { color: colors.muted },
  deniedTitle: { ...typography.h2, color: colors.text },
  deniedBody: { ...typography.body, color: colors.muted, textAlign: "center" },

  topBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    paddingHorizontal: space.lg, paddingTop: space.sm,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  brandPill: {
    flexDirection: "row", alignItems: "center", gap: space.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  livePulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  brandText: { ...typography.bodyStrong, color: colors.text },
  brandCount: { ...typography.smallStrong, color: colors.muted },
  fab: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.bgElevated,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },

  filterRow: {
    position: "absolute", left: 0, right: 0,
    top: 70,
  },
  filterContent: { paddingHorizontal: space.lg, gap: 6, paddingVertical: 4 },
  clearChip: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    alignItems: "center", justifyContent: "center",
  },
  clearChipText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingTop: 8, paddingBottom: space.md,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderTopWidth: 1, borderColor: colors.border,
    ...shadow(3),
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center", marginBottom: space.sm,
  },
  sheetHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "baseline",
    paddingHorizontal: space.lg, marginBottom: space.sm,
  },
  sheetTitle: { ...typography.h3, color: colors.text },
  sheetSub: { ...typography.small, color: colors.muted },

  empty: { paddingHorizontal: space.lg, paddingVertical: space.lg, alignItems: "center" },
  emptyEmoji: { fontSize: 38 },
  emptyTitle: { ...typography.h3, color: colors.text, marginTop: space.sm },
  emptyBody: { ...typography.body, color: colors.muted, textAlign: "center", marginTop: 4 },

  card: {
    width: 240,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    overflow: "hidden",
  },
  cardImg: { width: "100%", height: 130, backgroundColor: "#eee" },
  catBadge: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: "rgba(20,20,20,0.78)",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill,
  },
  catBadgeText: { color: "#fff", fontWeight: "700", fontSize: 11 },
  cardBody: { padding: 10, gap: 4 },
  cardTitle: { ...typography.bodyStrong, color: colors.text },
  cardMeta: { ...typography.smallStrong, color: colors.textSoft },
  cardMetaSoft: { ...typography.small, color: colors.muted },
});
