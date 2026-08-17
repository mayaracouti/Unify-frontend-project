import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTTS } from "../../src/accessibility/tts";
import { CommunityCategoryChips } from "../../src/components/community/category-chips";
import { CommunityDirectoryCard } from "../../src/components/community/community-card";
import { GlobalBottomNav } from "../../src/components/navigation/global-bottom-nav";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import { preloadAuthenticatedRemoteImages } from "../../src/components/profile/authenticated-remote-image";
import { ScreenEmpty } from "../../src/components/ui/screen-empty";
import { ScreenLoading } from "../../src/components/ui/screen-loading";
import { useAuth } from "../../src/context/AuthContext";
import { useAsyncState } from "../../src/hooks/useAsyncState";
import { useRequireCompletedOnboarding } from "../../src/hooks/useRequireCompletedOnboarding";
import { communityService } from "../../src/services/communityService";
import type {
  CommunityCategoryResponse,
  CommunityDirectoryResponse,
  CommunitySummaryResponse,
} from "../../src/types/community";
import { formatApiErrorMessage } from "../../src/utils/auth";

const DIRECTORY_PAGE_SIZE = 12;

const EMPTY_DIRECTORY_RESPONSE: CommunityDirectoryResponse = {
  communities: [],
  page: 0,
  size: DIRECTORY_PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
};

function buildMergedDirectory(
  currentDirectory: CommunityDirectoryResponse,
  nextDirectory: CommunityDirectoryResponse,
  append: boolean
) {
  if (!append) {
    return nextDirectory;
  }

  const mergedCommunities = new Map<string, CommunitySummaryResponse>();

  for (const community of currentDirectory.communities) {
    mergedCommunities.set(community.id, community);
  }

  for (const community of nextDirectory.communities) {
    mergedCommunities.set(community.id, community);
  }

  return {
    ...nextDirectory,
    communities: Array.from(mergedCommunities.values()),
  };
}

function collectDirectoryAssetUrls(directory: CommunityDirectoryResponse) {
  return directory.communities
    .flatMap((community) => [
      communityService.resolveAssetUrl(community.iconData),
      communityService.resolveAssetUrl(community.owner?.avatarData),
    ])
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

function DirectoryEmptyState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <ScreenEmpty
      className="rounded-[28px] border border-[#353534] bg-surface-alt px-6 py-10"
      icon={
        <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-[#201F1F]">
          <Ionicons name="people-outline" size={32} color="#7C4DFF" />
        </View>
      }
      title="Nenhuma comunidade encontrada"
      description={message}
      action={
        onRetry
          ? {
              label: "Tentar novamente",
              onPress: onRetry,
              accessibilityHint: "Atualiza a lista de comunidades",
            }
          : undefined
      }
    />
  );
}

function SearchEmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <ScreenEmpty
      className="rounded-[28px] border border-[#353534] bg-surface-alt px-6 py-8"
      title="Sem resultados"
      description={`Nenhuma comunidade corresponde a "${searchQuery}" no backend.`}
    />
  );
}

