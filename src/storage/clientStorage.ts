import { Platform } from "react-native";

import { clearAuthenticatedRemoteImageCache } from "../components/profile/authenticated-remote-image";
import { clearOnboardingCompletionCache } from "../services/onboardingCompletionService";
import { clearCachedAccessibilitySettings } from "./accessibilitySettingsStorage";
import { clearAllStoredMatchDiscoveryState } from "./matchDiscoveryStorage";
import { clearAllStoredAuthData, getUserId } from "./tokenStorage";

export async function clearEntireClientStorage() {
  // Lido ANTES de limpar os tokens: e a chave da conclusao de onboarding
  // persistida. No web o `clearEntireWebStorage` ja apaga tudo; no nativo esta
  // e a unica remocao dessa chave.
  const userId = await getUserId();

  await clearAllStoredAuthData({ clearEntireWebStorage: Platform.OS === "web" });

  if (Platform.OS !== "web") {
    await clearAllStoredMatchDiscoveryState();
  }

  clearAuthenticatedRemoteImageCache();
  await clearOnboardingCompletionCache(userId);
  await clearCachedAccessibilitySettings();
}