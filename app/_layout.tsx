import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/lib/auth";
import { isWelcomeSkipped } from "@/lib/onboarding";
import { colors } from "@/lib/theme";

function AuthGate() {
  const { session, loading, homeSet } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [skipChecked, setSkipChecked] = useState<boolean | null>(null);

  // Re-check the "welcome skipped" flag whenever the user changes.
  useEffect(() => {
    let cancelled = false;
    if (!session?.user?.id) {
      setSkipChecked(null);
      return;
    }
    isWelcomeSkipped(session.user.id).then((v) => {
      if (!cancelled) setSkipChecked(v);
    });
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const onWelcome = segments[0] === "welcome";

    if (!session) {
      if (!inAuthGroup) router.replace("/(auth)/sign-in");
      return;
    }

    // Signed in. Need both homeSet status and skipChecked before deciding.
    if (homeSet === null || skipChecked === null) return;

    const needsWelcome = !homeSet && !skipChecked;

    if (needsWelcome && !onWelcome) {
      router.replace("/welcome");
    } else if (!needsWelcome && (inAuthGroup || onWelcome)) {
      router.replace("/(tabs)");
    }
  }, [session, loading, homeSet, skipChecked, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="welcome" />
      <Stack.Screen
        name="post/[id]"
        options={{
          headerShown: true,
          title: "",
          headerTransparent: true,
          headerBackTitle: "Back",
          headerTintColor: colors.text,
          presentation: "card",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="dark" />
        <AuthGate />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
