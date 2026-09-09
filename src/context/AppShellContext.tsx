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
import { AppState } from "react-native";

import { chatService } from "../services/chatService";
import { matchService } from "../services/matchService";
import { getCompletionForActiveSession } from "../services/onboardingCompletionService";
import { profileService } from "../services/profileService";
import {
  getStoredMatchDiscoveryState,
  saveStoredMatchDiscoveryState,
  subscribeToMatchDiscoveryStorage,
} from "../storage/matchDiscoveryStorage";
import type { UserProfileResponse } from "../types/profile";
import { getJwtSubject } from "../utils/jwt";
import { getForegroundLocationPermissionState } from "../utils/location";
import { useAuth } from "./AuthContext";

type AppShellContextValue = {
  currentUserId: string | null;
  currentUserProfileId: string | null;
  currentUserName: string;
  currentUserPhotoUrl: string | null;
  refreshProfileSummary: () => Promise<void>;
  refreshUnreadChatCount: () => Promise<void>;
  refreshUnseenProfilesCount: () => Promise<void>;
  syncProfileSummary: (profile: UserProfileResponse | null) => void;
  unreadChatCount: number;
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

/** Badge global de conversas: polling lento (C12 do plano). */
const UNREAD_CHAT_POLL_INTERVAL_MS = 60000;

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
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const unseenCountRequestRef = useRef(0);
  const unreadChatRequestRef = useRef(0);
  const shellHydrationRequestRef = useRef(0);
  const sessionRef = useRef(session);
  const hydratedSessionScopeIdRef = useRef<string | null>(null);
  // Escopo estavel: o `sub` do access token (UUID do usuario). Antes era um
  // hash do refresh token, que rotaciona a cada refresh e forcava uma
  // re-hidratacao completa do shell.
  const sessionScopeId = useMemo(
    () => getJwtSubject(session?.accessToken),
    [session?.accessToken]
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
    const scopeId = getJwtSubject(activeSession.accessToken);

    if (!scopeId) {
      setUnseenProfilesCount(0);
      return;
    }

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

  /**
   * Contagem global de mensagens nao lidas (badge da aba "Conversas").
   * Silenciosa por natureza: o badge e informacao secundaria e nao pode
   * disparar toast de erro por falha de rede.
   */
  const refreshUnreadChatCount = useCallback(async () => {
    if (!sessionRef.current?.accessToken) {
      setUnreadChatCount(0);
      return;
    }

    const requestId = ++unreadChatRequestRef.current;

    try {
      const response = await chatService.pollConversations();

      if (requestId === unreadChatRequestRef.current) {
        setUnreadChatCount(response.totalUnread ?? 0);
      }
    } catch {
      // silencioso: mantem o ultimo valor conhecido
    }
  }, []);

  // Polling lento do badge, apenas com o app ativo.
  useEffect(() => {
    if (!isReady || !isAuthenticated || !session?.accessToken) {
      setUnreadChatCount(0);
      return;
    }

    void refreshUnreadChatCount();

    const intervalId = setInterval(() => {
      if (AppState.currentState === "active") {
        void refreshUnreadChatCount();
      }
    }, UNREAD_CHAT_POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, isReady, refreshUnreadChatCount, session?.accessToken]);

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
        const completion = await getCompletionForActiveSession(session?.accessToken);

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
      refreshUnreadChatCount,
      refreshUnseenProfilesCount,
      syncProfileSummary,
      unreadChatCount,
      unseenProfilesCount,
    }),
    [
      profileSummary.userId,
      profileSummary.userProfileId,
      profileSummary.name,
      profileSummary.photoUrl,
      refreshProfileSummary,
      refreshUnreadChatCount,
      refreshUnseenProfilesCount,
      syncProfileSummary,
      unreadChatCount,
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