import { useMemo } from "react";
import { Platform, useColorScheme, type ViewStyle } from "react-native";

export const lightColors = {
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
  // Tinted surface backgrounds used by status banners.
  liveSurface: "#e8f5ee",
  liveBorder: "#bfe5cf",
  warnSurface: "#fff5e6",
  warnBorder: "#f4d9aa",
  primarySurface: "#fde8e3",
  primaryBorder: "#f5c5b8",
  inputBg: "#f7f5f0",
};

export const darkColors: typeof lightColors = {
  bg: "#0f1110",
  bgElevated: "#1a1c1b",
  card: "#1a1c1b",
  text: "#f4f1ea",
  textSoft: "#cfcabf",
  muted: "#8a857c",
  border: "#2a2c2b",
  borderStrong: "#3a3c3b",
  primary: "#ff6a4a",
  primaryDark: "#e84d2c",
  accent: "#33b5b5",
  success: "#3ba368",
  warn: "#e8a634",
  danger: "#e05a4d",
  pin: "#ff6a4a",
  pinClaimed: "#5a5a5a",
  pinExpiring: "#e8a634",
  overlay: "rgba(0,0,0,0.65)",
  liveSurface: "#173024",
  liveBorder: "#2c5942",
  warnSurface: "#332615",
  warnBorder: "#5a4628",
  primarySurface: "#3a1d15",
  primaryBorder: "#5a2d20",
  inputBg: "#15171a",
};

export type ColorTokens = typeof lightColors;

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

export function useColors(): ColorTokens {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkColors : lightColors;
}

export function useStyles<T>(maker: (c: ColorTokens) => T): T {
  const colors = useColors();
  return useMemo(() => maker(colors), [colors]);
}

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

export function pinColorFor(c: ColorTokens, status: string, minsLeft: number): string {
  if (status !== "live") return c.pinClaimed;
  if (minsLeft <= 5) return c.pinExpiring;
  return c.pin;
}
