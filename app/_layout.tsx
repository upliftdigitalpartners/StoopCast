import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/lib/auth";
import { isWelcomeSkipped } from "@/lib/onboarding";
import { useColors } from "@/lib/theme";

function AuthGate() {
  const colors = useColors();
  const { session, loading, homeSet } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [skipChecked, setSkipChecked] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!session?.user?.id) { setSkipChecked(null); return; }
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
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
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
  const scheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <AuthGate />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
