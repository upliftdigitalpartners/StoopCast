import { useState } from "react";
import {
  Alert,
  Image,
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
import { Button } from "@/components/Button";
import { colors, radius, shadow, space, typography } from "@/lib/theme";

export default function SignInScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password) return Alert.alert("Missing info", "Email and password required.");
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: handle ? { handle } : undefined },
        });
        if (error) throw error;
        Alert.alert("Welcome to StoopCast", "Check your email to confirm, then sign in.");
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
          <Image source={require("../../assets/icon.png")} style={styles.logo} />
          <Text style={styles.logoText}>StoopCast</Text>
          <Text style={styles.tagline}>Free stuff on stoops, before it's gone.</Text>
        </View>

        <View style={[styles.card, shadow(2)]}>
          <View style={styles.tabs}>
            <Tab label="Sign in" active={mode === "signin"} onPress={() => setMode("signin")} />
            <Tab label="Sign up" active={mode === "signup"} onPress={() => setMode("signup")} />
          </View>

          {mode === "signup" && (
            <Field
              label="Handle (optional)"
              placeholder="stoopking"
              value={handle}
              onChangeText={setHandle}
            />
          )}
          <Field
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
          <Field
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Button
            label={mode === "signin" ? "Sign in" : "Create account"}
            icon={mode === "signin" ? "→" : "✨"}
            onPress={submit}
            loading={busy}
          />
        </View>

        <Text style={styles.footer}>
          By continuing you agree to be a kind neighbor.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label, placeholder, value, onChangeText, secureTextEntry, keyboardType,
}: {
  label: string; placeholder: string;
  value: string; onChangeText: (s: string) => void;
  secureTextEntry?: boolean; keyboardType?: "default" | "email-address";
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  kav: { flex: 1, padding: space.lg, justifyContent: "center", gap: space.lg },
  brand: { alignItems: "center", gap: 6 },
  logo: { width: 84, height: 84, borderRadius: 22, marginBottom: space.sm },
  logoText: { ...typography.h1, color: colors.text },
  tagline: { ...typography.body, color: colors.muted, textAlign: "center" },

  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1, borderColor: colors.border,
    gap: space.md,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: "center" },
  tabActive: { backgroundColor: colors.bgElevated, ...shadow(1) },
  tabText: { ...typography.bodyStrong, color: colors.muted },
  tabTextActive: { color: colors.text },

  fieldLabel: { ...typography.smallStrong, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: space.md, fontSize: 16, color: colors.text,
    backgroundColor: colors.bg,
  },

  footer: { ...typography.small, color: colors.muted, textAlign: "center" },
});
