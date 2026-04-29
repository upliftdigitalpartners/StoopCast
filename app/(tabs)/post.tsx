import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { colors, radius, space } from "@/lib/theme";

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
    if (!perm.granted) {
      Alert.alert("Camera permission needed");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
      base64: true,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setPhoto({ uri: a.uri, base64: a.base64 ?? "", mime: a.mimeType ?? "image/jpeg" });
      await captureLocation();
    }
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photo library permission needed");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setPhoto({ uri: a.uri, base64: a.base64 ?? "", mime: a.mimeType ?? "image/jpeg" });
      await captureLocation();
    }
  };

  const captureLocation = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Location needed", "We need your location to drop a pin on the stoop.");
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
  };

  const reset = () => {
    setPhoto(null);
    setTitle("");
    setDescription("");
    setCoords(null);
  };

  const submit = async () => {
    if (!session?.user) return;
    if (!photo) return Alert.alert("Add a photo", "Snap a pic of the stoop find first.");
    if (!title.trim()) return Alert.alert("Add a title", "What is it? e.g. \"Yellow lamp\"");
    if (!coords) return Alert.alert("Need location", "Tap location to drop the pin.");

    setBusy(true);
    try {
      const ext = photo.mime.includes("png") ? "png" : "jpg";
      const path = `${session.user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("stoop-photos")
        .upload(path, decodeBase64(photo.base64), {
          contentType: photo.mime,
          upsert: false,
        });
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

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: space.lg, gap: space.md }}>
      <Text style={styles.heading}>Post a stoop find</Text>
      <Text style={styles.sub}>
        Snap, drop a pin, and nearby neighbors get a 15-minute alert.
      </Text>

      {photo ? (
        <View>
          <Image source={{ uri: photo.uri }} style={styles.photo} />
          <Pressable onPress={() => setPhoto(null)} style={styles.linkBtn}>
            <Text style={styles.link}>Replace photo</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <Pressable onPress={captureWithCamera} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>📷 Take a photo</Text>
          </Pressable>
          <Pressable onPress={pickFromLibrary} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Pick from library</Text>
          </Pressable>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="Title (e.g. Yellow lamp)"
        value={title}
        onChangeText={setTitle}
        maxLength={80}
        placeholderTextColor={colors.muted}
      />
      <TextInput
        style={[styles.input, { height: 90, textAlignVertical: "top" }]}
        placeholder="Description (optional) — condition, brand, anything to know"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={500}
        placeholderTextColor={colors.muted}
      />

      <Pressable onPress={captureLocation} style={styles.locBox}>
        <Text style={styles.locLabel}>📍 Location</Text>
        <Text style={styles.locValue}>
          {coords
            ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
            : "Tap to use current location"}
        </Text>
      </Pressable>

      <Pressable
        onPress={submit}
        disabled={busy}
        style={({ pressed }) => [
          styles.primaryBtn,
          { marginTop: space.md },
          (busy || pressed) && { opacity: 0.7 },
        ]}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Post — start the 15-min window</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  heading: { fontSize: 22, fontWeight: "800", color: colors.text },
  sub: { color: colors.muted },

  photo: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: "#eee",
    borderRadius: radius.md,
  },
  linkBtn: { padding: space.sm, alignSelf: "center" },
  link: { color: colors.primary, fontWeight: "600" },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    backgroundColor: "#fff",
    color: colors.text,
    fontSize: 16,
  },

  locBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    backgroundColor: "#fff",
  },
  locLabel: { color: colors.muted, fontSize: 12, marginBottom: 2 },
  locValue: { color: colors.text, fontSize: 15, fontWeight: "600" },

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
  secondaryBtnText: { color: colors.text, fontWeight: "600", fontSize: 15 },
});
