import { useIsFocused } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { buildMutualMatchSpeech, useTTS } from "../../src/accessibility/tts";
import { GlobalBottomNav } from "../../src/components/navigation/global-bottom-nav";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import {
  AuthenticatedRemoteImage,
  preloadAuthenticatedRemoteImages,
} from "../../src/components/profile/authenticated-remote-image";
import { ScreenEmpty } from "../../src/components/ui/screen-empty";
import { ScreenLoading } from "../../src/components/ui/screen-loading";
import { useAuth } from "../../src/context/AuthContext";
import { useAsyncState } from "../../src/hooks/useAsyncState";
import { useRequireCompletedOnboarding } from "../../src/hooks/useRequireCompletedOnboarding";
import { matchService } from "../../src/services/matchService";
import { profileService } from "../../src/services/profileService";
import type {
  MutualMatchPageResponse,
  MutualMatchSummaryResponse,
} from "../../src/types/match";
import { formatApiErrorMessage } from "../../src/utils/auth";

const MUTUAL_MATCHES_PAGE_SIZE = 20;

function createEmptyMutualMatchesResponse(): MutualMatchPageResponse {
  return {
    matches: [],
    page: 0,
    size: MUTUAL_MATCHES_PAGE_SIZE,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
  };
}

function buildMergedMutualMatches(
  currentPage: MutualMatchPageResponse,
  nextPage: MutualMatchPageResponse,
  append: boolean
) {
  if (!append) {
    return nextPage;
  }

  const mergedMatches = new Map<string, MutualMatchSummaryResponse>();

  for (const match of currentPage.matches) {
    mergedMatches.set(match.userProfileId, match);
  }

  for (const match of nextPage.matches) {
    mergedMatches.set(match.userProfileId, match);
  }

  return {
    ...nextPage,
    matches: Array.from(mergedMatches.values()),
  };
}

function collectMutualMatchImageUrls(page: MutualMatchPageResponse) {
  return page.matches
    .map((match) => profileService.resolveProfileImageUrl(match.profilePicture?.url))
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

function formatMatchSummary(totalElements: number) {
  if (totalElements <= 0) {
    return "Nenhum match confirmado ainda. Quando uma curtida for recíproca, a pessoa aparecerá aqui.";
  }

  if (totalElements === 1) {
    return "1 pessoa confirmou interesse em você.";
  }

  return `${totalElements.toLocaleString("pt-BR")} pessoas confirmaram interesse em você.`;
}

function formatAgeLabel(age: number | null) {
  return typeof age === "number" ? `${age} anos` : "Idade não informada";
}

function MutualMatchesEmptyState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <ScreenEmpty
      className="rounded-[28px] border border-[#353534] bg-[#111214] px-6 py-10"
      title="Sem matches por enquanto"
      description={`${message} Arraste a tela para baixo para atualizar.`}
      action={
        onRetry
          ? {
              label: "Tentar novamente",
              onPress: onRetry,
              accessibilityHint: "Atualiza a lista de matches confirmados",
            }
          : undefined
      }
    />
  );
}

