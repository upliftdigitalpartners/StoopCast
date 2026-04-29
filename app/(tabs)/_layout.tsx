import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { shadow, useColors } from "@/lib/theme";

const Icon = ({ char, focused }: { char: string; focused: boolean }) => (
  <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{char}</Text>
);

function PostIcon({ focused }: { focused: boolean }) {
  const colors = useColors();
  return (
    <View
      style={{
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: colors.primary,
        alignItems: "center", justifyContent: "center",
        marginTop: -12,
        borderWidth: 4, borderColor: colors.bgElevated,
        ...shadow(2),
        opacity: focused ? 0.95 : 1,
      }}
    >
      <Text style={{ fontSize: 22, color: "#fff" }}>＋</Text>
    </View>
  );
}

export default function TabsLayout() {
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        headerShown: false,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Map", tabBarIcon: ({ focused }) => <Icon char="📍" focused={focused} /> }} />
      <Tabs.Screen name="activity" options={{ title: "Activity", tabBarIcon: ({ focused }) => <Icon char="📰" focused={focused} /> }} />
      <Tabs.Screen name="post" options={{ title: "", tabBarIcon: ({ focused }) => <PostIcon focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ focused }) => <Icon char="👤" focused={focused} /> }} />
    </Tabs>
  );
}
