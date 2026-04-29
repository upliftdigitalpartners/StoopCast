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
import { radius, shadow, space, typography, useColors, useStyles, type ColorTokens } from "@/lib/theme";

type Mode = "signin" | "signup" | "reset";

export default function SignInScreen() {
  const colors = useColors();
  const styles = useStyles(mkStyles);
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
          email, password,
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
        Alert.alert("Check your email", "We sent a link to reset your password. Open it on this phone to finish.");
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
      Alert.alert("Check your email", "We sent a magic link. Tap it on this phone to sign in — no password needed.");
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
              <Tab label="Sign in" active={mode === "signin"} onPress={() => setMode("signin")} colors={colors} />
              <Tab label="Sign up" active={mode === "signup"} onPress={() => setMode("signup")} colors={colors} />
            </View>
          )}

          {mode === "signup" && (
            <Field label="Handle (optional)" placeholder="stoopking" value={handle} onChangeText={setHandle} colors={colors} />
          )}

          <Field label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" colors={colors} />

          {mode !== "reset" && (
            <PasswordField value={password} onChangeText={setPassword} show={showPw} onToggle={() => setShowPw((v) => !v)} colors={colors} />
          )}

          {mode === "signin" ? (
            <Pressable onPress={() => setMode("reset")} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          ) : null}

          <Button
            label={mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Email reset link"}
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
            <Button label="Send magic link" icon="🔮" variant="secondary" onPress={sendMagicLink} loading={busyMagic} />
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

function Tab({ label, active, onPress, colors }: { label: string; active: boolean; onPress: () => void; colors: ColorTokens }) {
  return (
    <Pressable onPress={onPress} style={[
      { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: "center" },
      active && { backgroundColor: colors.bgElevated, ...shadow(1) },
    ]}>
      <Text style={[typography.bodyStrong, { color: active ? colors.text : colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label, placeholder, value, onChangeText, keyboardType, colors,
}: {
  label: string; placeholder: string;
  value: string; onChangeText: (s: string) => void;
  keyboardType?: "default" | "email-address";
  colors: ColorTokens;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ ...typography.smallStrong, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</Text>
      <TextInput
        style={{
          borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
          padding: space.md, fontSize: 16, color: colors.text,
          backgroundColor: colors.inputBg,
        }}
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
  value, onChangeText, show, onToggle, colors,
}: {
  value: string; onChangeText: (s: string) => void;
  show: boolean; onToggle: () => void;
  colors: ColorTokens;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ ...typography.smallStrong, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>Password</Text>
      <View style={{ position: "relative", justifyContent: "center" }}>
        <TextInput
          style={{
            borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
            padding: space.md, fontSize: 16, color: colors.text,
            backgroundColor: colors.inputBg, paddingRight: 64,
          }}
          placeholder="••••••••"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!show}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={colors.muted}
        />
        <Pressable onPress={onToggle} style={{ position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center", paddingHorizontal: 4 }} hitSlop={8}>
          <Text style={{ ...typography.smallStrong, color: colors.primary }}>{show ? "Hide" : "Show"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const mkStyles = (c: ColorTokens) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  kav: { flex: 1, padding: space.lg, justifyContent: "center", gap: space.lg },
  brand: { alignItems: "center", gap: 6 },
  logo: { width: 84, height: 84, borderRadius: 22, marginBottom: space.sm },
  logoText: { ...typography.h1, color: c.text },
  tagline: { ...typography.body, color: c.muted, textAlign: "center" },

  card: {
    backgroundColor: c.bgElevated,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1, borderColor: c.border,
    gap: space.md,
  },
  resetHeader: { gap: 4 },
  resetTitle: { ...typography.h3, color: c.text },
  resetSub: { ...typography.small, color: c.muted },

  tabs: {
    flexDirection: "row",
    backgroundColor: c.bg,
    borderRadius: radius.md,
    padding: 4, gap: 4,
  },

  forgotBtn: { alignSelf: "flex-end", marginTop: -4, padding: 4 },
  forgotText: { ...typography.smallStrong, color: c.primary },

  divider: { flexDirection: "row", alignItems: "center", gap: space.sm, marginVertical: 4 },
  line: { flex: 1, height: 1, backgroundColor: c.border },
  dividerText: { ...typography.small, color: c.muted },

  backBtn: { alignSelf: "center", padding: space.sm },
  backText: { ...typography.smallStrong, color: c.primary },

  footer: { ...typography.small, color: c.muted, textAlign: "center" },
});
