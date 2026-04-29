import { Platform, type ViewStyle } from "react-native";

export const colors = {
  bg: "#f7f5f0",
  bgElevated: "#ffffff",
  card: "#ffffff",
  text: "#141414",
  textSoft: "#3a3a3a",
  muted: "#7a7268",
  border: "#e8e3da",
  borderStrong: "#d6cfc1",
  primary: "#e8593a",
  primaryDark: "#c8401e",
  accent: "#1f8c8c",
  success: "#1f8a4c",
  warn: "#d98e1c",
  danger: "#c0392b",
  pin: "#e8593a",
  pinClaimed: "#9a9a9a",
  pinExpiring: "#d98e1c",
  overlay: "rgba(20,20,20,0.55)",
};

export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const typography = {
  h1: { fontSize: 28, fontWeight: "800" as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: "800" as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  bodyStrong: { fontSize: 15, fontWeight: "600" as const },
  small: { fontSize: 13, fontWeight: "400" as const },
  smallStrong: { fontSize: 13, fontWeight: "600" as const },
  tiny: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.4 },
};

export function shadow(level: 1 | 2 | 3 = 1): ViewStyle {
  if (Platform.OS === "android") {
    return { elevation: level === 1 ? 2 : level === 2 ? 5 : 9 };
  }
  const map = {
    1: { shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    2: { shadowOpacity: 0.10, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
    3: { shadowOpacity: 0.14, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } },
  } as const;
  return { shadowColor: "#000", ...map[level] };
}

export function pinColorFor(status: string, minsLeft: number): string {
  if (status !== "live") return colors.pinClaimed;
  if (minsLeft <= 5) return colors.pinExpiring;
  return colors.pin;
}
