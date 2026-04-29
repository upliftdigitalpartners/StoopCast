import { StyleSheet, Text, View } from "react-native";
import { shadow, useColors } from "@/lib/theme";

export function MapPin({
  minutesLeft, status,
}: {
  minutesLeft: number;
  status: string;
}) {
  const colors = useColors();
  const isLive = status === "live" && minutesLeft > 0;
  const isExpiring = isLive && minutesLeft <= 5;
  const bg = !isLive ? colors.pinClaimed : isExpiring ? colors.pinExpiring : colors.pin;

  return (
    <View style={styles.wrap}>
      <View style={[styles.bubble, { backgroundColor: bg }, shadow(2)]}>
        <Text style={styles.bubbleText}>
          {isLive ? `${minutesLeft}m` : status === "claimed" ? "✓" : "—"}
        </Text>
      </View>
      <View style={[styles.tail, { borderTopColor: bg }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  bubble: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  bubbleText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -2,
  },
});