function MutualMatchCard({
  authToken,
  match,
}: {
  authToken: string | null;
  match: MutualMatchSummaryResponse;
}) {
  const { speak } = useTTS();
  const imageUrl = profileService.resolveProfileImageUrl(match.profilePicture?.url);
  const displayName = match.fullName?.trim() || "Pessoa sem nome";

  return (
    <Pressable
      className="rounded-[28px] border border-[#353534] bg-[#111214] p-5"
      accessibilityRole="button"
      accessibilityLabel={displayName}
      // Toque no card fala o match (nome e idade vindos do backend).
      onPress={() => speak(buildMutualMatchSpeech(match) ?? displayName)}
    >
      <View className="flex-row items-center gap-4">
        <View className="h-20 w-20 overflow-hidden rounded-[24px] border border-[#CDBDFF] bg-[#2D2A33]">
          {imageUrl ? (
            <AuthenticatedRemoteImage
              uri={imageUrl}
              authToken={authToken}
              className="h-full w-full"
              resizeMode="cover"
              fallback={
                <View className="flex-1 items-center justify-center bg-[#2D2A33]">
                  <Ionicons name="person" size={34} color="#CDBDFF" />
                </View>
              }
            />
          ) : (
            <View className="flex-1 items-center justify-center bg-[#2D2A33]">
              <Ionicons name="person" size={34} color="#CDBDFF" />
            </View>
          )}
        </View>

        <View className="flex-1">
          <Text className="text-[21px] font-black text-white">{displayName}</Text>
          <Text className="mt-1 text-[15px] font-semibold text-[#CAC3D8]">
            {formatAgeLabel(match.age)}
          </Text>

          <View className="mt-3 flex-row flex-wrap gap-2">
            <View className="rounded-full bg-[#1E1A28] px-3 py-2">
              <Text className="text-[11px] font-black uppercase tracking-[1.1px] text-[#CDBDFF]">
                Match confirmado
              </Text>
            </View>

            {/* <View
              className={`rounded-full px-3 py-2 ${
                imageUrl ? "bg-[#1B2631]" : "bg-[#312114]"
              }`}
            >
              <Text
                className={`text-[11px] font-black uppercase tracking-[1.1px] ${
                  imageUrl ? "text-[#9FD9FF]" : "text-[#FFD28A]"
                }`}
              >
                {imageUrl ? "Foto disponível" : "Sem foto"}
              </Text>
            </View> */}
          </View>
        </View>
      </View>
        <View className="absolute top-14 right-6">
            <Ionicons name="chatbubble-ellipses" size={24} color="#E5E2E1" />
        </View>
    </Pressable>
  );
}

