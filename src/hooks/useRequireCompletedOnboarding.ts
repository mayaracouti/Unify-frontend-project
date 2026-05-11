import { useEffect } from "react";
import { useRouter } from "expo-router";

import { profileService } from "../services/profileService";

export function useRequireCompletedOnboarding() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function routeByProfileCompletion() {
      try {
        const completion = await profileService.getCompletion();

        if (!active) {
          return;
        }

        if (!completion.profileCompleted) {
          router.replace("/onboarding/profile");
          return;
        }

        if (!completion.matchPreferencesCompleted) {
          router.replace("/onboarding/match-preferences");
        }
      } catch {
        // Keep the current protected screen visible if completion cannot be loaded.
      }
    }

    void routeByProfileCompletion();

    return () => {
      active = false;
    };
  }, [router]);
}