import {
  type ComponentProps,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GlobalBottomNav } from "../../src/components/navigation/global-bottom-nav";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import { AuthenticatedRemoteImage } from "../../src/components/profile/authenticated-remote-image";
import { useRequireCompletedOnboarding } from "../../src/hooks/useRequireCompletedOnboarding";
import { matchService } from "../../src/services/matchService";
import { profileService } from "../../src/services/profileService";
import {
  createEmptyMatchDiscoveryState,
  createMatchDiscoveryScopeId,
  getStoredMatchDiscoveryState,
  saveStoredMatchDiscoveryState,
} from "../../src/storage/matchDiscoveryStorage";
import { getAuthSnapshot } from "../../src/storage/tokenStorage";
import type { UserPublicProfileResponse } from "../../src/types/profile";
import { formatApiErrorMessage } from "../../src/utils/auth";
import { showGlobalToast } from "../../src/utils/globalToast";
import { getForegroundLocationPermissionState } from "../../src/utils/location";
import { preloadAuthenticatedRemoteImages } from "../../src/components/profile/authenticated-remote-image";

const MAX_SEEN_PROFILE_IDS = 500;
const LOCATION_DISABLED_DISCOVERY_MESSAGE =
  "Ative a localizacao do dispositivo para descobrir novos perfis.";
const PHOTO_NAVIGATION_FALLBACK = (
  <LinearGradient
    colors={["#472D74", "#16151C"]}
    style={{
      alignItems: "center",
      height: "100%",
      justifyContent: "center",
      width: "100%",
    }}
  >
    <Ionicons name="person" size={132} color="#CDBDFF" />
  </LinearGradient>
);

type MatchProfile = {
  accessibilityNeeds: string[];
  age: number;
  id: string;
  autonomyLevel: string;
  bio: string;
  communicationPreferences: string[];
  connectionPreferences: string[];
  disabilities: string[];
  distanceKm: number | null;
  energyLevel: string;
  gender: string;
  occupation: string;
  pronouns: string;
  interests: string[];
  lifestyleTypes: string[];
  location: string;
  loveLanguages: string[];
  name: string;
  photoUrls: string[];
};

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View className="mt-3 flex-row flex-wrap gap-2">
      {items.map((item) => (
        <View key={item} className="rounded-full bg-[#24262B] px-4 py-3">
          <Text className="text-[15px] font-bold text-white">{item}</Text>
        </View>
      ))}
    </View>
  );
}

function InfoRow({
  icon,
  label,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label?: string | null;
}) {
  if (!label?.trim()) {
    return null;
  }

  return (
    <View className="border-b border-white/10 py-3">
      <View className="flex-row items-center">
        <Ionicons name={icon} size={21} color="#A7A6B3" />
        <Text className="ml-3 text-[18px] font-semibold text-white">
          {label}
        </Text>
      </View>
    </View>
  );
}

