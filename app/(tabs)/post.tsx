import { useState } from "react";
import {
  Alert,
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
import { colors, radius, shadow, space, typography } from "@/lib/theme";

type LocalPhoto = { uri: string; base64: string; mime: string };

export default function PostScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const captureWithCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert("Camera permission needed");
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, base64: true, exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setPhoto({ uri: a.uri, base64: a.base64 ?? "", mime: a.mimeType ?? "image/jpeg" });
      await captureLocation();
    }
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Photo library permission needed");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setPhoto({ uri: a.uri, base64: a.base64 ?? "", mime: a.mimeType ?? "image/jpeg" });
      await captureLocation();
    }
  };

  const captureLocation = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return Alert.alert("Location needed", "We need your location to drop a pin.");
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
  };

  const reset = () => { setPhoto(null); setTitle(""); setDescription(""); setCoords(null); };

  const submit = async () => {
    if (!session?.user) return;
    if (!photo) return Alert.alert("Add a photo", "Snap a pic of the find first.");
    if (!title.trim()) return Alert.alert("Add a title", "What is it? e.g. \"Yellow lamp\"");
    if (!coords) return Alert.alert("Need location", "Tap Location to drop the pin.");

    setBusy(true);
    try {
      const ext = photo.mime.includes("png") ? "png" : "jpg";
      const path = `${session.user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("stoop-photos")
        .upload(path, decodeBase64(photo.base64), { contentType: photo.mime, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("stoop-photos").getPublicUrl(path);

      const { data: postId, error: postErr } = await supabase.rpc("create_post", {
        p_title: title.trim(),
        p_description: description.trim() || null,
        p_photo_url: pub.publicUrl,
        p_lat: coords.lat,
        p_lng: coords.lng,
      });
      if (postErr) throw postErr;

      reset();
      router.replace(`/post/${postId}`);
    } catch (e: any) {
      Alert.alert("Couldn't post", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const stepDone = (n: 1 | 2 | 3) => (n === 1 ? !!photo : n === 2 ? !!coords : !!title.trim());

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.h1}>Post a find</Text>
            <Text style={styles.sub}>15-minute alert window starts when you publish.</Text>
          </View>

          <View style={styles.steps}>
            <Step n={1} label="Photo" done={stepDone(1)} />
            <View style={styles.stepLine} />
            <Step n={2} label="Pin" done={stepDone(2)} />
            <View style={styles.stepLine} />
            <Step n={3} label="Details" done={stepDone(3)} />
          </View>

          {photo ? (
            <View style={[styles.photoCard, shadow(1)]}>
              <Image source={{ uri: photo.uri }} style={styles.photo} />
              <Pressable style={styles.replaceBtn} onPress={() => setPhoto(null)}>
                <Text style={styles.replaceText}>Replace</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.photoChoiceWrap}>
              <Pressable onPress={captureWithCamera} style={[styles.photoBig, shadow(1)]}>
                <Text style={styles.photoBigEmoji}>📷</Text>
                <Text style={styles.photoBigText}>Take a photo</Text>
                <Text style={styles.photoBigSub}>fastest path</Text>
              </Pressable>
              <Pressable onPress={pickFromLibrary} style={styles.photoSmall}>
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
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Yellow lamp"
              value={title}
              onChangeText={setTitle}
              maxLength={80}
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.fieldLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Condition, brand, anything to know"
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={500}
              placeholderTextColor={colors.muted}
            />
          </View>

          <Button
            label="Publish — start 15-min window"
            icon="🚀"
            onPress={submit}
            loading={busy}
            disabled={!photo || !coords || !title.trim()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Step({ n, label, done }: { n: number; label: string; done: boolean }) {
  return (
    <View style={styles.stepWrap}>
      <View style={[styles.stepDot, done && styles.stepDotDone]}>
        <Text style={[styles.stepDotText, done && { color: "#fff" }]}>{done ? "✓" : n}</Text>
      </View>
      <Text style={[styles.stepLabel, done && { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  header: { gap: 4, marginBottom: space.xs },
  h1: { ...typography.h1, color: colors.text },
  sub: { ...typography.body, color: colors.muted },

  steps: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: space.sm,
  },
  stepWrap: { alignItems: "center", gap: 4, width: 70 },
  stepDot: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1.5, borderColor: colors.borderStrong,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.bgElevated,
  },
  stepDotDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepDotText: { fontWeight: "700", color: colors.muted, fontSize: 13 },
  stepLabel: { ...typography.tiny, color: colors.muted, textTransform: "none" },
  stepLine: { flex: 1, height: 1.5, backgroundColor: colors.border, marginHorizontal: 4, marginBottom: 16 },

  photoCard: { borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.card },
  photo: { width: "100%", aspectRatio: 4 / 3 },
  replaceBtn: {
    position: "absolute", top: 10, right: 10,
    backgroundColor: "rgba(20,20,20,0.7)",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
  },
  replaceText: { color: "#fff", fontWeight: "600", fontSize: 12 },

  photoChoiceWrap: { gap: space.sm },
  photoBig: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg, padding: space.xl,
    borderWidth: 2, borderColor: colors.border, borderStyle: "dashed",
    alignItems: "center", gap: 4,
  },
  photoBigEmoji: { fontSize: 38 },
  photoBigText: { ...typography.h3, color: colors.text },
  photoBigSub: { ...typography.small, color: colors.muted },
  photoSmall: { padding: space.sm, alignItems: "center" },
  photoSmallText: { ...typography.smallStrong, color: colors.primary },

  locCard: {
    flexDirection: "row", alignItems: "center", gap: space.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md, padding: space.md,
    borderWidth: 1, borderColor: colors.border,
  },
  locCardSet: { borderColor: colors.success, backgroundColor: "#f3faf6" },
  locTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  locLabel: { ...typography.smallStrong, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  locValue: { ...typography.bodyStrong, color: colors.text },
  locArrow: { fontSize: 22 },

  fields: { gap: space.sm },
  fieldLabel: { ...typography.smallStrong, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: space.md, backgroundColor: colors.bgElevated,
    color: colors.text, fontSize: 16,
  },
  textarea: { height: 100, textAlignVertical: "top" },
});
