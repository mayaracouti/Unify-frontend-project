import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { buildActionSpeech, useTTS } from "../../accessibility/tts";
import { useAccessibility } from "../../context/AccessibilityContext";
import { useAppShell } from "../../context/AppShellContext";
import { useAuth } from "../../context/AuthContext";
import { useScreenHeadingFocus } from "../../hooks/use-screen-heading-focus";
import { feedService } from "../../services/feedService";
import { followService } from "../../services/followService";
import type { FollowedProfileSummaryResponse } from "../../types/social";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../utils/auth";
import { buildUserProfileHref } from "../../utils/userProfileRoute";
import { GlobalTopNav } from "../navigation/global-top-nav";
import { AuthenticatedRemoteImage } from "../profile/authenticated-remote-image";
import { ScreenEmpty } from "../ui/screen-empty";
import { ScreenError } from "../ui/screen-error";
import { ScreenLoading } from "../ui/screen-loading";

const PAGE_SIZE = 20;

export type FollowListMode = "followers" | "following";

type FollowListCopy = {
  heading: string;
  subtitle: string;
  emptyDescription: string;
  errorFallback: string;
};

const COPY: Record<FollowListMode, FollowListCopy> = {
  followers: {
    heading: "Seguidores",
    subtitle: "Pessoas que acompanham as suas publicações.",
    emptyDescription:
      "Ninguém começou a seguir você ainda. Publique no seu feed e explore o Descobrir para aparecer para mais pessoas.",
    errorFallback: "Não foi possível carregar seus seguidores.",
  },
  following: {
    heading: "Seguindo",
    subtitle: "Pessoas cujas publicações aparecem no seu feed.",
    emptyDescription:
      "Você ainda não segue ninguém. Explore o Descobrir para encontrar pessoas e acompanhar as publicações delas.",
    errorFallback: "Não foi possível carregar quem você segue.",
  },
};

function getInitial(name: string) {
  return (name.trim()[0] ?? "?").toUpperCase();
}

type FollowRowProps = {
  authToken: string | null;
  busy: boolean;
  highContrast: boolean;
  isCurrentUser: boolean;
  onOpenProfile: (profile: FollowedProfileSummaryResponse) => void;
  onToggleFollow: (profile: FollowedProfileSummaryResponse) => void;
  profile: FollowedProfileSummaryResponse;
};

