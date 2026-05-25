import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { matchService } from "../services/matchService";
import { getCompletionForActiveSession } from "../services/onboardingCompletionService";
import { profileService } from "../services/profileService";
import {
  createMatchDiscoveryScopeId,
  getStoredMatchDiscoveryState,
  saveStoredMatchDiscoveryState,
  subscribeToMatchDiscoveryStorage,
} from "../storage/matchDiscoveryStorage";
import type { UserProfileResponse } from "../types/profile";
import { getForegroundLocationPermissionState } from "../utils/location";
import { useAuth } from "./AuthContext";

type AppShellContextValue = {
  currentUserId: string | null;
  currentUserProfileId: string | null;
  currentUserName: string;
  currentUserPhotoUrl: string | null;
  refreshProfileSummary: () => Promise<void>;
  refreshUnseenProfilesCount: () => Promise<void>;
  syncProfileSummary: (profile: UserProfileResponse | null) => void;
  unseenProfilesCount: number;
};

type ProfileSummary = {
  userId: string | null;
  userProfileId: string | null;
  name: string;
  photoUrl: string | null;
};

const DEFAULT_PROFILE_SUMMARY: ProfileSummary = {
  userId: null,
  userProfileId: null,
  name: "Perfil",
  photoUrl: null,
};

const AppShellContext = createContext<AppShellContextValue | undefined>(undefined);

function buildDisplayName(profile: UserProfileResponse | null) {
  const userName = profile?.user?.name?.trim();
  const profileName = profile?.name?.trim();

  return userName || profileName || DEFAULT_PROFILE_SUMMARY.name;
}

function buildProfilePhotoUrl(profile: UserProfileResponse | null) {
  const firstImage = profile?.profilePicture ?? profile?.galleryImages?.[0];

  return profileService.resolveProfileImageUrl(firstImage?.url);
}

function buildProfileSummary(profile: UserProfileResponse | null): ProfileSummary {
  return {
    userId: profile?.user?.id?.trim() || null,
    userProfileId: profile?.id?.trim() || null,
    name: buildDisplayName(profile),
    photoUrl: buildProfilePhotoUrl(profile),
  };
}

function normalizeProfileIds(profileIds: string[] | null | undefined) {
  const uniqueProfileIds = new Set<string>();

  for (const profileId of profileIds ?? []) {
    const normalizedProfileId = profileId?.trim();

    if (!normalizedProfileId) {
      continue;
    }

    uniqueProfileIds.add(normalizedProfileId);
  }

  return Array.from(uniqueProfileIds);
}

