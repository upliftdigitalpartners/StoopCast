import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/Button";
import { Pill } from "@/components/Pill";
import { NeighborhoodCard } from "@/components/NeighborhoodCard";
import { AchievementBadge } from "@/components/AchievementBadge";
import { computeAchievements } from "@/lib/achievements";
import { colors, radius, shadow, space, typography } from "@/lib/theme";
import { timeAgo } from "@/lib/time";
import type { Post, Profile, Stats } from "@/lib/types";

export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    const [{ data: prof }, { data: ps }, { data: st }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      supabase.from("posts").select("*").eq("poster_id", session.user.id)
        .order("created_at", { ascending: false }).limit(50),
      supabase.rpc("my_stats"),
    ]);
    setProfile((prof as Profile) ?? null);
    setPosts((ps as Post[]) ?? []);
    setStats(((st as Stats[])?.[0]) ?? null);
    setLoading(false);
  }, [session?.user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  const initials = (profile?.handle ?? "??").slice(0, 2).toUpperCase();
  const achievements = computeAchievements(stats);
  const earned = achievements.filter((a) => a.earned).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: space.xxl }}
        ListHeaderComponent={
          <View style={{ padding: space.lg, gap: space.lg }}>
            <View style={styles.header}>
              <View style={[styles.avatar, shadow(1)]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <Text style={styles.handle}>@{profile?.handle ?? "you"}</Text>
              <Text style={styles.email}>{session?.user?.email}</Text>
              {stats?.streak_days && stats.streak_days > 0 ? (
                <View style={styles.streakPill}>
                  <Text style={styles.streakText}>🔥 {stats.streak_days}-day streak</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.statsRow}>
              <Stat label="Karma" value={profile?.karma ?? 0} accent />
              <Stat label="Posts" value={stats?.posts ?? 0} />
              <Stat label="Claimed" value={stats?.claims ?? 0} />
            </View>

            {stats && stats.weekly_karma > 0 ? (
              <Text style={styles.weekly}>
                ⭐ +{stats.weekly_karma} karma this week
              </Text>
            ) : null}

            <NeighborhoodCard isSet={!!profile?.home_set} onChanged={load} />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Achievements</Text>
              <Text style={styles.sectionMeta}>{earned} / {achievements.length}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesRow}>
              {achievements.map((a) => <AchievementBadge key={a.id} a={a} />)}
            </ScrollView>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your posts</Text>
              {posts.filter((p) => p.status === "live").length > 0 ? (
                <Pill label={`${posts.filter((p) => p.status === "live").length} live`} tone="live" />
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🪑</Text>
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptyBody}>Spot something free on a stoop? Snap it and earn karma.</Text>
            <Button
              label="Post your first find"
              icon="📷"
              onPress={() => router.push("/(tabs)/post")}
              style={{ marginTop: space.md }}
            />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            onPress={() => router.push(`/post/${item.id}`)}
          >
            <Image source={{ uri: item.photo_url }} style={styles.thumb} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Pill
                  label={item.status}
                  tone={item.status === "live" ? "live" : item.status === "claimed" ? "warn" : "claimed"}
                />
                <Text style={styles.rowMeta}>{timeAgo(item.created_at)}</Text>
              </View>
            </View>
            <Text style={styles.rowChevron}>›</Text>
          </Pressable>
        )}
        ListFooterComponent={
          <View style={{ padding: space.lg }}>
            <Button label="Sign out" variant="danger" onPress={signOut} />
          </View>
        }
      />
    </SafeAreaView>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <View style={[styles.stat, accent && styles.statAccent, shadow(1)]}>
      <Text style={[styles.statValue, accent && { color: colors.primary }]}>
        {accent ? "⭐ " : ""}{value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: { alignItems: "center", gap: space.xs },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    marginBottom: space.sm,
  },
  avatarText: { color: "#fff", fontSize: 26, fontWeight: "800" },
  handle: { ...typography.h2, color: colors.text },
  email: { ...typography.small, color: colors.muted },
  streakPill: {
    marginTop: space.sm,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: "#fff5e6",
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: "#f4d9aa",
  },
  streakText: { color: colors.warn, fontWeight: "800", fontSize: 13 },

  statsRow: { flexDirection: "row", gap: space.sm },
  stat: {
    flex: 1, backgroundColor: colors.bgElevated,
    paddingVertical: space.md, paddingHorizontal: space.sm,
    borderRadius: radius.md, alignItems: "center",
    borderWidth: 1, borderColor: colors.border, gap: 2,
  },
  statAccent: { borderColor: colors.primary, backgroundColor: "#fff" },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.text },
  statLabel: { ...typography.tiny, color: colors.muted, textTransform: "uppercase" },

  weekly: { ...typography.smallStrong, color: colors.primary, textAlign: "center", marginTop: -8 },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { ...typography.h3, color: colors.text },
  sectionMeta: { ...typography.smallStrong, color: colors.muted },
  badgesRow: { gap: 8, paddingVertical: 4, paddingRight: space.lg },

  empty: { alignItems: "center", padding: space.xl, gap: 4 },
  emptyEmoji: { fontSize: 38 },
  emptyTitle: { ...typography.h3, color: colors.text, marginTop: space.sm },
  emptyBody: { ...typography.body, color: colors.muted, textAlign: "center" },

  row: {
    flexDirection: "row", alignItems: "center", gap: space.md,
    paddingVertical: space.sm, paddingHorizontal: space.lg,
    backgroundColor: colors.bgElevated, marginHorizontal: space.lg,
    marginBottom: space.sm, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: "#eee" },
  rowTitle: { ...typography.bodyStrong, color: colors.text },
  rowMeta: { ...typography.small, color: colors.muted },
  rowChevron: { fontSize: 24, color: colors.muted },
});
