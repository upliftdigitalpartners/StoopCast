import { useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { decode as decodeBase64 } from "base64-arraybuffer";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/Button";
import { Pill } from "@/components/Pill";
import { CategoryChip } from "@/components/CategoryChip";
import { CATEGORIES, type CategoryId } from "@/lib/categories";
import { buzz } from "@/lib/haptics";
import { radius, shadow, space, typography, useColors, useStyles, type ColorTokens } from "@/lib/theme";

type LocalPhoto = { uri: string; base64: string; mime: string };
const MAX_PHOTOS = 4;

export default function PostScreen() {
  const colors = useColors();
  const styles = useStyles(mkStyles);
  const router = useRouter();
  const { session } = useAuth();
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryId>("furniture");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const addFromCamera = async () => {
    if (photos.length >= MAX_PHOTOS) return Alert.alert(`Max ${MAX_PHOTOS} photos`);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert("Camera permission needed");
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, base64: true, exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setPhotos((p) => [...p, { uri: a.uri, base64: a.base64 ?? "", mime: a.mimeType ?? "image/jpeg" }]);
      buzz.light();
      if (!coords) await captureLocation();
    }
  };

  const addFromLibrary = async () => {
    if (photos.length >= MAX_PHOTOS) return Alert.alert(`Max ${MAX_PHOTOS} photos`);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Photo library permission needed");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, base64: true,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
    });
    if (!result.canceled) {
      const next: LocalPhoto[] = result.assets.map((a) => ({
        uri: a.uri, base64: a.base64 ?? "", mime: a.mimeType ?? "image/jpeg",
      }));
      setPhotos((p) => [...p, ...next].slice(0, MAX_PHOTOS));
      buzz.light();
      if (!coords) await captureLocation();
    }
  };

  const removePhoto = (i: number) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  const captureLocation = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return Alert.alert("Location needed", "We need your location to drop a pin.");
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    buzz.light();
  };

  const reset = () => {
    setPhotos([]); setTitle(""); setDescription(""); setCoords(null); setCategory("furniture");
  };

  const submit = async () => {
    if (!session?.user) return;
    if (photos.length === 0) return Alert.alert("Add a photo", "Snap a pic of the find first.");
    if (!title.trim()) return Alert.alert("Add a title", "What is it? e.g. \"Yellow lamp\"");
    if (!coords) return Alert.alert("Need location", "Tap Location to drop the pin.");

    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const p of photos) {
        const ext = p.mime.includes("png") ? "png" : "jpg";
        const path = `${session.user.id}/${Date.now()}_${uploaded.length}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("stoop-photos")
          .upload(path, decodeBase64(p.base64), { contentType: p.mime, upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("stoop-photos").getPublicUrl(path);
        uploaded.push(pub.publicUrl);
      }

      const [primary, ...rest] = uploaded;
      const { data: postId, error: postErr } = await supabase.rpc("create_post", {
        p_title: title.trim(),
        p_description: description.trim() || null,
        p_photo_url: primary,
        p_lat: coords.lat,
        p_lng: coords.lng,
        p_category: category,
        p_photos: rest,
      });
      if (postErr) throw postErr;

      buzz.success();
      reset();
      router.replace(`/post/${postId}`);
    } catch (e: any) {
      buzz.error();
      Alert.alert("Couldn't post", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const stepDone = (n: 1 | 2 | 3) => (n === 1 ? photos.length > 0 : n === 2 ? !!coords : !!title.trim());

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.h1}>Post a find</Text>
            <Text style={styles.sub}>15-minute alert window starts when you publish.</Text>
          </View>

          <View style={styles.steps}>
            <Step n={1} label="Photo" done={stepDone(1)} colors={colors} />
            <View style={styles.stepLine} />
            <Step n={2} label="Pin" done={stepDone(2)} colors={colors} />
            <View style={styles.stepLine} />
            <Step n={3} label="Details" done={stepDone(3)} colors={colors} />
          </View>

          {photos.length > 0 ? (
            <View style={{ gap: space.sm }}>
              <FlatList
                data={photos}
                horizontal
                keyExtractor={(_, i) => `p${i}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
                renderItem={({ item, index }) => (
                  <View style={styles.thumbWrap}>
                    <Image source={{ uri: item.uri }} style={styles.thumb} />
                    {index === 0 ? (
                      <View style={styles.primaryTag}>
                        <Text style={styles.primaryTagText}>main</Text>
                      </View>
                    ) : null}
                    <Pressable onPress={() => removePhoto(index)} style={styles.removeBtn}>
                      <Text style={styles.removeText}>✕</Text>
                    </Pressable>
                  </View>
                )}
                ListFooterComponent={
                  photos.length < MAX_PHOTOS ? (
                    <Pressable onPress={addFromLibrary} style={styles.addThumb}>
                      <Text style={{ fontSize: 24, color: colors.muted }}>＋</Text>
                    </Pressable>
                  ) : null
                }
              />
              <Text style={styles.photoHint}>
                {photos.length} of {MAX_PHOTOS} · first photo is the main one
              </Text>
            </View>
          ) : (
            <View style={styles.photoChoiceWrap}>
              <Pressable onPress={addFromCamera} style={[styles.photoBig, shadow(1)]}>
                <Text style={styles.photoBigEmoji}>📷</Text>
                <Text style={styles.photoBigText}>Take a photo</Text>
                <Text style={styles.photoBigSub}>up to {MAX_PHOTOS}, first is the cover</Text>
              </Pressable>
              <Pressable onPress={addFromLibrary} style={styles.photoSmall}>
                <Text style={styles.photoSmallText}>or pick from library</Text>
              </Pressable>
            </View>
          )}

          <Pressable onPress={captureLocation} style={[styles.locCard, coords && styles.locCardSet]}>
            <View style={{ flex: 1 }}>
              <View style={styles.locTopRow}>
                <Text style={styles.locLabel}>Drop a pin</Text>
                {coords ? <Pill label="set" tone="live" /> : null}
              </View>
              <Text style={[styles.locValue, !coords && { color: colors.muted }]}>
                {coords
                  ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                  : "Tap to use current location"}
              </Text>
            </View>
            <Text style={styles.locArrow}>{coords ? "↻" : "📍"}</Text>
          </Pressable>

          <View style={styles.fields}>
            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
              {CATEGORIES.map((c) => (
                <CategoryChip key={c.id} id={c.id} selected={category === c.id} onPress={() => { setCategory(c.id); buzz.light(); }} />
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput style={styles.input} placeholder="Yellow lamp" value={title} onChangeText={setTitle} maxLength={80} placeholderTextColor={colors.muted} />
            <Text style={styles.fieldLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Condition, brand, anything to know"
              value={description} onChangeText={setDescription}
              multiline maxLength={500} placeholderTextColor={colors.muted}
            />
          </View>

          <Button
            label="Publish — start 15-min window"
            icon="🚀"
            onPress={submit}
            loading={busy}
            disabled={photos.length === 0 || !coords || !title.trim()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Step({ n, label, done, colors }: { n: number; label: string; done: boolean; colors: ColorTokens }) {
  return (
    <View style={{ alignItems: "center", gap: 4, width: 70 }}>
      <View style={{
        width: 30, height: 30, borderRadius: 15,
        borderWidth: 1.5,
        borderColor: done ? colors.success : colors.borderStrong,
        backgroundColor: done ? colors.success : colors.bgElevated,
        alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ fontWeight: "700", color: done ? "#fff" : colors.muted, fontSize: 13 }}>{done ? "✓" : n}</Text>
      </View>
      <Text style={{ ...typography.tiny, color: done ? colors.text : colors.muted, textTransform: "none" }}>{label}</Text>
    </View>
  );
}

const mkStyles = (c: ColorTokens) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  scroll: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  header: { gap: 4, marginBottom: space.xs },
  h1: { ...typography.h1, color: c.text },
  sub: { ...typography.body, color: c.muted },

  steps: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space.sm },
  stepLine: { flex: 1, height: 1.5, backgroundColor: c.border, marginHorizontal: 4, marginBottom: 16 },

  thumbWrap: { width: 110, height: 110, borderRadius: radius.md, overflow: "hidden", backgroundColor: c.bg },
  thumb: { width: "100%", height: "100%" },
  primaryTag: {
    position: "absolute", top: 6, left: 6,
    backgroundColor: c.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill,
  },
  primaryTagText: { color: "#fff", fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  removeBtn: {
    position: "absolute", top: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(20,20,20,0.7)",
    alignItems: "center", justifyContent: "center",
  },
  removeText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  addThumb: {
    width: 110, height: 110, borderRadius: radius.md,
    borderWidth: 2, borderStyle: "dashed", borderColor: c.border,
    alignItems: "center", justifyContent: "center",
  },
  photoHint: { ...typography.small, color: c.muted },

  photoChoiceWrap: { gap: space.sm },
  photoBig: {
    backgroundColor: c.bgElevated,
    borderRadius: radius.lg, padding: space.xl,
    borderWidth: 2, borderColor: c.border, borderStyle: "dashed",
    alignItems: "center", gap: 4,
  },
  photoBigEmoji: { fontSize: 38 },
  photoBigText: { ...typography.h3, color: c.text },
  photoBigSub: { ...typography.small, color: c.muted },
  photoSmall: { padding: space.sm, alignItems: "center" },
  photoSmallText: { ...typography.smallStrong, color: c.primary },

  locCard: {
    flexDirection: "row", alignItems: "center", gap: space.md,
    backgroundColor: c.bgElevated,
    borderRadius: radius.md, padding: space.md,
    borderWidth: 1, borderColor: c.border,
  },
  locCardSet: { borderColor: c.success, backgroundColor: c.liveSurface },
  locTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  locLabel: { ...typography.smallStrong, color: c.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  locValue: { ...typography.bodyStrong, color: c.text },
  locArrow: { fontSize: 22 },

  fields: { gap: space.sm },
  fieldLabel: { ...typography.smallStrong, color: c.muted, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
    padding: space.md, backgroundColor: c.inputBg,
    color: c.text, fontSize: 16,
  },
  textarea: { height: 100, textAlignVertical: "top" },
});
