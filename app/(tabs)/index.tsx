import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { registerForPushAsync } from "@/lib/notifications";
import { colors, radius, space } from "@/lib/theme";
import { minutesLeft, timeAgo } from "@/lib/time";
import type { NearbyPost } from "@/lib/types";

const DEFAULT_RADIUS_M = 2000;

export default function MapScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [posts, setPosts] = useState<NearbyPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  // Acquire location once.
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

  // Register for push once we have a session.
  useEffect(() => {
    if (session?.user?.id) {
      registerForPushAsync(session.user.id).catch(() => {});
    }
  }, [session?.user?.id]);

  const loadPosts = useCallback(async (lat: number, lng: number) => {
    const { data, error } = await supabase.rpc("nearby_posts", {
      lat,
      lng,
      radius_m: DEFAULT_RADIUS_M,
    });
    if (!error && data) setPosts(data as NearbyPost[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (region) loadPosts(region.latitude, region.longitude);
  }, [region, loadPosts]);

  // Refresh on focus + subscribe to live changes.
  useFocusEffect(
    useCallback(() => {
      if (region) loadPosts(region.latitude, region.longitude);
      const channel = supabase
        .channel("posts-feed")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "posts" },
          () => {
            if (region) loadPosts(region.latitude, region.longitude);
          },
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }, [region, loadPosts]),
  );

  if (denied) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedTitle}>Location needed</Text>
        <Text style={styles.deniedBody}>
          StoopCast shows free stuff near you — please enable location in Settings.
        </Text>
      </View>
    );
  }
  if (loading || !region) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
      >
        {posts.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            title={p.title}
            description={`${minutesLeft(p.expires_at)}m left · @${p.poster_handle}`}
            pinColor={colors.pin}
            onCalloutPress={() => router.push(`/post/${p.id}`)}
          />
        ))}
      </MapView>

      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Nearby stoops</Text>
          <Text style={styles.sheetCount}>{posts.length} live</Text>
        </View>
        {posts.length === 0 ? (
          <Text style={styles.empty}>
            Nothing live within 2km. Be the first — tap Post.
          </Text>
        ) : (
          <FlatList
            data={posts}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}
            renderItem={({ item }) => (
              <Pressable
                style={styles.card}
                onPress={() => router.push(`/post/${item.id}`)}
              >
                <Image source={{ uri: item.photo_url }} style={styles.cardImg} />
                <View style={{ padding: space.sm, gap: 2 }}>
                  <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardMeta}>
                    {minutesLeft(item.expires_at)}m left · {Math.round(item.distance_m)}m
                  </Text>
                  <Text style={styles.cardMeta}>
                    @{item.poster_handle} · ⭐ {item.poster_karma} · {timeAgo(item.created_at)}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  map: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, backgroundColor: colors.bg },
  deniedTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: space.sm },
  deniedBody: { color: colors.muted, textAlign: "center" },

  sheet: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    paddingBottom: space.lg,
    paddingTop: space.md,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: space.lg,
    marginBottom: space.sm,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  sheetCount: { color: colors.muted, fontSize: 13 },
  empty: { color: colors.muted, paddingHorizontal: space.lg, paddingBottom: space.md },

  card: {
    width: 220,
    backgroundColor: "#fff",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  cardImg: { width: "100%", height: 110, backgroundColor: "#eee" },
  cardTitle: { fontWeight: "700", color: colors.text, fontSize: 14 },
  cardMeta: { color: colors.muted, fontSize: 12 },
});
