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
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Linking,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  buildActionSpeech,
  buildPublicProfileSpeech,
  useTTS,
} from "../../src/accessibility/tts";
import { GlobalBottomNav } from "../../src/components/navigation/global-bottom-nav";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import {
  AuthenticatedRemoteImage,
  preloadAuthenticatedRemoteImages,
} from "../../src/components/profile/authenticated-remote-image";
import { ReportModal } from "../../src/components/report/report-modal";
import { ScreenEmpty } from "../../src/components/ui/screen-empty";
import { ScreenError } from "../../src/components/ui/screen-error";
import { ScreenLoading } from "../../src/components/ui/screen-loading";
import { followService } from "../../src/services/followService";
import { matchService } from "../../src/services/matchService";
import { profileService } from "../../src/services/profileService";
import {
  createEmptyMatchDiscoveryState,
  getStoredMatchDiscoveryState,
  saveStoredMatchDiscoveryState,
} from "../../src/storage/matchDiscoveryStorage";
import { getAuthSnapshot } from "../../src/storage/tokenStorage";
import type { UserPublicProfileResponse } from "../../src/types/profile";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../src/utils/auth";
import { showGlobalToast } from "../../src/utils/globalToast";
import {
  getForegroundLocationPermissionState,
  requestForegroundLocationPermissionState,
} from "../../src/utils/location";

const MAX_SEEN_PROFILE_IDS = 500;
const LOCATION_DISABLED_DISCOVERY_MESSAGE =
  "Ative a localização do dispositivo para descobrir novos perfis.";
const LOCATION_BLOCKED_DISCOVERY_MESSAGE =
  "O acesso à localização foi bloqueado no celular. Abra os ajustes do aparelho para liberar e voltar a descobrir perfis.";