export default function MutualMatchesScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { speak } = useTTS();
  const { session } = useAuth();
  const { canAccessCompletedOnboardingContent } = useRequireCompletedOnboarding();
  const {
    data: matchesPage,
    setData: setMatchesPage,
    error: loadError,
    setError: setLoadError,
    run: runLoadMutualMatches,
    isLoading: loading,
  } = useAsyncState<MutualMatchPageResponse>(createEmptyMutualMatchesResponse());
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestIdRef = useRef(0);
  const authToken = session?.accessToken ?? null;

  useEffect(() => {
    if (!canAccessCompletedOnboardingContent || !isFocused) {
      return;
    }

    const requestId = ++requestIdRef.current;

    void runLoadMutualMatches(
      () => matchService.getPagedMutualMatches({ page: 0, size: MUTUAL_MATCHES_PAGE_SIZE }),
      "Não foi possível carregar seus matches agora."
    ).then((response) => {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (response) {
        const imageUrls = collectMutualMatchImageUrls(response);

        if (imageUrls.length > 0) {
          void preloadAuthenticatedRemoteImages(imageUrls, authToken);
        }
      }

      setRefreshing(false);
      setLoadingMore(false);
    });
  }, [authToken, canAccessCompletedOnboardingContent, isFocused, runLoadMutualMatches]);

  const handleRefresh = async () => {
    if (!canAccessCompletedOnboardingContent) {
      return;
    }

    setRefreshing(true);
    const requestId = ++requestIdRef.current;

    try {
      setLoadError("");

      const response = await matchService.getPagedMutualMatches({
        page: 0,
        size: MUTUAL_MATCHES_PAGE_SIZE,
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      setMatchesPage(response);

      const imageUrls = collectMutualMatchImageUrls(response);

      if (imageUrls.length > 0) {
        void preloadAuthenticatedRemoteImages(imageUrls, authToken);
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setLoadError(
        formatApiErrorMessage(error, "Não foi possível atualizar seus matches agora.")
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setRefreshing(false);
      }
    }
  };

  const handleLoadMore = async () => {
    if (!canAccessCompletedOnboardingContent || !matchesPage.hasNext || loadingMore) {
      return;
    }

    setLoadingMore(true);
    const requestId = ++requestIdRef.current;

    try {
      const response = await matchService.getPagedMutualMatches({
        page: matchesPage.page + 1,
        size: MUTUAL_MATCHES_PAGE_SIZE,
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      setMatchesPage((currentPage) =>
        buildMergedMutualMatches(currentPage, response, true)
      );

      const imageUrls = collectMutualMatchImageUrls(response);

      if (imageUrls.length > 0) {
        void preloadAuthenticatedRemoteImages(imageUrls, authToken);
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setLoadError(
        formatApiErrorMessage(error, "Não foi possível carregar mais matches.")
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingMore(false);
      }
    }
  };

  const matchesSummary = useMemo(
    () => formatMatchSummary(matchesPage.totalElements),
    [matchesPage.totalElements]
  );

  const paginationSummary = useMemo(() => {
    if (matchesPage.totalElements <= 0) {
      return "Puxe para atualizar quando quiser revisar a lista.";
    }

    return `Página ${(matchesPage.page + 1).toLocaleString("pt-BR")} de ${Math.max(
      matchesPage.totalPages,
      1
    ).toLocaleString("pt-BR")}.`;
  }, [matchesPage.page, matchesPage.totalElements, matchesPage.totalPages]);

  return (
    <View className="flex-1 bg-[#1F2023]">
      <SafeAreaView className="flex-1">
        <GlobalTopNav />

        <View className="flex-1 px-6 pt-6">
            <Pressable
              className="h-12 items-center flex flex-row justify-start"
              onPress={() => {
                speak("Voltar para Encontros");
                router.replace("/matches");
              }}
              accessibilityRole="button"
              accessibilityLabel="Voltar para encontros">
              <Ionicons name="arrow-back" size={22} color="#E5E2E1" />
              <Text className="color-slate-100 ml-2">Voltar para Encontros</Text>
            </Pressable>
            <View className="mb-6 flex-row items-start justify-between gap-4">
                <View className="flex-1">
                <Text className="text-[32px] font-extrabold text-white">Seus matches</Text>
                <Text className="mt-2 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
                    Veja quem já confirmou interesse em você e acompanhe a lista paginada dos encontros recíprocos.
                </Text>
                </View>
            </View>

          {loading && matchesPage.matches.length === 0 ? (
            <ScreenLoading label="Buscando matches confirmados..." />
          ) : (
            <ScrollView
              className="flex-1"
              contentContainerClassName="min-h-full pb-6"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  tintColor="#7C4DFF"
                  onRefresh={() => {
                    void handleRefresh();
                  }}
                />
              }
              showsVerticalScrollIndicator={false}
            >
              {/* <View className="rounded-[28px] border border-[#353534] bg-[#111214] px-5 py-4">
                <Text className="text-[13px] font-black uppercase tracking-[1.1px] text-[#CDBDFF]">
                  Matches confirmados
                </Text>
                <Text className="mt-2 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
                  {matchesSummary}
                </Text>
                <Text className="mt-2 text-[13px] font-semibold text-[#9F96B8]">
                  {paginationSummary}
                </Text>
              </View> */}

              {loadError && matchesPage.matches.length > 0 ? (
                <View className="mt-6 rounded-2xl border border-[#6A4456] bg-[#2A1C24] px-4 py-4">
                  <Text className="text-[15px] font-bold text-[#FFD3DD]">
                    Atualização parcial
                  </Text>
                  <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#FFEAF0]">
                    {loadError}
                  </Text>
                </View>
              ) : null}

              <View className="mt-2 gap-4">
                {matchesPage.matches.length === 0 ? (
                  <MutualMatchesEmptyState
                    message={
                      loadError ||
                      "Se uma pessoa também curtir você, o encontro aparece aqui automaticamente."
                    }
                    onRetry={() => {
                      void handleRefresh();
                    }}
                  />
                ) : (
                  matchesPage.matches.map((match) => (
                    <MutualMatchCard
                      key={match.userProfileId}
                      authToken={authToken}
                      match={match}
                    />
                  ))
                )}
              </View>

              {matchesPage.matches.length > 0 && matchesPage.hasNext ? (
                <Pressable
                  className="mt-6 items-center justify-center rounded-[24px] border border-[#3A3246] bg-[#17181C] px-5 py-4"
                  onPress={() => {
                    speak("Carregar mais matches");
                    void handleLoadMore();
                  }}
                  disabled={loadingMore}
                  accessibilityRole="button"
                  accessibilityLabel="Carregar mais matches"
                  accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
                >
                  {loadingMore ? (
                    <ActivityIndicator color="#EAEA00" size="small" />
                  ) : (
                    <Text className="text-[14px] font-black text-white">Carregar mais</Text>
                  )}
                </Pressable>
              ) : null}
            </ScrollView>
          )}
        </View>

        <GlobalBottomNav />
      </SafeAreaView>
    </View>
  );
}