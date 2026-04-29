import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = (userId: string) => `welcome_skipped_${userId}`;

export async function isWelcomeSkipped(userId: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY(userId));
    return v === "1";
  } catch {
    return false;
  }
}

export async function markWelcomeSkipped(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY(userId), "1");
  } catch {}
}

export async function clearWelcomeSkipped(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY(userId));
  } catch {}
}