function FollowRow({
  authToken,
  busy,
  highContrast,
  isCurrentUser,
  onOpenProfile,
  onToggleFollow,
  profile,
}: FollowRowProps) {
  const { speak } = useTTS();
  const avatarUri = feedService.resolveAssetUrl(profile.avatarUrl);
  const following = profile.followedByCurrentUser;

  const avatarFallback = (
    <LinearGradient
      colors={["#CDBDFF", "#7C4DFF"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="h-full w-full items-center justify-center"
    >
      <Text className="text-[16px] font-black text-white">{getInitial(profile.name)}</Text>
    </LinearGradient>
  );

  return (
    <View
      className={`mb-3 flex-row items-center rounded-xl p-4 ${
        highContrast ? "border border-hc-border bg-hc-surface" : "bg-[#2A2A2A]"
      }`}
    >
      <View className="flex-1 flex-row items-center">
        {/* A foto e um botao proprio (fora do rotulo da linha): o leitor de
            tela chega nela como "Abrir perfil de X" sem repetir o nome. */}
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Abrir perfil de ${profile.name}`}
          accessibilityHint="Abre o perfil desta pessoa"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          className="h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-[#CDBDFF] bg-[#353534]"
          onPress={() => {
            speak(buildActionSpeech("Abrir perfil", profile.name));
            onOpenProfile(profile);
          }}
        >
          {avatarUri ? (
            <AuthenticatedRemoteImage
              authToken={authToken}
              className="h-full w-full"
              fallback={avatarFallback}
              resizeMode="cover"
              uri={avatarUri}
            />
          ) : (
            avatarFallback
          )}
        </Pressable>

        <Text
          accessible
          accessibilityLabel={`${profile.name}, ${
            following ? "você segue" : "você não segue"
          }`}
          className={`ml-3 flex-1 text-[16px] font-black ${
            highContrast ? "text-hc-text" : "text-white"
          }`}
        >
          {profile.name}
        </Text>
      </View>

      {isCurrentUser ? null : (
        <Pressable
          className={`ml-3 rounded-full px-4 py-2 ${
            following ? "border border-[#494455] bg-[#1A1C1F]" : "bg-[#EAEA00]"
          }`}
          onPress={() => {
            speak(
              buildActionSpeech(following ? "Deixar de seguir" : "Seguir", profile.name)
            );
            onToggleFollow(profile);
          }}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={
            following ? `Deixar de seguir ${profile.name}` : `Seguir ${profile.name}`
          }
          accessibilityHint={
            following
              ? "As publicações desta pessoa saem do seu feed"
              : "As publicações desta pessoa passam a aparecer no seu feed"
          }
          accessibilityState={{ selected: following, busy, disabled: busy }}
        >
          {busy ? (
            <ActivityIndicator color={following ? "#EAEA00" : "#1D1D00"} size="small" />
          ) : (
            <Text
              className={`text-[14px] font-black ${
                following ? "text-white" : "text-[#1D1D00]"
              }`}
            >
              {following ? "Seguindo" : "Seguir"}
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

export function FollowListScreen({ mode }: { mode: FollowListMode }) {
  const copy = COPY[mode];
  const headingRef = useScreenHeadingFocus<Text>();
  const router = useRouter();
  const { speak } = useTTS();
  const { session } = useAuth();
  const authToken = session?.accessToken ?? null;
  const { currentUserProfileId } = useAppShell();
  const { settings } = useAccessibility();
  const highContrast = settings.highContrast;

  const [profiles, setProfiles] = useState<FollowedProfileSummaryResponse[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);

  const loadPage = useCallback(
    async (reset: boolean) => {
      const nextPage = reset ? 0 : page + 1;

      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const request =
          mode === "followers"
            ? followService.listFollowers({ page: nextPage, size: PAGE_SIZE })
            : followService.listFollowing({ page: nextPage, size: PAGE_SIZE });
        const response = await request;

        setLoadError("");
        setPage(response.page);
        setHasNext(response.hasNext);

        if (reset) {
          setProfiles(response.profiles);
          return;
        }

        setProfiles((previous) => {
          const knownIds = new Set(previous.map((profile) => profile.userProfileId));
          const appended = response.profiles.filter(
            (profile) => !knownIds.has(profile.userProfileId)
          );

          if (appended.length > 0) {
            announceForAccessibility(
              accessibilityAnnouncements.moreItemsLoaded(appended.length, "pessoas")
            );
          }

          return [...previous, ...appended];
        });
      } catch (nextError) {
        if (reset) {
          setLoadError(formatApiErrorMessage(nextError, copy.errorFallback));
        }
        // Global API error toast already explains the failure.
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [copy.errorFallback, mode, page]
  );

  useEffect(() => {
    void loadPage(true);
    // Uma carga por montagem/modo: depender de `loadPage` recarregaria a lista
    // a cada página paginada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadPage(true);
  }, [loadPage]);

  const handleEndReached = useCallback(() => {
    if (!hasNext || loadingMore || loading || refreshing) {
      return;
    }

    void loadPage(false);
  }, [hasNext, loadPage, loading, loadingMore, refreshing]);

  const setFollowingFlag = useCallback((profileId: string, value: boolean) => {
    setProfiles((previous) =>
      previous.map((profile) =>
        profile.userProfileId === profileId
          ? { ...profile, followedByCurrentUser: value }
          : profile
      )
    );
  }, []);

  const handleOpenProfile = useCallback(
    (profile: FollowedProfileSummaryResponse) => {
      // O proprio usuario cai em `/users/[id]`, que redireciona para `/profile`.
      router.push(buildUserProfileHref(profile.userProfileId, profile.name));
    },
    [router]
  );

  const handleToggleFollow = useCallback(
    (profile: FollowedProfileSummaryResponse) => {
      const nextFollowing = !profile.followedByCurrentUser;

      setPendingProfileId(profile.userProfileId);
      // Atualização otimista: o botão responde na hora e volta ao estado
      // anterior se a requisição falhar.
      setFollowingFlag(profile.userProfileId, nextFollowing);

      void (async () => {
        try {
          if (nextFollowing) {
            await followService.follow(profile.userProfileId);
            announceForAccessibility(
              accessibilityAnnouncements.followStarted(profile.name)
            );
          } else {
            await followService.unfollow(profile.userProfileId);
            announceForAccessibility(
              accessibilityAnnouncements.followStopped(profile.name)
            );
          }
        } catch {
          setFollowingFlag(profile.userProfileId, !nextFollowing);
          // Global API error toast already explains the failure.
        } finally {
          setPendingProfileId(null);
        }
      })();
    },
    [setFollowingFlag]
  );

  const renderContent = () => {
    if (loading) {
      return <ScreenLoading label={`Carregando ${copy.heading.toLowerCase()}`} />;
    }

    if (loadError) {
      return (
        <ScreenError
          message={loadError}
          title="Não foi possível carregar a lista"
          onRetry={() => {
            void loadPage(true);
          }}
          retrying={loading}
        />
      );
    }

    if (profiles.length === 0) {
      return (
        <ScreenEmpty title="Ninguém por aqui ainda" description={copy.emptyDescription} />
      );
    }

    return (
      <FlatList
        accessibilityLabel={`Lista de ${copy.heading.toLowerCase()}`}
        data={profiles}
        keyExtractor={(item) => item.userProfileId}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-10"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#EAEA00"
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={handleEndReached}
        ListFooterComponent={
          loadingMore ? (
            <View className="py-6">
              <ActivityIndicator color="#EAEA00" size="small" />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <FollowRow
            authToken={authToken}
            busy={pendingProfileId === item.userProfileId}
            highContrast={highContrast}
            isCurrentUser={
              currentUserProfileId !== null && item.userProfileId === currentUserProfileId
            }
            onOpenProfile={handleOpenProfile}
            onToggleFollow={handleToggleFollow}
            profile={item}
          />
        )}
      />
    );
  };

  return (
    <View className={`flex-1 ${highContrast ? "bg-hc-bg" : "bg-[#1F2023]"}`}>
      <SafeAreaView className="flex-1">
        <GlobalTopNav />

        <View className="flex-1 px-6 pt-6">
          <View className="mb-6">
            <View className="flex-row items-center gap-3">
              {/* Voltar fica dentro da tela (e nao na barra superior, junto
                  do menu): o titulo e o proximo foco do leitor de tela. */}
              <Pressable
                accessible
                accessibilityRole="button"
                accessibilityLabel="Voltar para o perfil"
                accessibilityHint="Volta para a tela do seu perfil"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className="h-11 w-11 items-center justify-center rounded-full bg-[#17181C]"
                onPress={() => {
                  speak("Voltar para o perfil");
                  // `replace` (e nao `back`): a tela pode ser aberta por deep
                  // link, quando nao existe historico para voltar.
                  router.replace("/profile");
                }}
              >
                <Ionicons
                  name="arrow-back"
                  size={22}
                  color="#A270FF"
                  importantForAccessibility="no"
                />
              </Pressable>
              <Text
                ref={headingRef}
                accessibilityRole="header"
                className={`flex-1 text-[32px] font-extrabold ${
                  highContrast ? "text-hc-text" : "text-white"
                }`}
              >
                {copy.heading}
              </Text>
            </View>
            <Text
              className={`mt-2 text-[15px] font-semibold leading-6 ${
                highContrast ? "text-hc-text" : "text-[#CAC3D8]"
              }`}
            >
              {copy.subtitle}
            </Text>
          </View>

          <View className="flex-1">{renderContent()}</View>
        </View>
      </SafeAreaView>
    </View>
  );
}
