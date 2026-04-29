import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { registerForPushAsync } from "@/lib/notifications";
import { markWelcomeSkipped } from "@/lib/onboarding";
import { Button } from "@/components/Button";
import { Pill } from "@/components/Pill";
import { buzz } from "@/lib/haptics";
import { radius, shadow, space, typography, useColors, useStyles, type ColorTokens } from "@/lib/theme";

export default function WelcomeScreen() {
  const colors = useColors();
  const styles = useStyles(mkStyles);
  const router = useRouter();
  const { session, refreshHome } = useAuth();
  const [homeSet, setHomeSet] = useState(false);
  const [pushSet, setPushSet] = useState(false);
  const [busyHome, setBusyHome] = useState(false);
  const [busyPush, setBusyPush] = useState(false);

  const setHome = async () => {
    setBusyHome(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Location needed", "Allow location to set your neighborhood.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { error } = await supabase.rpc("set_home_location", {
        p_lat: loc.coords.latitude, p_lng: loc.coords.longitude,
      });
      if (error) throw error;
      buzz.success();
      setHomeSet(true);
      await refreshHome();
    } catch (e: any) {
      Alert.alert("Couldn't save", e.message ?? String(e));
    } finally {
      setBusyHome(false);
    }
  };

  const enablePush = async () => {
    if (!session?.user?.id) return;
    setBusyPush(true);
    try {
      const perm = await Notifications.requestPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Notifications off", "You can enable them later in your device settings.");
      } else {
        const token = await registerForPushAsync(session.user.id);
        if (token) { buzz.success(); setPushSet(true); }
      }
    } catch (e: any) {
      Alert.alert("Couldn't enable", e.message ?? String(e));
    } finally {
      setBusyPush(false);
    }
  };

  const finish = async () => {
    if (session?.user?.id) await refreshHome();
    router.replace("/(tabs)");
  };

  const skip = async () => {
    if (session?.user?.id) await markWelcomeSkipped(session.user.id);
    router.replace("/(tabs)");
  };

  const allDone = homeSet && pushSet;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.brand}>
          <Image source={require("../assets/icon.png")} style={styles.logo} />
          <Text style={styles.h1}>Welcome to StoopCast</Text>
          <Text style={styles.tagline}>
            Two quick steps and you'll know the moment something free shows up on a stoop near you.
          </Text>
        </View>

        <Step n={1} title="Set your neighborhood"
          body="We'll only ping you about stoops within 1.5km of this point. No location, no spam."
          done={homeSet} ctaLabel={homeSet ? "Saved" : "Use current location"} ctaIcon="📍"
          onPress={setHome} loading={busyHome} colors={colors}
        />

        <Step n={2} title="Turn on notifications"
          body="The 15-minute alert window only matters if your phone buzzes. Promise we won't overdo it."
          done={pushSet} ctaLabel={pushSet ? "Enabled" : "Enable push"} ctaIcon="🔔"
          onPress={enablePush} loading={busyPush} colors={colors}
        />

        <View style={styles.actions}>
          <Button
            label={allDone ? "I'm ready — open the map" : "Open the map"}
            icon={allDone ? "🎉" : "→"}
            onPress={finish}
          />
          <Pressable onPress={skip} style={styles.skip}>
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Step({
  n, title, body, done, ctaLabel, ctaIcon, onPress, loading, colors,
}: {
  n: number; title: string; body: string; done: boolean;
  ctaLabel: string; ctaIcon: string; onPress: () => void; loading?: boolean;
  colors: ColorTokens;
}) {
  return (
    <View style={[
      {
        backgroundColor: done ? colors.liveSurface : colors.bgElevated,
        borderRadius: radius.md, padding: space.md,
        borderWidth: 1, borderColor: done ? colors.success : colors.border, gap: space.sm,
      },
      shadow(1),
    ]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <View style={{
          width: 28, height: 28, borderRadius: 14,
          borderWidth: 1.5,
          borderColor: done ? colors.success : colors.borderStrong,
          backgroundColor: done ? colors.success : colors.bg,
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontWeight: "800", color: done ? "#fff" : colors.muted, fontSize: 13 }}>{done ? "✓" : n}</Text>
        </View>
        <Text style={{ ...typography.h3, color: colors.text, flex: 1 }}>{title}</Text>
        {done ? <Pill label="done" tone="live" /> : null}
      </View>
      <Text style={{ ...typography.body, color: colors.muted, lineHeight: 20 }}>{body}</Text>
      <Button label={ctaLabel} icon={ctaIcon} variant={done ? "secondary" : "primary"} onPress={onPress} loading={loading} disabled={done} />
    </View>
  );
}

const mkStyles = (c: ColorTokens) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  scroll: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },

  brand: { alignItems: "center", gap: 4, marginBottom: space.sm },
  logo: { width: 72, height: 72, borderRadius: 18, marginBottom: space.sm },
  h1: { ...typography.h1, color: c.text, textAlign: "center" },
  tagline: { ...typography.body, color: c.muted, textAlign: "center", marginTop: 4 },

  actions: { gap: space.sm, marginTop: space.md },
  skip: { padding: space.sm, alignItems: "center" },
  skipText: { ...typography.smallStrong, color: c.muted },
});
