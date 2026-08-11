import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { UserAccessibilitySettingsResponse } from "../types/accessibility";

const ACCESSIBILITY_SETTINGS_KEY = "unify.accessibility.settings";

const webStorageFallback = (() => {
  if (Platform.OS !== "web") {
    return null;
  }

  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
})();

async function getStoredValue(key: string): Promise<string | null> {
  if (webStorageFallback) {
    return webStorageFallback.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

async function setStoredValue(key: string, value: string): Promise<void> {
  if (webStorageFallback) {
    webStorageFallback.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function deleteStoredValue(key: string): Promise<void> {
  if (webStorageFallback) {
    webStorageFallback.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export async function getCachedAccessibilitySettings(): Promise<UserAccessibilitySettingsResponse | null> {
  const raw = await getStoredValue(ACCESSIBILITY_SETTINGS_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as UserAccessibilitySettingsResponse;
  } catch {
    return null;
  }
}

export async function saveCachedAccessibilitySettings(
  settings: UserAccessibilitySettingsResponse
): Promise<void> {
  await setStoredValue(ACCESSIBILITY_SETTINGS_KEY, JSON.stringify(settings));
}

export async function clearCachedAccessibilitySettings(): Promise<void> {
  await deleteStoredValue(ACCESSIBILITY_SETTINGS_KEY);
}