function DetailCard({
  children,
  icon,
  title,
}: PropsWithChildren<{
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
}>) {
  return (
    <View className="mb-4 rounded-[28px] bg-[#111214] p-5">
      <View className="flex-row items-center">
        <Ionicons name={icon} size={23} color="#A7A6B3" />
        <Text className="ml-3 text-[19px] font-black text-[#C9C6D3]">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function ProfileDetailsPanel({
  onAccept,
  onClose,
  onReject,
  profile,
}: {
  onAccept: () => void;
  onClose: () => void;
  onReject: () => void;
  profile: MatchProfile;
}) {
  return (
    <View className="absolute inset-0 bg-black">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-32 pt-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-5 flex-row items-start justify-between px-1">
          <Text className="text-[36px] font-semibold text-white">
            {profile.name}, {profile.age}
          </Text>
          <Pressable
            accessibilityLabel="Fechar detalhes"
            className="h-12 w-12 items-center justify-center rounded-full bg-white"
            onPress={onClose}
          >
            <Ionicons name="arrow-down" size={28} color="#111214" />
          </Pressable>
        </View>

        <DetailCard title="Sobre mim" icon="chatbubble-ellipses-outline">
          <Text className="mt-4 text-[20px] font-semibold leading-8 text-white">
            {profile.bio}
          </Text>
        </DetailCard>

        <DetailCard title="Informações básicas" icon="id-card-outline">
          <InfoRow
            icon="location-outline"
            label={
              typeof profile.distanceKm === "number"
                ? `${profile.distanceKm} km de distância`
                : null
            }
          />
          <InfoRow icon="briefcase-outline" label={profile.occupation} />
          <InfoRow icon="home-outline" label={profile.location} />
          <InfoRow icon="person-circle-outline" label={profile.pronouns} />
          <InfoRow icon="male-female-outline" label={profile.gender} />
          <InfoRow icon="accessibility-outline" label={profile.disabilities.join(", ")} />
        </DetailCard>

        <DetailCard title="Tô procurando" icon="search-outline">
          <ChipList items={profile.connectionPreferences} />
        </DetailCard>

        <DetailCard title="Interesses" icon="sparkles-outline">
          <ChipList items={profile.interests} />
        </DetailCard>

        <DetailCard title="Acessibilidade e autonomia" icon="body-outline">
          <InfoRow icon="walk-outline" label={profile.autonomyLevel} />
          <ChipList items={profile.accessibilityNeeds} />
        </DetailCard>

        <DetailCard title="Comunicação" icon="chatbubbles-outline">
          <ChipList items={profile.communicationPreferences} />
        </DetailCard>

        <DetailCard title="Estilo de vida" icon="leaf-outline">
          <InfoRow icon="flash-outline" label={profile.energyLevel} />
          <ChipList items={profile.lifestyleTypes} />
        </DetailCard>

        <DetailCard title="Linguagem do amor" icon="heart-outline">
          <ChipList items={profile.loveLanguages} />
        </DetailCard>
      </ScrollView>

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.9)"]}
        style={{
          bottom: 0,
          height: 132,
          left: 0,
          position: "absolute",
          right: 0,
        }}
      >
        <View className="absolute bottom-8 left-0 right-0 flex-row items-center justify-center gap-11">
          <Pressable
            className="h-[68px] w-[68px] items-center justify-center rounded-full bg-[#26282B]"
            onPress={onReject}
          >
            <Ionicons name="close" size={36} color="#FF2D73" />
          </Pressable>
          <Pressable
            accessibilityLabel="Dar match"
            className="h-[68px] w-[68px] items-center justify-center rounded-full bg-[#26282B]"
            onPress={onAccept}
          >
            <Ionicons name="heart" size={36} color="#65E568" />
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

function descriptions(items: { description: string }[] | null | undefined) {
  return (items ?? []).map((item) => item.description);
}

function resolvePublicProfilePhotoUrls(
  userProfileId: string,
  imageIds: string[] | null | undefined
) {
  const seenImageIds = new Set<string>();
  const photoUrls: string[] = [];

  for (const imageId of imageIds ?? []) {
    const normalizedImageId = imageId?.trim();

    if (!normalizedImageId || seenImageIds.has(normalizedImageId)) {
      continue;
    }

    const photoUrl = profileService.resolvePublicProfileImageUrl(
      userProfileId,
      normalizedImageId
    );

    if (!photoUrl) {
      continue;
    }

    seenImageIds.add(normalizedImageId);
    photoUrls.push(photoUrl);
  }

  return photoUrls;
}

function getActiveProfilePhotoUrl(profile: MatchProfile | null, photoIndex: number) {
  if (!profile) {
    return null;
  }

  return profile.photoUrls[photoIndex] ?? profile.photoUrls[0] ?? null;
}

function toMatchProfile(profile: UserPublicProfileResponse): MatchProfile {
  const displayName = profile.name?.trim() || "Perfil";
  const photoUrls = resolvePublicProfilePhotoUrls(
    profile.userProfileId,
    profile.galleryImageIds
  );

  return {
    accessibilityNeeds: descriptions(profile.accessibilityNeeds),
    age: profile.age ?? 0,
    autonomyLevel: profile.autonomyLevel?.description ?? "",
    bio: profile.bio?.trim() || "",
    communicationPreferences: descriptions(profile.communicationForms),
    connectionPreferences: [],
    disabilities: descriptions(profile.disabilities),
    distanceKm: null,
    energyLevel: profile.energyLevel?.description ?? "",
    gender: profile.gender?.description ?? "",
    id: profile.userProfileId,
    interests: descriptions(profile.interestTypes),
    lifestyleTypes: descriptions(profile.lifestyleTypes),
    location: "",
    loveLanguages: descriptions(profile.loveLanguages),
    name: displayName,
    occupation: "",
    photoUrls,
    pronouns: profile.pronouns?.description ?? "",
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

function appendSeenProfileId(profileIds: string[], profileId: string | null | undefined) {
  const normalizedProfileId = profileId?.trim();

  if (!normalizedProfileId) {
    return profileIds;
  }

  if (profileIds.includes(normalizedProfileId)) {
    return profileIds;
  }

  return [...profileIds, normalizedProfileId].slice(-MAX_SEEN_PROFILE_IDS);
}

function ProfilePhoto({
  authToken,
  photoUrl,
}: {
  authToken: string | null;
  photoUrl: string | null;
}) {
  if (photoUrl) {
    return (
      <AuthenticatedRemoteImage
        uri={photoUrl}
        authToken={authToken}
        className="h-full w-full"
        resizeMode="cover"
        fallback={PHOTO_NAVIGATION_FALLBACK}
      />
    );
  }

  return PHOTO_NAVIGATION_FALLBACK;
}

export default function Matches() {
  const { canAccessCompletedOnboardingContent } = useRequireCompletedOnboarding();

  const isFocused = useIsFocused();
  const router = useRouter();
  const [queuedProfileIds, setQueuedProfileIds] = useState<string[]>([]);
  const [seenProfileIds, setSeenProfileIds] = useState<string[]>([]);
  const [currentProfile, setCurrentProfile] = useState<MatchProfile | null>(null);
  const [nextProfile, setNextProfile] = useState<MatchProfile | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [currentUserScopeId, setCurrentUserScopeId] = useState<string | null>(null);
  const profileCacheRef = useRef<Map<string, MatchProfile>>(new Map());
  const visibleProfileLoadRef = useRef(0);
  const currentPhotoUrl = getActiveProfilePhotoUrl(currentProfile, currentPhotoIndex);

  const showPreviousPhoto = useCallback(() => {
    const totalPhotos = currentProfile?.photoUrls.length ?? 0;

    if (totalPhotos <= 1) {
      return;
    }

    setCurrentPhotoIndex((currentIndex) =>
      currentIndex === 0 ? totalPhotos - 1 : currentIndex - 1
    );
  }, [currentProfile?.photoUrls.length]);

  const showNextPhotoImage = useCallback(() => {
    const totalPhotos = currentProfile?.photoUrls.length ?? 0;

    if (totalPhotos <= 1) {
      return;
    }

    setCurrentPhotoIndex((currentIndex) =>
      currentIndex === totalPhotos - 1 ? 0 : currentIndex + 1
    );
  }, [currentProfile?.photoUrls.length]);

  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [currentProfile?.id]);

  useEffect(() => {
    if (!currentProfile || currentProfile.photoUrls.length === 0) {
      return;
    }

    void preloadAuthenticatedRemoteImages(currentProfile.photoUrls, authToken);
  }, [authToken, currentProfile]);

  const persistDiscoveryState = useCallback(
    async (scopeId: string, nextQueuedProfileIds: string[], nextSeenProfileIds: string[]) => {
      await saveStoredMatchDiscoveryState(scopeId, {
        queuedProfileIds: normalizeProfileIds(nextQueuedProfileIds),
        seenProfileIds: normalizeProfileIds(nextSeenProfileIds).slice(-MAX_SEEN_PROFILE_IDS),
        sessionDate: createEmptyMatchDiscoveryState().sessionDate,
      });
    },
    []
  );

  const loadProfileById = useCallback(async (profileId: string) => {
    const cachedProfile = profileCacheRef.current.get(profileId);

    if (cachedProfile) {
      return cachedProfile;
    }

    const profile = await profileService.getPublicProfile(profileId);
    const matchProfile = toMatchProfile(profile);

    profileCacheRef.current.set(profileId, matchProfile);

    return matchProfile;
  }, []);

  const resolveVisibleProfiles = useCallback(
    async (
      scopeId: string,
      nextQueuedProfileIds: string[],
      nextSeenProfileIds: string[],
      seedCurrentProfile?: MatchProfile | null
    ) => {
      const requestId = ++visibleProfileLoadRef.current;
      let resolvedQueueIds = [...nextQueuedProfileIds];
      let resolvedSeenProfileIds = [...nextSeenProfileIds];
      let firstError: unknown = null;

      if (resolvedQueueIds.length === 0) {
        setQueuedProfileIds([]);
        setSeenProfileIds(resolvedSeenProfileIds);
        setCurrentProfile(null);
        setNextProfile(null);
        setLoadingProfiles(false);
        await persistDiscoveryState(scopeId, [], resolvedSeenProfileIds);
        return;
      }

      const seededCurrentProfile =
        seedCurrentProfile && seedCurrentProfile.id === resolvedQueueIds[0]
          ? seedCurrentProfile
          : null;

      if (!seededCurrentProfile && !profileCacheRef.current.has(resolvedQueueIds[0])) {
        setLoadingProfiles(true);
      }

      while (resolvedQueueIds.length > 0) {
        try {
          const visibleCurrentProfile =
            seededCurrentProfile && seededCurrentProfile.id === resolvedQueueIds[0]
              ? seededCurrentProfile
              : await loadProfileById(resolvedQueueIds[0]);

          let visibleNextProfile: MatchProfile | null = null;

          if (resolvedQueueIds[1]) {
            try {
              visibleNextProfile = await loadProfileById(resolvedQueueIds[1]);
            } catch {
              visibleNextProfile = null;
            }
          }

          if (requestId !== visibleProfileLoadRef.current) {
            return;
          }

          setQueuedProfileIds(resolvedQueueIds);
          setSeenProfileIds(resolvedSeenProfileIds);
          setCurrentProfile(visibleCurrentProfile);
          setNextProfile(visibleNextProfile);
          setDetailsOpen(false);
          setLoadError("");
          setLoadingProfiles(false);

          await persistDiscoveryState(scopeId, resolvedQueueIds, resolvedSeenProfileIds);

          return;
        } catch (nextError) {
          firstError ??= nextError;
          resolvedSeenProfileIds = appendSeenProfileId(
            resolvedSeenProfileIds,
            resolvedQueueIds[0]
          );
          resolvedQueueIds = resolvedQueueIds.slice(1);
        }
      }

      if (requestId !== visibleProfileLoadRef.current) {
        return;
      }

      setQueuedProfileIds([]);
      setSeenProfileIds(resolvedSeenProfileIds);
      setCurrentProfile(null);
      setNextProfile(null);
      setLoadingProfiles(false);
      setLoadError(
        formatApiErrorMessage(
          firstError,
          "Não foi possível carregar perfis para descoberta agora."
        )
      );

      await persistDiscoveryState(scopeId, [], resolvedSeenProfileIds);
    },
    [loadProfileById, persistDiscoveryState]
  );

  const loadDiscoveryProfiles = useCallback(async () => {
    if (!canAccessCompletedOnboardingContent) {
      return;
    }

    const requestId = ++visibleProfileLoadRef.current;

    setLoadingProfiles(true);
    setLoadError("");

    try {
      const snapshot = await getAuthSnapshot();
      const nextAuthToken = snapshot.session?.accessToken ?? null;
      const scopeId = createMatchDiscoveryScopeId(
        snapshot.session?.refreshToken ?? snapshot.session?.accessToken
      );
      const locationPermission = await getForegroundLocationPermissionState().catch(
        () => null
      );

      setAuthToken(nextAuthToken);

      if (requestId !== visibleProfileLoadRef.current) {
        return;
      }

      if (!locationPermission?.granted) {
        setCurrentUserScopeId(null);
        setQueuedProfileIds([]);
        setSeenProfileIds([]);
        setCurrentProfile(null);
        setNextProfile(null);
        setLoadError(LOCATION_DISABLED_DISCOVERY_MESSAGE);
        return;
      }

      setCurrentUserScopeId(scopeId);

      const storedState = await getStoredMatchDiscoveryState(scopeId);
      const nextSeenProfileIds = normalizeProfileIds(storedState.seenProfileIds);
      let nextQueuedProfileIds = normalizeProfileIds(storedState.queuedProfileIds);

      if (nextQueuedProfileIds.length === 0) {
        const discoveryIds = await matchService.getDiscoveryFeed({
          alreadyUsedProfileIds: nextSeenProfileIds,
        });

        nextQueuedProfileIds = normalizeProfileIds(discoveryIds).filter(
          (profileId) => !nextSeenProfileIds.includes(profileId)
        );
      }

      if (requestId !== visibleProfileLoadRef.current) {
        return;
      }

      await resolveVisibleProfiles(scopeId, nextQueuedProfileIds, nextSeenProfileIds);
    } catch (nextError) {
      setLoadError(
        formatApiErrorMessage(
          nextError,
          "Não foi possível carregar perfis para descoberta agora."
        )
      );
      setQueuedProfileIds([]);
      setSeenProfileIds([]);
      setCurrentProfile(null);
      setNextProfile(null);
    } finally {
      if (requestId === visibleProfileLoadRef.current) {
        setLoadingProfiles(false);
      }
    }
  }, [canAccessCompletedOnboardingContent, resolveVisibleProfiles]);

  useEffect(() => {
    if (isFocused && canAccessCompletedOnboardingContent) {
      void loadDiscoveryProfiles();
    }
  }, [canAccessCompletedOnboardingContent, isFocused, loadDiscoveryProfiles]);

  const showNextProfile = useCallback(async () => {
    if (!currentUserScopeId || !currentProfile) {
      return;
    }

    const remainingQueuedProfileIds = queuedProfileIds[0] === currentProfile.id
      ? queuedProfileIds.slice(1)
      : queuedProfileIds.filter((profileId) => profileId !== currentProfile.id);
    const nextSeenProfileIds = appendSeenProfileId(seenProfileIds, currentProfile.id);
    const seedCurrentProfile =
      nextProfile && nextProfile.id === remainingQueuedProfileIds[0] ? nextProfile : null;

    if (!seedCurrentProfile && remainingQueuedProfileIds.length > 0) {
      setLoadingProfiles(true);
    }

    setQueuedProfileIds(remainingQueuedProfileIds);
    setSeenProfileIds(nextSeenProfileIds);
    setCurrentProfile(seedCurrentProfile);
    setNextProfile(null);
    setDetailsOpen(false);

    await persistDiscoveryState(
      currentUserScopeId,
      remainingQueuedProfileIds,
      nextSeenProfileIds
    );

    await resolveVisibleProfiles(
      currentUserScopeId,
      remainingQueuedProfileIds,
      nextSeenProfileIds,
      seedCurrentProfile
    );
  }, [
    currentProfile,
    currentUserScopeId,
    nextProfile,
    persistDiscoveryState,
    queuedProfileIds,
    resolveVisibleProfiles,
    seenProfileIds,
  ]);

  function restartProfiles() {
    void loadDiscoveryProfiles();
    setDetailsOpen(false);
  }

  async function acceptCurrentProfile() {
    if (!currentProfile || submitting) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await matchService.createOrAnswerMatch({
        targetProfileId: currentProfile.id,
        accepted: true,
      });

      await showNextProfile();

      if (response.mutualMatch) {
        router.push({
          pathname: "/matches/success",
          params: {
            name: currentProfile.name,
            photo: currentPhotoUrl ?? undefined,
          },
        });
        return;
      }

      showGlobalToast({
        title: "Interesse enviado",
        message: "Se a outra pessoa também curtir você, o match aparece aqui.",
        variant: "success",
      });
    } catch (nextError) {
      showGlobalToast({
        title: "Não foi possível enviar",
        message: formatApiErrorMessage(
          nextError,
          "Não foi possível registrar seu interesse agora."
        ),
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="flex-1 bg-black">
        <GlobalTopNav />

        <View className="flex-1 overflow-hidden rounded-b-[44px] bg-[#111214]">
          {loadingProfiles ? (
            <View className="flex-1 items-center justify-center px-8">
              <ActivityIndicator color="#EAEA00" />
              <Text className="mt-4 text-center text-[16px] font-semibold text-[#CAC3D8]">
                Buscando perfis compatíveis...
              </Text>
            </View>
          ) : currentProfile ? (
            <>
              <ProfilePhoto authToken={authToken} photoUrl={currentPhotoUrl} />

                {currentProfile.photoUrls.length > 1 ? (
                  <View className="absolute top-4 left-0 right-0 items-center justify-center">
                    <Text className="text-[16px] font-bold text-white/75">
                      {currentPhotoIndex + 1}/{currentProfile.photoUrls.length}
                    </Text>
                  </View>
                ) : null}

              <LinearGradient
                colors={[
                  "rgba(0,0,0,0.02)",
                  "rgba(0,0,0,0.34)",
                  "rgba(0,0,0,0.92)",
                ]}
                locations={[0, 0.46, 1]}
                style={{
                  bottom: 0,
                  left: 0,
                  position: "absolute",
                  right: 0,
                  top: 0,
                }}
              />

              {currentProfile.photoUrls.length > 1 ? (
                <View
                  pointerEvents="box-none"
                  style={{
                    bottom: 0,
                    justifyContent: "center",
                    left: 0,
                    position: "absolute",
                    right: 0,
                    top: 0,
                  }}
                >
                  <View className="flex-row items-center justify-between px-5">
                    <Pressable
                      accessibilityLabel="Ver foto anterior"
                      className="h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-black/35"
                      onPress={showPreviousPhoto}
                    >
                      <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
                    </Pressable>

                    <Pressable
                      accessibilityLabel="Ver próxima foto"
                      className="h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-black/35"
                      onPress={showNextPhotoImage}
                    >
                      <Ionicons name="chevron-forward" size={28} color="#FFFFFF" />
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View className="absolute bottom-32 left-7 right-7">
                <Text className="text-[34px] font-semibold text-white">
                  {currentProfile.name}{", "}
                  <Text className="text-[34px] font-normal text-white/75">
                    {currentProfile.age}
                  </Text>
                  <Text className="text-[18px] font-normal text-white/75">
                    {currentProfile.pronouns && !currentProfile.pronouns.startsWith("Prefiro") ? ` (${currentProfile.pronouns})` : ""}
                  </Text>
                </Text>

                <Text className="mt-2 text-[16px] font-normal leading-2 text-white">
                  {currentProfile.bio}
                </Text>

              </View>

              <View className="absolute bottom-8 left-0 right-0 flex-row items-center justify-center gap-11">
                <Pressable
                  className="h-[68px] w-[68px] items-center justify-center rounded-full bg-[#26282B]"
                  disabled={submitting}
                  onPress={() => {
                    void showNextProfile();
                  }}
                >
                  <Ionicons name="close" size={36} color="#FF2D73" />
                </Pressable>
                <Pressable
                  accessibilityLabel="Dar match"
                  className="h-[68px] w-[68px] items-center justify-center rounded-full bg-[#26282B]"
                  disabled={submitting}
                  onPress={acceptCurrentProfile}
                >
                  {submitting ? (
                    <ActivityIndicator color="#65E568" size="small" />
                  ) : (
                    <Ionicons name="heart" size={36} color="#65E568" />
                  )}
                </Pressable>
              </View>
              
              <View className="absolute top-4 left-4 right-4 items-end justify-end">
                  <Pressable
                    accessibilityLabel="Ver gostos e preferências"
                    className="h-12 w-36 items-center justify-center rounded-full border border-white/35 bg-black/25"
                    onPress={() => setDetailsOpen((isOpen) => !isOpen)}
                  >
                    <View className="flex-row items-center">
                      <Text className="text-[14px] font-semibold text-white">
                        Mais Detalhes
                      </Text>
                      <Ionicons
                        name={detailsOpen ? "arrow-down" : "arrow-up"}
                        size={18}
                        color="#ffffff"
                      />
                    </View>
                </Pressable>
              </View>

              {detailsOpen ? (
                <ProfileDetailsPanel
                  profile={currentProfile}
                  onAccept={acceptCurrentProfile}
                  onClose={() => setDetailsOpen(false)}
                  onReject={() => {
                    void showNextProfile();
                  }}
                />
              ) : null}
            </>
          ) : (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-center text-[28px] font-black text-white">
                Você chegou ao fim da lista
              </Text>
              <Text className="mt-4 text-center text-[16px] font-semibold leading-6 text-[#CAC3D8]">
                {loadError || "Novos perfis aparecerão aqui quando estiverem disponíveis."}
              </Text>
              <Pressable
                className="mt-8 rounded-full bg-[#EAEA00] px-8 py-4"
                onPress={restartProfiles}
              >
                <Text className="text-[16px] font-black text-[#202020]">
                  Ver novamente
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <GlobalBottomNav />
      </SafeAreaView>
    </View>
  );
}