const LOCATION_PERMISSION_FAILED_MESSAGE =
  "Não foi possível obter a permissão de localização agora. Tente novamente.";
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
  /**
   * Id do `User` dono do perfil — alvo da denuncia, que e por usuario e nao
   * por perfil. `GET /users/{id}/public-profile` (UserPublicProfileResponse)
   * ainda NAO devolve esse id, entao aqui ele fica `null` e a denuncia usa o
   * `userProfileId` como fallback (ver ReportModal no render).
   */
  userId: string | null;
};

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  // A lista de chips e uma unidade semantica: um foco de leitor de tela em vez
  // de N paradas, uma por chip.
  return (
    <View
      accessible
      accessibilityRole="list"
      accessibilityLabel={items.join(", ")}
      className="mt-3 flex-row flex-wrap gap-2"
    >
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
      <View accessible accessibilityLabel={label} className="flex-row items-center">
        <Ionicons
          name={icon}
          size={21}
          color="#A7A6B3"
          importantForAccessibility="no"
        />
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
        <Ionicons
          name={icon}
          size={23}
          color="#A7A6B3"
          importantForAccessibility="no"
        />
        <Text
          accessibilityRole="header"
          className="ml-3 text-[19px] font-black text-[#C9C6D3]"
        >
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function ProfileDetailsContent({ profile }: { profile: MatchProfile }) {
  return (
    <View className="bg-black px-4 pb-40 pt-8">
      <Text
        accessibilityRole="header"
        className="mb-5 px-1 text-[36px] font-semibold text-white"
      >
        {profile.name}, {profile.age}
      </Text>

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
    // O contrato publico nao expoe o id do `User`; ver comentario em MatchProfile.
    userId: null,
  };
}

/**
 * Descricao completa do perfil para o leitor de tela.
 * Regra: nome, idade, pronomes, distancia e bio resumida — nessa ordem, porque e
 * a ordem em que a informacao aparece visualmente.
 */
function buildProfileAccessibilityLabel(profile: MatchProfile): string {
  const parts: string[] = [profile.name];

  if (profile.age > 0) {
    parts.push(`${profile.age} anos`);
  }

  if (profile.pronouns && !profile.pronouns.startsWith("Prefiro")) {
    parts.push(`pronomes ${profile.pronouns}`);
  }

  if (typeof profile.distanceKm === "number") {
    parts.push(`a ${Math.round(profile.distanceKm)} quilômetros de você`);
  }

  const summary = summarizeBio(profile.bio);

  if (summary) {
    parts.push(summary);
  }

  if (profile.photoUrls.length > 1) {
    parts.push(`${profile.photoUrls.length} fotos disponíveis`);
  }

  return `${parts.join(". ")}.`;
}

/** Resume a bio em no maximo 160 caracteres, cortando na ultima palavra inteira. */
function summarizeBio(bio: string): string {
  const normalized = bio?.trim();

  if (!normalized) {
    return "";
  }

  if (normalized.length <= 160) {
    return normalized;
  }

  const cut = normalized.slice(0, 160);
  const lastSpace = cut.lastIndexOf(" ");

  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}...`;
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
  photoCount,
  photoIndex,
  photoUrl,
  profileName,
}: {
  authToken: string | null;
  photoCount: number;
  photoIndex: number;
  photoUrl: string | null;
  profileName: string;
}) {
  if (photoUrl) {
    return (
      <AuthenticatedRemoteImage
        accessibilityLabel={
          photoCount > 1
            ? `Foto de ${profileName}, ${photoIndex + 1} de ${photoCount}`
            : `Foto de ${profileName}`
        }
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

  const isFocused = useIsFocused();
  const router = useRouter();
  const { speak } = useTTS();
  const [queuedProfileIds, setQueuedProfileIds] = useState<string[]>([]);
  const [seenProfileIds, setSeenProfileIds] = useState<string[]>([]);
  const [currentProfile, setCurrentProfile] = useState<MatchProfile | null>(null);
  const [nextProfile, setNextProfile] = useState<MatchProfile | null>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [locationBlocked, setLocationBlocked] = useState(false);
  const [canAskLocationPermissionAgain, setCanAskLocationPermissionAgain] =
    useState(true);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "requesting" | "failed"
  >("idle");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [currentUserScopeId, setCurrentUserScopeId] = useState<string | null>(null);
  const [followState, setFollowState] = useState<{
    following: boolean;
    followersCount: number;
  } | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const profileCacheRef = useRef<Map<string, MatchProfile>>(new Map());
  const followStatsLoadRef = useRef(0);
  const visibleProfileLoadRef = useRef(0);
  const contentScrollRef = useRef<ScrollView | null>(null);
  const detailsSpokenProfileIdRef = useRef<string | null>(null);
  const currentPhotoUrl = getActiveProfilePhotoUrl(currentProfile, currentPhotoIndex);
  // Sem "perguntar de novo" o popup nativo nao aparece mais: o unico caminho
  // e abrir os ajustes do sistema.
  const showLocationSettingsButton =
    Platform.OS !== "web" && locationBlocked && !canAskLocationPermissionAgain;

  const resetContentScroll = useCallback(() => {
    detailsSpokenProfileIdRef.current = null;
    contentScrollRef.current?.scrollTo({ animated: false, y: 0 });
  }, []);

  const handleContentLayout = useCallback((event: LayoutChangeEvent) => {
    setContentHeight(event.nativeEvent.layout.height);
  }, []);

  const handleContentScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!currentProfile || contentHeight === 0) {
        return;
      }

      const scrolledIntoDetails =
        event.nativeEvent.contentOffset.y > contentHeight * 0.4;

      if (!scrolledIntoDetails) {
        return;
      }

      if (detailsSpokenProfileIdRef.current === currentProfile.id) {
        return;
      }

      detailsSpokenProfileIdRef.current = currentProfile.id;
      // Acao sobre entidade dinamica: nome vindo do backend.
      speak(buildActionSpeech("Mais detalhes de", currentProfile.name));
    },
    [contentHeight, currentProfile, speak]
  );

  const showPreviousPhoto = useCallback(() => {
    const totalPhotos = currentProfile?.photoUrls.length ?? 0;

    if (totalPhotos <= 1) {
      return;
    }

    setCurrentPhotoIndex((currentIndex) => {
      const nextIndex = currentIndex === 0 ? totalPhotos - 1 : currentIndex - 1;
      speak(`Foto ${nextIndex + 1} de ${totalPhotos}`);
      // Fonte unica do anuncio da troca de foto: vale para as duas setas.
      announceForAccessibility(
        accessibilityAnnouncements.photoChanged(nextIndex + 1, totalPhotos)
      );
      return nextIndex;
    });
  }, [currentProfile?.photoUrls.length, speak]);

  const showNextPhotoImage = useCallback(() => {
    const totalPhotos = currentProfile?.photoUrls.length ?? 0;

    if (totalPhotos <= 1) {
      return;
    }

    setCurrentPhotoIndex((currentIndex) => {
      const nextIndex = currentIndex === totalPhotos - 1 ? 0 : currentIndex + 1;
      speak(`Foto ${nextIndex + 1} de ${totalPhotos}`);
      announceForAccessibility(
        accessibilityAnnouncements.photoChanged(nextIndex + 1, totalPhotos)
      );
      return nextIndex;
    });
  }, [currentProfile?.photoUrls.length, speak]);

  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [currentProfile?.id]);

  // O perfil visivel muda como resultado direto da interacao (curtir/recusar/
  // recarregar): fala o conteudo semantico do perfil em exibicao — dado de
  // runtime vindo do backend, nunca string fixa.
  const spokenProfileIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isFocused || !currentProfile) {
      return;
    }

    if (spokenProfileIdRef.current === currentProfile.id) {
      return;
    }

    spokenProfileIdRef.current = currentProfile.id;
    speak(buildPublicProfileSpeech(currentProfile));
    // Canal do leitor de tela do sistema: o `speak` acima fica mudo quando o
    // TalkBack/VoiceOver esta ligado, entao os dois nunca falam juntos.
    announceForAccessibility(
      accessibilityAnnouncements.profileShown(
        currentProfile.name,
        currentProfile.age,
        currentProfile.distanceKm
      )
    );
  }, [currentProfile, isFocused, speak]);

  // Fim da fila: nada muda visualmente sob o foco do usuario, entao o aviso
  // precisa ser anunciado. O estado de carregamento ja e coberto pela
  // `accessibilityLiveRegion` do `ScreenLoading` — nao anunciamos de novo aqui.
  useEffect(() => {
    if (loadingProfiles || currentProfile) {
      return;
    }

    // A falta de localizacao tem aviso proprio (com o botao de ativar), entao
    // nao anunciamos "fim da lista" — seria enganoso e duplicaria a fala.
    if (locationBlocked) {
      const locationMessage = showLocationSettingsButton
        ? accessibilityAnnouncements.locationPermissionBlocked()
        : accessibilityAnnouncements.locationPermissionRequired();

      // Dois canais que nunca soam juntos: `speak` fica mudo com o leitor de
      // tela nativo ligado, `announceForAccessibility` so soa com ele ligado.
      speak(locationMessage);
      announceForAccessibility(locationMessage);
      return;
    }

    announceForAccessibility(accessibilityAnnouncements.queueEnded());
  }, [
    currentProfile,
    loadingProfiles,
    locationBlocked,
    showLocationSettingsButton,
    speak,
  ]);

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
          resetContentScroll();
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
    [loadProfileById, persistDiscoveryState, resetContentScroll]
  );

  const loadDiscoveryProfiles = useCallback(async () => {
    const requestId = ++visibleProfileLoadRef.current;

    setLoadingProfiles(true);
    setLoadError("");

    try {
      const snapshot = await getAuthSnapshot();
      const nextAuthToken = snapshot.session?.accessToken ?? null;
      const scopeId = snapshot.userId;
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
        setLoadError("");
        setLocationBlocked(true);
        setCanAskLocationPermissionAgain(locationPermission?.canAskAgain ?? true);
        return;
      }

      setLocationBlocked(false);

      // Sem `sub` no access token nao ha escopo estavel para persistir o
      // estado de descoberta; sem ele o feed nao pode ser montado.
      if (!scopeId) {
        setCurrentUserScopeId(null);
        setQueuedProfileIds([]);
        setSeenProfileIds([]);
        setCurrentProfile(null);
        setNextProfile(null);
        setLoadError("Nao foi possivel identificar sua sessao. Entre novamente.");
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
  }, [resolveVisibleProfiles]);

  useEffect(() => {
    if (isFocused) {
      void loadDiscoveryProfiles();
    }
  }, [isFocused, loadDiscoveryProfiles]);

  /**
   * Estado de "seguir" do perfil visivel.
   *
   * O contador proprio evita que a resposta de um perfil ja trocado (swipe
   * rapido) sobrescreva o estado do perfil que esta na tela agora.
   */
  useEffect(() => {
    const profileId = currentProfile?.id;

    setFollowState(null);
    setFollowBusy(false);
    // O perfil mudou: um formulario de denuncia aberto apontaria para a pessoa
    // errada, entao ele fecha junto.
    setReportModalVisible(false);

    if (!profileId) {
      return;
    }

    const requestId = ++followStatsLoadRef.current;

    void followService
      .getFollowStats(profileId)
      .then((stats) => {
        if (requestId !== followStatsLoadRef.current) {
          return;
        }

        setFollowState({
          followersCount: stats.followersCount,
          following: stats.followedByCurrentUser,
        });
      })
      .catch(() => {
        // Global API error toast already explains the failure.
      });
  }, [currentProfile?.id]);

  /**
   * Seguir / deixar de seguir com atualizacao otimista: o botao troca antes da
   * resposta e volta ao estado anterior se a requisicao falhar.
   */
  const toggleFollowCurrentProfile = useCallback(async () => {
    if (!currentProfile || !followState || followBusy) {
      return;
    }

    const profileId = currentProfile.id;
    const profileName = currentProfile.name;
    const previousState = followState;
    const willFollow = !previousState.following;

    setFollowBusy(true);
    setFollowState({
      followersCount: Math.max(
        0,
        previousState.followersCount + (willFollow ? 1 : -1)
      ),
      following: willFollow,
    });

    try {
      const response = willFollow
        ? await followService.follow(profileId)
        : await followService.unfollow(profileId);

      setFollowState({
        followersCount: response.followersCount,
        following: response.following,
      });
      announceForAccessibility(
        response.following
          ? accessibilityAnnouncements.followStarted(profileName)
          : accessibilityAnnouncements.followStopped(profileName)
      );
    } catch {
      setFollowState(previousState);
      // Global API error toast already explains the failure.
    } finally {
      setFollowBusy(false);
    }
  }, [currentProfile, followBusy, followState]);

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
    resetContentScroll();

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
    resetContentScroll,
    resolveVisibleProfiles,
    seenProfileIds,
  ]);

  function restartProfiles() {
    void loadDiscoveryProfiles();
    resetContentScroll();
  }

  /**
   * Pede a permissao de localizacao ao sistema (o popup nativo). Se o usuario
   * conceder, a fila de descoberta e recarregada na hora.
   */
  async function handleGrantLocationAccess() {
    if (locationStatus === "requesting") {
      return;
    }

    try {
      setLocationStatus("requesting");

      const permission = await requestForegroundLocationPermissionState();

      setCanAskLocationPermissionAgain(permission.canAskAgain);
      setLocationStatus("idle");

      if (permission.granted) {
        setLocationBlocked(false);
        speak(accessibilityAnnouncements.locationPermissionGranted());
        announceForAccessibility(
          accessibilityAnnouncements.locationPermissionGranted()
        );
        restartProfiles();
        return;
      }

      // Quando o sistema para de perguntar, o bloco troca para o botao de
      // ajustes e o proprio efeito da tela anuncia a mudanca — nao falamos
      // duas vezes aqui.
      if (permission.canAskAgain) {
        speak(accessibilityAnnouncements.locationPermissionDenied());
        announceForAccessibility(
          accessibilityAnnouncements.locationPermissionDenied()
        );
      }
    } catch {
      const permission = await getForegroundLocationPermissionState().catch(
        () => null
      );

      if (permission) {
        setCanAskLocationPermissionAgain(permission.canAskAgain);
      }

      setLocationStatus("failed");
      speak(LOCATION_PERMISSION_FAILED_MESSAGE);
      announceForAccessibility(LOCATION_PERMISSION_FAILED_MESSAGE);
    }
  }

  /** Ultimo recurso: o sistema nao pergunta mais, so os ajustes resolvem. */
  async function handleOpenLocationSettings() {
    if (Platform.OS === "web") {
      return;
    }

    await Linking.openSettings();
  }

  /**
   * Recusa o perfil visivel e registra a decisao no servidor.
   *
   * A recusa e uma acao de baixo risco: se o servidor falhar, seguimos em frente
   * (o id continua na lista local de vistos) e NAO interrompemos o fluxo com um
   * toast de erro.
   */
  async function declineCurrentProfile() {
    if (!currentProfile || submitting) {
      return;
    }

    const declinedName = currentProfile.name;

    // Acao sobre entidade dinamica: "Recusar" + nome vindo do backend.
    speak(buildActionSpeech("Recusar", declinedName));
    setSubmitting(true);

    try {
      await matchService.createOrAnswerMatch({
        targetProfileId: currentProfile.id,
        accepted: false,
      });
    } catch (nextError) {
      if (__DEV__) {
        console.warn("[matches] Falha ao registrar recusa", nextError);
      }
    } finally {
      setSubmitting(false);
    }

    await showNextProfile();
    announceForAccessibility(accessibilityAnnouncements.profileDeclined(declinedName));
  }

  async function acceptCurrentProfile() {
    if (!currentProfile || submitting) {
      return;
    }

    speak(buildActionSpeech("Curtir", currentProfile.name));
    setSubmitting(true);

    try {
      const response = await matchService.createOrAnswerMatch({
        targetProfileId: currentProfile.id,
        accepted: true,
      });

      await showNextProfile();

      if (response.mutualMatch) {
        announceForAccessibility(
          accessibilityAnnouncements.newMutualMatch(currentProfile.name)
        );
        // A4: a tela de sucesso le `reduceMotion` do proprio contexto, entao
        // nao ha nada de movimento para propagar por parametro aqui.
        // F-C11.2: `matchId` alimenta o botao "Iniciar Conversa" da tela de sucesso.
        router.push({
          pathname: "/matches/success",
          params: {
            matchId: response.id,
            name: currentProfile.name,
            photo: currentPhotoUrl ?? undefined,
          },
        });
        return;
      }

      announceForAccessibility(
        accessibilityAnnouncements.interestSent(currentProfile.name)
      );
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

        <View
          className="flex-1 overflow-hidden rounded-b-[44px] bg-[#111214]"
          onLayout={handleContentLayout}
        >
          {loadingProfiles ? (
            <ScreenLoading label="Buscando perfis compatíveis..." />
          ) : currentProfile ? (
            <>
              <ScrollView
                ref={contentScrollRef}
                className="flex-1"
                onScroll={handleContentScroll}
                scrollEventThrottle={64}
                showsVerticalScrollIndicator={false}
              >
                <View style={{ height: contentHeight || undefined }}>
                  <ProfilePhoto
                    authToken={authToken}
                    photoCount={currentProfile.photoUrls.length}
                    photoIndex={currentPhotoIndex}
                    photoUrl={currentPhotoUrl}
                    profileName={currentProfile.name}
                  />

                  {currentProfile.photoUrls.length > 1 ? (
                    <View
                      accessible
                      accessibilityRole="text"
                      accessibilityLabel={`Foto ${currentPhotoIndex + 1} de ${currentProfile.photoUrls.length}`}
                      className="absolute top-4 left-0 right-0 items-center justify-center"
                    >
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
                          accessible
                          accessibilityRole="button"
                          accessibilityLabel="Ver foto anterior"
                          accessibilityHint={`Foto ${currentPhotoIndex + 1} de ${currentProfile.photoUrls.length}`}
                          className="h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-black/35"
                          onPress={showPreviousPhoto}
                        >
                          <Ionicons
                            name="chevron-back"
                            size={28}
                            color="#FFFFFF"
                            importantForAccessibility="no"
                          />
                        </Pressable>

                        <Pressable
                          accessible
                          accessibilityRole="button"
                          accessibilityLabel="Ver próxima foto"
                          accessibilityHint={`Foto ${currentPhotoIndex + 1} de ${currentProfile.photoUrls.length}`}
                          className="h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-black/35"
                          onPress={showNextPhotoImage}
                        >
                          <Ionicons
                            name="chevron-forward"
                            size={28}
                            color="#FFFFFF"
                            importantForAccessibility="no"
                          />
                        </Pressable>
                      </View>
                    </View>
                  ) : null}

                  <View className="absolute bottom-32 left-7 right-7">
                    {/* Denuncia tambem aqui, junto do nome: sem isso ela so
                        existiria depois de rolar ate os detalhes. */}
                    <Pressable
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel="Denunciar este perfil"
                      accessibilityHint="Abre o formulário de denúncia de perfil"
                      className="absolute right-0 top-0 z-10 h-10 w-10 items-center justify-center rounded-full bg-black/50"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => {
                        speak(buildActionSpeech("Denunciar", currentProfile.name));
                        setReportModalVisible(true);
                      }}
                    >
                      <Ionicons
                        name="flag-outline"
                        size={20}
                        color="#FFFFFF"
                        importantForAccessibility="no"
                      />
                    </Pressable>

                    {/* Nome, idade, pronomes e bio sao uma unidade semantica:
                        um unico foco de leitor de tela, nao quatro. */}
                    <View
                      accessible
                      accessibilityRole="summary"
                      accessibilityLabel={buildProfileAccessibilityLabel(currentProfile)}
                      className="pr-12"
                    >
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

                    <View
                      accessible
                      accessibilityRole="text"
                      accessibilityLabel="Role a tela para baixo para ver mais detalhes do perfil"
                      className="mt-4 flex-row items-center"
                    >
                      <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
                      <Text className="ml-2 text-[14px] font-semibold text-white/75">
                        Role para ver mais detalhes
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Acoes sociais do perfil visivel. Ficam no topo dos detalhes
                    (e nao na barra de decisao) para nao se confundirem com
                    curtir/recusar, que mudam a fila de descoberta. */}
                <View
                  accessibilityRole="toolbar"
                  accessibilityLabel={`Ações sobre o perfil de ${currentProfile.name}`}
                  className="flex-row items-center justify-between gap-3 bg-black px-4 pt-6"
                >
                  <Pressable
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={
                      followState?.following
                        ? `Deixar de seguir ${currentProfile.name}`
                        : `Seguir ${currentProfile.name}`
                    }
                    accessibilityHint={
                      followState?.following
                        ? "Remove as publicações desta pessoa do seu feed"
                        : "Publicações desta pessoa aparecem no seu feed"
                    }
                    accessibilityState={{
                      busy: followBusy,
                      disabled: followBusy || !followState,
                      selected: followState?.following ?? false,
                    }}
                    className={`flex-1 flex-row items-center justify-center rounded-full border px-4 py-2 ${
                      followState?.following
                        ? "border-[#CDBDFF] bg-[#2B2338]"
                        : "border-[#494455] bg-[#1A1C1F]"
                    }`}
                    disabled={followBusy || !followState}
                    onPress={() => {
                      speak(
                        buildActionSpeech(
                          followState?.following ? "Deixar de seguir" : "Seguir",
                          currentProfile.name
                        )
                      );
                      void toggleFollowCurrentProfile();
                    }}
                  >
                    {followBusy ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Ionicons
                        name={
                          followState?.following ? "checkmark" : "person-add-outline"
                        }
                        size={18}
                        color="#FFFFFF"
                        importantForAccessibility="no"
                      />
                    )}
                    <Text className="ml-2 text-[15px] font-bold text-white">
                      {followState?.following ? "Seguindo" : "Seguir"}
                    </Text>
                  </Pressable>

                  {followState ? (
                    <Text
                      accessible
                      accessibilityRole="text"
                      accessibilityLabel={
                        followState.followersCount === 1
                          ? "1 seguidor"
                          : `${followState.followersCount} seguidores`
                      }
                      className="text-[14px] font-semibold text-[#A7A6B3]"
                    >
                      {followState.followersCount === 1
                        ? "1 seguidor"
                        : `${followState.followersCount} seguidores`}
                    </Text>
                  ) : null}

                  <Pressable
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel="Denunciar este perfil"
                    accessibilityHint="Abre o formulário de denúncia de perfil"
                    className="h-10 w-10 items-center justify-center rounded-full bg-[#1E1A22]"
                    onPress={() => {
                      speak(buildActionSpeech("Denunciar", currentProfile.name));
                      setReportModalVisible(true);
                    }}
                  >
                    <Ionicons
                      name="flag-outline"
                      size={20}
                      color="#FFFFFF"
                      importantForAccessibility="no"
                    />
                  </Pressable>
                </View>

                <ProfileDetailsContent profile={currentProfile} />
              </ScrollView>

              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.9)"]}
                pointerEvents="box-none"
                style={{
                  bottom: 0,
                  height: 132,
                  left: 0,
                  position: "absolute",
                  right: 0,
                }}
              >
                {/* Barra de decisao — alternativa acessivel ao swipe.
                    Alvos de 72x72 (acima do minimo de 44), rotulos completos e
                    estado busy durante o envio. */}
                <View
                  accessibilityRole="toolbar"
                  accessibilityLabel="Decisão sobre este perfil"
                  className="absolute bottom-8 left-0 right-0 flex-row items-center justify-center gap-11"
                >
                  <Pressable
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={`Recusar o perfil de ${currentProfile.name}`}
                    accessibilityHint="O perfil sai da fila e não será mostrado novamente"
                    accessibilityState={{ disabled: submitting, busy: submitting }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    className="h-[72px] w-[72px] items-center justify-center rounded-full bg-[#26282B]"
                    disabled={submitting}
                    onPress={() => {
                      void declineCurrentProfile();
                    }}
                  >
                    <Ionicons
                      name="close"
                      size={36}
                      color="#FF2D73"
                      importantForAccessibility="no"
                    />
                  </Pressable>
                  <Pressable
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={`Curtir o perfil de ${currentProfile.name}`}
                    accessibilityHint="Se a pessoa também curtir você, vocês formam um match e podem conversar"
                    accessibilityState={{ disabled: submitting, busy: submitting }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    className="h-[72px] w-[72px] items-center justify-center rounded-full bg-[#26282B]"
                    disabled={submitting}
                    onPress={acceptCurrentProfile}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#65E568" size="small" />
                    ) : (
                      <Ionicons
                        name="heart"
                        size={36}
                        color="#65E568"
                        importantForAccessibility="no"
                      />
                    )}
                  </Pressable>
                </View>
              </LinearGradient>
            </>
          ) : locationBlocked ? (
            // Bloco proprio da localizacao: o erro generico nao tem acao util
            // aqui — o que destrava a tela e a permissao, entao o botao dela
            // fica junto da mensagem.
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              className="flex-1 items-center justify-center px-8"
            >
              <View className="w-full items-center rounded-[28px] border border-danger/40 bg-surface-alt px-6 py-10">
                <Ionicons
                  name="location-outline"
                  size={40}
                  color="#EAEA00"
                  importantForAccessibility="no"
                />
                <Text className="mt-4 text-center text-title font-black text-content">
                  Localização desativada
                </Text>
                <Text className="mt-3 text-center text-body font-semibold text-content-secondary">
                  {showLocationSettingsButton
                    ? LOCATION_BLOCKED_DISCOVERY_MESSAGE
                    : LOCATION_DISABLED_DISCOVERY_MESSAGE}
                </Text>

                {showLocationSettingsButton ? (
                  <Pressable
                    className="mt-6 h-12 w-full items-center justify-center rounded-full border border-[#5DDB85] bg-[#132519] px-6"
                    onPress={() => {
                      speak("Abrir configurações do celular");
                      void handleOpenLocationSettings();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Abrir configurações do celular"
                    accessibilityHint="Isso vai abrir as configurações do sistema, fora do aplicativo, para liberar a localização"
                  >
                    <Text className="text-body font-black text-[#5DDB85]">
                      Abrir configurações do celular
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    className={`mt-6 h-12 w-full items-center justify-center rounded-full px-6 ${locationStatus === "requesting" ? "bg-[#CFCF62]" : "bg-[#EAEA00]"}`}
                    disabled={locationStatus === "requesting"}
                    onPress={() => {
                      speak("Ativar localização");
                      void handleGrantLocationAccess();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Ativar localização"
                    accessibilityHint="Solicita a permissão de localização do aparelho para descobrir novos perfis"
                    accessibilityState={{
                      disabled: locationStatus === "requesting",
                      busy: locationStatus === "requesting",
                    }}
                  >
                    {locationStatus === "requesting" ? (
                      <ActivityIndicator color="#323200" size="small" />
                    ) : (
                      <Text className="text-body font-black text-[#323200]">
                        Ativar localização
                      </Text>
                    )}
                  </Pressable>
                )}

                <Pressable
                  className="mt-3 h-12 w-full items-center justify-center rounded-full border border-content-muted/40 bg-surface-muted px-6"
                  onPress={() => {
                    speak("Tentar novamente");
                    restartProfiles();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Tentar novamente"
                  accessibilityHint="Verifica de novo a permissão de localização e busca perfis"
                >
                  <Text className="text-body font-black text-content">
                    Tentar novamente
                  </Text>
                </Pressable>

                {locationStatus === "failed" ? (
                  <Text
                    className="mt-3 text-center text-[13px] font-semibold text-red-300"
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                  >
                    {LOCATION_PERMISSION_FAILED_MESSAGE}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : loadError ? (
            // `accessibilityRole="alert"` da a semantica do aviso; o anuncio em
            // si sai do `useEffect` de fim de fila (uma fonte por evento).
            <View
              accessibilityRole="alert"
              className="flex-1 items-center justify-center px-8"
            >
              <ScreenError
                title="Você chegou ao fim da lista"
                message={loadError}
                onRetry={restartProfiles}
              />
            </View>
          ) : (
            <View
              accessibilityRole="alert"
              className="flex-1 items-center justify-center px-8"
            >
              <ScreenEmpty
                title="Você chegou ao fim da lista"
                description="Novos perfis aparecerão aqui quando estiverem disponíveis."
                action={{
                  label: "Ver novamente",
                  onPress: restartProfiles,
                  accessibilityHint: "Recarrega a lista de perfis compatíveis",
                }}
              />
            </View>
          )}
        </View>

        <GlobalBottomNav />
      </SafeAreaView>

      {currentProfile ? (
        <ReportModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          // O contrato publico do perfil nao traz o id do `User`; enquanto ele
          // nao existir, a denuncia vai com o `userProfileId`.
          reportedUserId={currentProfile.userId ?? currentProfile.id}
          contextLabel={`perfil de ${currentProfile.name}`}
        />
      ) : null}
    </View>
  );
}
