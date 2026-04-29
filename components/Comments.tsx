import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { buzz } from "@/lib/haptics";
import { radius, space, typography, useColors, useStyles, type ColorTokens } from "@/lib/theme";
import { timeAgo } from "@/lib/time";
import type { CommentRow } from "@/lib/types";

export function Comments({ postId }: { postId: string }) {
  const colors = useColors();
  const styles = useStyles(mkStyles);
  const { session } = useAuth();
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("post_comments", { p_id: postId });
    setRows((data as CommentRow[]) ?? []);
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`comments:${postId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `post_id=eq.${postId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [postId, load]);

  const send = async () => {
    const body = text.trim();
    if (!body || !session?.user) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("add_comment", { p_id: postId, p_body: body });
      if (error) throw error;
      setText("");
      buzz.light();
    } catch (e: any) {
      buzz.error();
      Alert.alert("Couldn't post comment", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space.sm }}>
      <Text style={styles.heading}>
        {rows.length > 0 ? `${rows.length} comment${rows.length === 1 ? "" : "s"}` : "Comments"}
      </Text>

      {rows.length === 0 ? (
        <Text style={styles.empty}>Be the first to chime in — "I see it too" or "this is gone."</Text>
      ) : (
        rows.map((c) => (
          <View key={c.id} style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{c.handle.slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.handle}>
                @{c.handle} <Text style={styles.handleMeta}>· ⭐ {c.karma} · {timeAgo(c.created_at)}</Text>
              </Text>
              <Text style={styles.body}>{c.body}</Text>
            </View>
          </View>
        ))
      )}

      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Add a comment…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          maxLength={280}
        />
        <Pressable
          onPress={send}
          disabled={busy || !text.trim()}
          style={({ pressed }) => [
            styles.send,
            (busy || !text.trim()) && { opacity: 0.4 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const mkStyles = (c: ColorTokens) => StyleSheet.create({
  heading: { ...typography.h3, color: c.text },
  empty: { ...typography.small, color: c.muted, fontStyle: "italic" },
  row: { flexDirection: "row", gap: space.sm, paddingVertical: 6 },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: c.accent,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  handle: { ...typography.smallStrong, color: c.text },
  handleMeta: { ...typography.small, color: c.muted, fontWeight: "400" },
  body: { ...typography.body, color: c.text, marginTop: 2 },

  composer: {
    flexDirection: "row", gap: space.sm, marginTop: space.sm,
    alignItems: "flex-end",
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120,
    borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: 10,
    color: c.text, fontSize: 15, backgroundColor: c.bgElevated,
  },
  send: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: c.primary, borderRadius: radius.md,
  },
  sendText: { color: "#fff", fontWeight: "700" },
});
