import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { colors, radius, space } from "@/lib/theme";

export default function SignInScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      Alert.alert("Missing info", "Email and password required.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: handle ? { handle } : undefined },
        });
        if (error) throw error;
        Alert.alert("Welcome to StoopCast", "Check your email to confirm your account, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      Alert.alert("Auth error", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.kav}
      >
        <View style={styles.brand}>
          <Text style={styles.logo}>StoopCast</Text>
          <Text style={styles.tagline}>Free stuff on stoops, before it's gone.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>{mode === "signin" ? "Sign in" : "Create account"}</Text>

          {mode === "signup" && (
            <TextInput
              style={styles.input}
              placeholder="handle (optional)"
              autoCapitalize="none"
              value={handle}
              onChangeText={setHandle}
              placeholderTextColor={colors.muted}
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholderTextColor={colors.muted}
          />
          <TextInput
            style={styles.input}
            placeholder="password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholderTextColor={colors.muted}
          />

          <Pressable
            onPress={submit}
            disabled={busy}
            style={({ pressed }) => [
              styles.button,
              (busy || pressed) && { opacity: 0.7 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === "signin" ? "Sign in" : "Create account"}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={() => setMode(mode === "signin" ? "signup" : "signin")}>
            <Text style={styles.switch}>
              {mode === "signin"
                ? "No account yet? Sign up"
                : "Already have an account? Sign in"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  kav: { flex: 1, padding: space.lg, justifyContent: "center" },
  brand: { alignItems: "center", marginBottom: space.xl },
  logo: { fontSize: 36, fontWeight: "800", color: colors.primary, letterSpacing: -0.5 },
  tagline: { color: colors.muted, marginTop: space.xs, fontSize: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.md,
  },
  heading: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: space.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: space.md,
    alignItems: "center",
    marginTop: space.xs,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  switch: { color: colors.primary, textAlign: "center", marginTop: space.sm, fontSize: 14 },
});
