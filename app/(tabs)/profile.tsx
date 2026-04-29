import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { colors, radius, space } from "@/lib/theme";
import { timeAgo } from "@/lib/time";
import type { Post, Profile } from "@/lib/types";

export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    const [{ data: prof }, { data: ps }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      supabase
        .from("posts")
        .select("*")
        .eq("poster_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setProfile((prof as Profile) ?? null);
    setPosts((ps as Post[]) ?? []);
    setLoading(false);
  }, [session?.user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.center}><ActivityIndicator /></View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.handle}>@{profile?.handle ?? "you"}</Text>
        <View style={styles.karmaRow}>
          <Text style={styles.karmaNum}>⭐ {profile?.karma ?? 0}</Text>
          <Text style={styles.karmaLabel}>karma</Text>
        </View>
        <Text style={styles.email}>{session?.user?.email}</Text>
      </View>

      <Text style={styles.sectionTitle}>Your posts</Text>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: space.lg, gap: space.md }}
        ListEmptyComponent={
          <Text style={styles.empty}>You haven't posted anything yet.</Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/post/${item.id}`)}>
            <Image source={{ uri: item.photo_url }} style={styles.thumb} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.rowMeta}>
                {item.status} · {timeAgo(item.created_at)}
              </Text>
            </View>
          </Pressable>
        )}
      />

      <Pressable onPress={signOut} style={styles.signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    padding: space.lg,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: "center",
    gap: space.xs,
  },
  handle: { fontSize: 22, fontWeight: "800", color: colors.text },
  karmaRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  karmaNum: { fontSize: 28, fontWeight: "800", color: colors.primary },
  karmaLabel: { color: colors.muted },
  email: { color: colors.muted, fontSize: 13 },

  sectionTitle: {
    fontWeight: "700",
    color: colors.text,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  empty: { color: colors.muted, textAlign: "center", marginTop: space.xl },
  row: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    padding: space.sm,
    gap: space.md,
    alignItems: "center",
  },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: "#eee" },
  rowTitle: { fontWeight: "700", color: colors.text },
  rowMeta: { color: colors.muted, fontSize: 12 },

  signOut: {
    margin: space.lg,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  signOutText: { color: colors.danger, fontWeight: "600" },
});
