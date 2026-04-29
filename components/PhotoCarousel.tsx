import { useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { colors } from "@/lib/theme";

export function PhotoCarousel({ uris }: { uris: string[] }) {
  const [index, setIndex] = useState(0);
  const w = Dimensions.get("window").width;

  if (uris.length === 0) return null;
  if (uris.length === 1) return <Image source={{ uri: uris[0] }} style={[styles.single, { width: w }]} />;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / w);
    if (i !== index) setIndex(i);
  };

  return (
    <View>
      <FlatList
        data={uris}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(u, i) => `${i}_${u}`}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <Image source={{ uri: item }} style={[styles.single, { width: w }]} />
        )}
      />
      <View style={styles.dots}>
        {uris.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  single: { aspectRatio: 4 / 3, backgroundColor: "#eee" },
  dots: {
    position: "absolute", bottom: 12, left: 0, right: 0,
    flexDirection: "row", justifyContent: "center", gap: 6,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  dotOn: { backgroundColor: "#fff", width: 18 },
});
