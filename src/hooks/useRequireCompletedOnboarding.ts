import { useEffect, useState } from "react";
import { useRouter } from "expo-router";

import { useAuth } from "../context/AuthContext";
import {
  createOnboardingCompletionSessionKey,
  getCompletionForSessionKey,
  hasCompletedOnboardingForSession,
} from "../services/onboardingCompletionService";

type UseRequireCompletedOnboardingResult = {
  canAccessCompletedOnboardingContent: boolean;
  isCheckingOnboardingCompletion: boolean;
};

export function useRequireCompletedOnboarding(): UseRequireCompletedOnboardingResult {
  const router = useRouter();
  const { isAuthenticated, isReady, session } = useAuth();
  const sessionKey = createOnboardingCompletionSessionKey(
    session?.accessToken,
    session?.refreshToken
  );
  const [canAccessCompletedOnboardingContent, setCanAccessCompletedOnboardingContent] =
    useState(hasCompletedOnboardingForSession(sessionKey));
  const [isCheckingOnboardingCompletion, setIsCheckingOnboardingCompletion] = useState(
    Boolean(sessionKey && !hasCompletedOnboardingForSession(sessionKey))
  );

  useEffect(() => {
    if (!isReady) {
      setCanAccessCompletedOnboardingContent(false);
      setIsCheckingOnboardingCompletion(true);
      return;
    }

    if (!isAuthenticated || !sessionKey) {
      setCanAccessCompletedOnboardingContent(false);
      setIsCheckingOnboardingCompletion(false);
      return;
    }

    if (hasCompletedOnboardingForSession(sessionKey)) {
      setCanAccessCompletedOnboardingContent(true);
      setIsCheckingOnboardingCompletion(false);
      return;
    }

    let active = true;
    setCanAccessCompletedOnboardingContent(false);
    setIsCheckingOnboardingCompletion(true);

    async function routeByProfileCompletion() {
      try {
        const completion = await getCompletionForSessionKey(sessionKey);

        if (!active) {
          return;
        }

        if (!completion.profileCompleted) {
          setIsCheckingOnboardingCompletion(false);
          router.replace("/onboarding/profile");
          return;
        }

        if (!completion.matchPreferencesCompleted) {
          setIsCheckingOnboardingCompletion(false);
          router.replace("/onboarding/match-preferences");
          return;
        }

        setCanAccessCompletedOnboardingContent(true);
        setIsCheckingOnboardingCompletion(false);
      } catch {
        if (!active) {
          return;
        }

        // Keep the current protected screen visible if completion cannot be loaded.
        setCanAccessCompletedOnboardingContent(true);
        setIsCheckingOnboardingCompletion(false);
      }
    }

    void routeByProfileCompletion();

    return () => {
      active = false;
    };
  }, [isAuthenticated, isReady, router, sessionKey]);

  return {
    canAccessCompletedOnboardingContent,
    isCheckingOnboardingCompletion,
  };
}