export default function CommunityDirectoryScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { speak } = useTTS();
  const { session } = useAuth();

  const { canAccessCompletedOnboardingContent } = useRequireCompletedOnboarding();

  const authToken = session?.accessToken ?? null;
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const [categories, setCategories] = useState<CommunityCategoryResponse[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const initialLoadRef = useRef(false);
  const requestIdRef = useRef(0);

  const {
    data: directory,
    setData: setDirectory,
    error: loadError,
    setError: setLoadError,
  } = useAsyncState<CommunityDirectoryResponse>(EMPTY_DIRECTORY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      try {
        const response = await communityService.listCategories();

        if (active) {
          setCategories(Array.isArray(response) ? response : []);
        }
      } catch {
        // Sem categorias o diretorio segue funcionando sem filtro; o toast
        // global do cliente HTTP ja comunica a falha.
      }
    };

    void loadCategories();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isFocused || !canAccessCompletedOnboardingContent) {
      return;
    }

    const requestId = ++requestIdRef.current;
    const shouldShowLoader = !initialLoadRef.current;
    initialLoadRef.current = true;

    if (shouldShowLoader) {
      setLoading(true);
    }

    const loadDirectory = async () => {
      try {
        setLoadError("");

        const response = deferredSearchQuery
          ? await communityService.searchCommunities(deferredSearchQuery, {
              page: 0,
              size: DIRECTORY_PAGE_SIZE,
              categoryId: selectedCategoryId,
            })
          : await communityService.listCommunities({
              page: 0,
              size: DIRECTORY_PAGE_SIZE,
              categoryId: selectedCategoryId,
            });

        if (requestId !== requestIdRef.current) {
          return;
        }

        setDirectory(response);

        // Resultado de busca e conteudo dinamico: anuncia a contagem real
        // retornada pelo backend quando o usuario pesquisou algo.
        if (deferredSearchQuery) {
          speak(
            response.totalElements > 0
              ? `${response.totalElements} comunidades encontradas para ${deferredSearchQuery}`
              : `Nenhuma comunidade encontrada para ${deferredSearchQuery}`
          );
        }

        const assetUrls = collectDirectoryAssetUrls(response);

        if (assetUrls.length > 0) {
          void preloadAuthenticatedRemoteImages(assetUrls, authToken);
        }
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setLoadError(
          formatApiErrorMessage(error, "Não foi possível carregar as comunidades agora.")
        );
        setDirectory(EMPTY_DIRECTORY_RESPONSE);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    };

    void loadDirectory();
  }, [
    authToken,
    canAccessCompletedOnboardingContent,
    deferredSearchQuery,
    isFocused,
    selectedCategoryId,
    speak,
  ]);

  const handleRefresh = async () => {
    if (!canAccessCompletedOnboardingContent) {
      return;
    }

    setRefreshing(true);
    const requestId = ++requestIdRef.current;

    try {
      setLoadError("");

      const response = deferredSearchQuery
        ? await communityService.searchCommunities(deferredSearchQuery, {
            page: 0,
            size: DIRECTORY_PAGE_SIZE,
            categoryId: selectedCategoryId,
          })
        : await communityService.listCommunities({
            page: 0,
            size: DIRECTORY_PAGE_SIZE,
            categoryId: selectedCategoryId,
          });

      if (requestId !== requestIdRef.current) {
        return;
      }

      setDirectory(response);
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setLoadError(
        formatApiErrorMessage(error, "Não foi possível atualizar as comunidades agora.")
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setRefreshing(false);
      }
    }
  };

  const handleLoadMore = async () => {
    if (!canAccessCompletedOnboardingContent || !directory.hasNext || loadingMore) {
      return;
    }

    setLoadingMore(true);
    const requestId = ++requestIdRef.current;

    try {
      const nextPage = directory.page + 1;
      const response = deferredSearchQuery
        ? await communityService.searchCommunities(deferredSearchQuery, {
            page: nextPage,
            size: DIRECTORY_PAGE_SIZE,
            categoryId: selectedCategoryId,
          })
        : await communityService.listCommunities({
            page: nextPage,
            size: DIRECTORY_PAGE_SIZE,
            categoryId: selectedCategoryId,
          });

      if (requestId !== requestIdRef.current) {
        return;
      }

      setDirectory((currentDirectory) => buildMergedDirectory(currentDirectory, response, true));

      const assetUrls = collectDirectoryAssetUrls(response);

      if (assetUrls.length > 0) {
        void preloadAuthenticatedRemoteImages(assetUrls, authToken);
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setLoadError(
        formatApiErrorMessage(error, "Não foi possível carregar mais comunidades.")
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingMore(false);
      }
    }
  };

  const directorySummaryLabel = useMemo(() => {
    if (directory.totalElements <= 0) {
      return deferredSearchQuery
        ? `Nenhuma comunidade encontrada para "${deferredSearchQuery}".`
        : "Nenhuma comunidade disponível no momento.";
    }

    return deferredSearchQuery
      ? `${directory.totalElements.toLocaleString("pt-BR")} comunidades encontradas para "${deferredSearchQuery}".`
      : `${directory.totalElements.toLocaleString("pt-BR")} comunidades disponíveis.`;
  }, [deferredSearchQuery, directory.totalElements]);

  return (
    <View className="flex-1 bg-[#0D0D0E]">
      <SafeAreaView className="flex-1 bg-black">
        <GlobalTopNav />

        <View className="flex-1">
          {loading && directory.communities.length === 0 ? (
            <View className="flex-1 items-center justify-center bg-[#131313]">
              <ScreenLoading label="Carregando comunidades..." />
            </View>
          ) : (
            <ScrollView
              className="flex-1 bg-[#131313]"
              contentContainerClassName="min-h-full px-6 pb-28 pt-7"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  tintColor="#7C4DFF"
                  onRefresh={() => {
                    void handleRefresh();
                  }}
                />
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View className="rounded-[32px] bg-surface-alt p-6">
                <View className="flex-row items-start justify-between gap-4">
                  <View className="flex-1">
                    <Text className="text-[34px] font-black leading-10 text-white">
                      Comunidades
                    </Text>
                    <Text className="mt-3 text-[15px] font-semibold leading-6 text-content-secondary text-justify">
                      Explore comunidades criadas por usuários, pesquise pelo nome ou descrição e abra o feed da que fizer sentido para você.
                    </Text>
                  </View>

                  <Pressable
                    className="rounded-full border border-[#3A3246] bg-[#17181C] px-4 py-3"
                    onPress={() => {
                      speak("Minhas comunidades");
                      router.push("/community/mine");
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Minhas comunidades"
                    accessibilityHint="Abre a lista das comunidades das quais você participa"
                  >
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="people-circle-outline" size={18} color="#EAEA00" />
                      <Text className="text-[13px] font-black text-white">Minhas</Text>
                    </View>
                  </Pressable>
                </View>

                <View className="mt-6 rounded-[24px] border border-[#3A3246] bg-[#17181C] px-4 py-3">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="search" size={20} color="#CAC3D8" />
                    <TextInput
                      className="flex-1 text-[15px] font-semibold text-white"
                      placeholder="Buscar comunidades"
                      placeholderTextColor="#948EA1"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                    {searchQuery.trim().length > 0 ? (
                      <Pressable
                        className="h-8 w-8 items-center justify-center rounded-full bg-[#2A2A2A]"
                        onPress={() => {
                          speak("Busca limpa");
                          setSearchQuery("");
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Limpar busca"
                      >
                        <Ionicons name="close" size={16} color="#E5E2E1" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <CommunityCategoryChips
                  categories={categories}
                  selectedCategoryId={selectedCategoryId}
                  onSelect={setSelectedCategoryId}
                  allOptionLabel="Todas"
                />

                {/* <View className="mt-5 rounded-2xl border border-[#353534] bg-[#17181C] px-4 py-4">
                  <Text className="text-[13px] font-bold uppercase tracking-[1.1px] text-[#7C4DFF]">
                    Resultado atual
                  </Text>
                  <Text className="mt-2 text-[14px] font-semibold leading-6 text-content-secondary">
                    {directorySummaryLabel}
                  </Text>
                </View> */}
              </View>

              {loadError && directory.communities.length > 0 ? (
                <View className="mt-6 rounded-2xl border border-[#6A4456] bg-[#2A1C24] px-4 py-4">
                  <Text className="text-[15px] font-bold text-[#FFD3DD]">Atualização parcial</Text>
                  <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#FFEAF0]">
                    {loadError}
                  </Text>
                </View>
              ) : null}

              <View className="mt-6 gap-4">
                {directory.communities.length === 0 ? (
                  deferredSearchQuery ? (
                    <SearchEmptyState searchQuery={deferredSearchQuery} />
                  ) : (
                    <DirectoryEmptyState
                      message={
                        loadError ||
                        "As comunidades aparecerão aqui assim que existirem comunidades públicas disponíveis para o usuário autenticado."
                      }
                      onRetry={() => {
                        setLoading(true);
                        void handleRefresh();
                      }}
                    />
                  )
                ) : (
                  directory.communities.map((community) => (
                    <CommunityDirectoryCard
                      key={community.id}
                      authToken={authToken}
                      community={community}
                      onPress={() =>
                        router.push({
                          pathname: "/community/[communityId]",
                          params: { communityId: community.id },
                        })
                      }
                    />
                  ))
                )}
              </View>

              {directory.communities.length > 0 && directory.hasNext ? (
                <Pressable
                  className="mt-2 items-center justify-center rounded-[24px] border border-[#3A3246] bg-[#17181C] px-5 py-2"
                  onPress={() => {
                    speak("Carregar mais comunidades");
                    void handleLoadMore();
                  }}
                  disabled={loadingMore}
                  accessibilityRole="button"
                  accessibilityLabel="Carregar mais comunidades"
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

          <Pressable
            className="absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-full border-2 border-[#CDBDFF] bg-[#7C4DFF]"
            accessibilityRole="button"
            accessibilityLabel="Criar comunidade"
            onPress={() => {
              speak("Criar comunidade");
              router.push("/community/new");
            }}
          >
            <Ionicons name="add" size={38} color="#FCF6FF" />
          </Pressable>
        </View>

        <GlobalBottomNav />
      </SafeAreaView>
    </View>
  );
}
