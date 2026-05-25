import { Platform } from "react-native";

import { clearAuthenticatedRemoteImageCache } from "../components/profile/authenticated-remote-image";
import { clearOnboardingCompletionCache } from "../services/onboardingCompletionService";
import { clearAllStoredMatchDiscoveryState } from "./matchDiscoveryStorage";
import { clearAllStoredAuthData } from "./tokenStorage";

export async function clearEntireClientStorage() {
  await clearAllStoredAuthData({ clearEntireWebStorage: Platform.OS === "web" });

  if (Platform.OS !== "web") {
    await clearAllStoredMatchDiscoveryState();
  }

  clearAuthenticatedRemoteImageCache();
  clearOnboardingCompletionCache();
}