export function AppShellProvider({ children }: PropsWithChildren) {
  const { isAuthenticated, isReady, session } = useAuth();
  const [profileSummary, setProfileSummary] = useState(DEFAULT_PROFILE_SUMMARY);
  const [unseenProfilesCount, setUnseenProfilesCount] = useState(0);
  const unseenCountRequestRef = useRef(0);
  const shellHydrationRequestRef = useRef(0);
  const sessionRef = useRef(session);
  const hydratedSessionScopeIdRef = useRef<string | null>(null);
  const sessionScopeId = useMemo(
    () =>
      session
        ? createMatchDiscoveryScopeId(session.refreshToken ?? session.accessToken)
        : null,
    [session?.accessToken, session?.refreshToken]
  );

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const syncProfileSummary = useCallback((profile: UserProfileResponse | null) => {
    setProfileSummary(buildProfileSummary(profile));
  }, []);

  const refreshProfileSummary = useCallback(async () => {
    if (!sessionRef.current) {
      setProfileSummary(DEFAULT_PROFILE_SUMMARY);
      return;
    }

    try {
      const profile = await profileService.getProfile();
      setProfileSummary(buildProfileSummary(profile));
    } catch {
      setProfileSummary((currentSummary) =>
        currentSummary.userId ||
        currentSummary.photoUrl ||
        currentSummary.name !== DEFAULT_PROFILE_SUMMARY.name
          ? currentSummary
          : DEFAULT_PROFILE_SUMMARY
      );
    }
  }, []);

  const refreshUnseenProfilesCount = useCallback(async () => {
    const activeSession = sessionRef.current;

    if (!activeSession) {
      setUnseenProfilesCount(0);
      return;
    }

    const requestId = ++unseenCountRequestRef.current;
    const scopeId = createMatchDiscoveryScopeId(
      activeSession.refreshToken ?? activeSession.accessToken
    );
    const locationPermission = await getForegroundLocationPermissionState().catch(() => null);

    if (!locationPermission?.granted) {
      if (requestId === unseenCountRequestRef.current) {
        setUnseenProfilesCount(0);
      }

      return;
    }

    try {
      const storedState = await getStoredMatchDiscoveryState(scopeId);
      const seenProfileIds = normalizeProfileIds(storedState.seenProfileIds);
      let queuedProfileIds = normalizeProfileIds(storedState.queuedProfileIds);

      if (queuedProfileIds.length === 0) {
        const discoveryIds = await matchService.getDiscoveryFeed({
          alreadyUsedProfileIds: seenProfileIds,
        });

        queuedProfileIds = normalizeProfileIds(discoveryIds).filter(
          (profileId) => !seenProfileIds.includes(profileId)
        );

        await saveStoredMatchDiscoveryState(scopeId, {
          queuedProfileIds,
          seenProfileIds,
          sessionDate: storedState.sessionDate,
        });
      }

      if (requestId === unseenCountRequestRef.current) {
        setUnseenProfilesCount(queuedProfileIds.length);
      }
    } catch {
      if (requestId === unseenCountRequestRef.current) {
        setUnseenProfilesCount(0);
      }
    }
  }, []);

  useEffect(() => {
    if (!isReady || !isAuthenticated || !sessionScopeId) {
      shellHydrationRequestRef.current += 1;
      hydratedSessionScopeIdRef.current = null;
      setProfileSummary(DEFAULT_PROFILE_SUMMARY);
      setUnseenProfilesCount(0);
      return;
    }

    if (hydratedSessionScopeIdRef.current === sessionScopeId) {
      return;
    }

    hydratedSessionScopeIdRef.current = sessionScopeId;

    const requestId = ++shellHydrationRequestRef.current;
    let active = true;

    async function hydrateShellState() {
      try {
        const completion = await getCompletionForActiveSession(
          session?.accessToken,
          session?.refreshToken
        );

        if (!active || requestId !== shellHydrationRequestRef.current) {
          return;
        }

        if (!completion?.profileCompleted) {
          setProfileSummary(DEFAULT_PROFILE_SUMMARY);
          setUnseenProfilesCount(0);
          return;
        }

        await refreshProfileSummary();

        if (!active || requestId !== shellHydrationRequestRef.current) {
          return;
        }

        if (!completion.matchPreferencesCompleted) {
          setUnseenProfilesCount(0);
          return;
        }

        await refreshUnseenProfilesCount();
      } catch {
        if (!active || requestId !== shellHydrationRequestRef.current) {
          return;
        }

        setProfileSummary(DEFAULT_PROFILE_SUMMARY);
        setUnseenProfilesCount(0);
      }
    }

    void hydrateShellState();

    return () => {
      active = false;
    };
  }, [
    isAuthenticated,
    isReady,
    session?.accessToken,
    session?.refreshToken,
    sessionScopeId,
    refreshProfileSummary,
    refreshUnseenProfilesCount,
  ]);

  useEffect(() => {
    if (!sessionScopeId) {
      return;
    }

    return subscribeToMatchDiscoveryStorage((updatedScopeId, state) => {
      if (updatedScopeId !== sessionScopeId) {
        return;
      }

      setUnseenProfilesCount(state.queuedProfileIds.length);
    });
  }, [sessionScopeId]);

  const value = useMemo<AppShellContextValue>(
    () => ({
      currentUserId: profileSummary.userId,
      currentUserProfileId: profileSummary.userProfileId,
      currentUserName: profileSummary.name,
      currentUserPhotoUrl: profileSummary.photoUrl,
      refreshProfileSummary,
      refreshUnseenProfilesCount,
      syncProfileSummary,
      unseenProfilesCount,
    }),
    [
      profileSummary.userId,
      profileSummary.userProfileId,
      profileSummary.name,
      profileSummary.photoUrl,
      refreshProfileSummary,
      refreshUnseenProfilesCount,
      syncProfileSummary,
      unseenProfilesCount,
    ]
  );

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell() {
  const context = useContext(AppShellContext);

  if (!context) {
    throw new Error("useAppShell must be used within an AppShellProvider.");
  }

  return context;
}