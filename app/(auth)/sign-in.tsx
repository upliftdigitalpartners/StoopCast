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
import { buzz } from "@/lib/haptics";
import { colors, radius, shadow, space, typography } from "@/lib/theme";

type Mode = "signin" | "signup" | "reset";

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyMagic, setBusyMagic] = useState(false);

  const submit = async () => {
    if (!email) return Alert.alert("Email required");
    if (mode !== "reset" && !password) return Alert.alert("Password required");

    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: handle ? { handle } : undefined },
        });
        if (error) throw error;
        buzz.success();
        Alert.alert("Welcome to StoopCast", "Check your email to confirm, then sign in.");
        setMode("signin");
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        buzz.success();
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: "stoopcast://reset-password",
        });
        if (error) throw error;
        buzz.success();
        Alert.alert(
          "Check your email",
          "We sent a link to reset your password. Open it on this phone to finish.",
        );
        setMode("signin");
      }
    } catch (e: any) {
      buzz.error();
      Alert.alert("Auth error", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const sendMagicLink = async () => {
    if (!email) return Alert.alert("Email required", "Enter your email first.");
    setBusyMagic(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: "stoopcast://" },
      });
      if (error) throw error;
      buzz.success();
      Alert.alert(
        "Check your email",
        "We sent a magic link. Tap it on this phone to sign in — no password needed.",
      );
    } catch (e: any) {
      buzz.error();
      Alert.alert("Couldn't send", e.message ?? String(e));
    } finally {
      setBusyMagic(false);
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
          {mode === "reset" ? (
            <View style={styles.resetHeader}>
              <Text style={styles.resetTitle}>Reset password</Text>
              <Text style={styles.resetSub}>We'll email you a link.</Text>
            </View>
          ) : (
            <View style={styles.tabs}>
              <Tab label="Sign in" active={mode === "signin"} onPress={() => setMode("signin")} />
              <Tab label="Sign up" active={mode === "signup"} onPress={() => setMode("signup")} />
            </View>
          )}

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

          {mode !== "reset" && (
            <PasswordField
              value={password}
              onChangeText={setPassword}
              show={showPw}
              onToggle={() => setShowPw((v) => !v)}
            />
          )}

          {mode === "signin" ? (
            <Pressable onPress={() => setMode("reset")} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          ) : null}

          <Button
            label={
              mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Email reset link"
            }
            icon={mode === "signin" ? "→" : mode === "signup" ? "✨" : "✉️"}
            onPress={submit}
            loading={busy}
          />

          {mode !== "reset" && (
            <View style={styles.divider}>
              <View style={styles.line} /><Text style={styles.dividerText}>or</Text><View style={styles.line} />
            </View>
          )}

          {mode !== "reset" && (
            <Button
              label="Send magic link"
              icon="🔮"
              variant="secondary"
              onPress={sendMagicLink}
              loading={busyMagic}
            />
          )}

          {mode === "reset" ? (
            <Pressable onPress={() => setMode("signin")} style={styles.backBtn}>
              <Text style={styles.backText}>← Back to sign in</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.footer}>By continuing you agree to be a kind neighbor.</Text>
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
  label, placeholder, value, onChangeText, keyboardType,
}: {
  label: string; placeholder: string;
  value: string; onChangeText: (s: string) => void;
  keyboardType?: "default" | "email-address";
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
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

function PasswordField({
  value, onChangeText, show, onToggle,
}: {
  value: string; onChangeText: (s: string) => void;
  show: boolean; onToggle: () => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>Password</Text>
      <View style={styles.pwWrap}>
        <TextInput
          style={[styles.input, styles.pwInput]}
          placeholder="••••••••"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!show}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={colors.muted}
        />
        <Pressable onPress={onToggle} style={styles.pwToggle} hitSlop={8}>
          <Text style={styles.pwToggleText}>{show ? "Hide" : "Show"}</Text>
        </Pressable>
      </View>
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
  resetHeader: { gap: 4 },
  resetTitle: { ...typography.h3, color: colors.text },
  resetSub: { ...typography.small, color: colors.muted },

  tabs: {
    flexDirection: "row",
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 4, gap: 4,
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
  pwWrap: { position: "relative", justifyContent: "center" },
  pwInput: { paddingRight: 64 },
  pwToggle: {
    position: "absolute", right: 12, top: 0, bottom: 0,
    justifyContent: "center", paddingHorizontal: 4,
  },
  pwToggleText: { ...typography.smallStrong, color: colors.primary },

  forgotBtn: { alignSelf: "flex-end", marginTop: -4, padding: 4 },
  forgotText: { ...typography.smallStrong, color: colors.primary },

  divider: { flexDirection: "row", alignItems: "center", gap: space.sm, marginVertical: 4 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.small, color: colors.muted },

  backBtn: { alignSelf: "center", padding: space.sm },
  backText: { ...typography.smallStrong, color: colors.primary },

  footer: { ...typography.small, color: colors.muted, textAlign: "center" },
});
