import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
import { CommunityForYouPostCard } from "../../src/components/community/for-you-post-card";
import { GlobalBottomNav } from "../../src/components/navigation/global-bottom-nav";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import { preloadAuthenticatedRemoteImages } from "../../src/components/profile/authenticated-remote-image";
import { ScreenEmpty } from "../../src/components/ui/screen-empty";
import { ScreenLoading } from "../../src/components/ui/screen-loading";
import { useAuth } from "../../src/context/AuthContext";
import { useAsyncState } from "../../src/hooks/useAsyncState";
import { useRequireCompletedOnboarding } from "../../src/hooks/useRequireCompletedOnboarding";
import { communityService } from "../../src/services/communityService";
import {
  getLastCommunityHomeTab,
  setLastCommunityHomeTab,
  type CommunityHomeTab,
} from "../../src/state/community-home-tab";
import type {
  CommunityCategoryResponse,
  CommunityDirectoryResponse,
  CommunityForYouFeedResponse,
  CommunityForYouPostResponse,
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

const FOR_YOU_PAGE_SIZE = 10;

const EMPTY_FOR_YOU_FEED: CommunityForYouFeedResponse = {
  content: [],
  page: 0,
  size: FOR_YOU_PAGE_SIZE,
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

function CommunityHomeTabs({
  activeTab,
  onChange,
}: {
  activeTab: CommunityHomeTab;
  onChange: (tab: CommunityHomeTab) => void;
}) {
  const { speak } = useTTS();

  return (
    <View className="flex-row rounded-2xl border border-[#3A3246] bg-[#1A1C1F] p-1.5">
      {[
        { key: "forYou" as const, label: "Para você", icon: "sparkles-outline" as const },
        { key: "discover" as const, label: "Descubra comunidades", icon: "compass-outline" as const },
      ].map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <Pressable
            key={tab.key}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl px-3 py-3 ${
              isActive ? "bg-[#7C4DFF]" : "bg-transparent"
            }`}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            onPress={() => {
              speak(tab.label);
              onChange(tab.key);
            }}
          >
            <Ionicons name={tab.icon} size={16} color={isActive ? "#FCF6FF" : "#CAC3D8"} />
            <Text
              className={`text-[13px] font-black ${
                isActive ? "text-[#FCF6FF]" : "text-content-secondary"
              }`}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
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
  const [activeTab, setActiveTab] = useState<CommunityHomeTab>(getLastCommunityHomeTab);

  // Guarda a aba escolhida fora do componente para o voltar de uma comunidade
  // reabrir a mesma aba em vez de cair sempre em "Para você".
  const handleChangeHomeTab = useCallback((tab: CommunityHomeTab) => {
    setLastCommunityHomeTab(tab);
    setActiveTab(tab);
  }, []);

  const [forYouFeed, setForYouFeed] = useState<CommunityForYouFeedResponse>(EMPTY_FOR_YOU_FEED);
  const [forYouLoading, setForYouLoading] = useState(true);
  const [forYouLoadingMore, setForYouLoadingMore] = useState(false);
  const [forYouRefreshing, setForYouRefreshing] = useState(false);
  const [forYouError, setForYouError] = useState("");
  const [likeBusyPostId, setLikeBusyPostId] = useState<string | null>(null);
  const forYouRequestIdRef = useRef(0);
  const forYouInitialLoadRef = useRef(false);

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
          : await communityService.discoverCommunities({
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

  const loadForYouFeed = useCallback(
    async (options?: { refresh?: boolean; append?: boolean }) => {
      if (!canAccessCompletedOnboardingContent) {
        return;
      }

      const requestId = ++forYouRequestIdRef.current;

      if (options?.refresh) {
        setForYouRefreshing(true);
      } else if (options?.append) {
        setForYouLoadingMore(true);
      } else if (!forYouInitialLoadRef.current) {
        setForYouLoading(true);
      }
      forYouInitialLoadRef.current = true;

      try {
        setForYouError("");

        const nextPage = options?.append ? forYouFeed.page + 1 : 0;
        const response = await communityService.getForYouFeed({
          page: nextPage,
          size: FOR_YOU_PAGE_SIZE,
        });

        if (requestId !== forYouRequestIdRef.current) {
          return;
        }

        setForYouFeed((currentFeed) => {
          if (!options?.append) {
            return response;
          }

          const mergedPosts = new Map<string, CommunityForYouPostResponse>();

          for (const item of currentFeed.content) {
            mergedPosts.set(item.post.id, item);
          }

          for (const item of response.content) {
            mergedPosts.set(item.post.id, item);
          }

          return { ...response, content: Array.from(mergedPosts.values()) };
        });

        const assetUrls = response.content
          .flatMap((item) => [
            communityService.resolveAssetUrl(item.communityIconData),
            communityService.resolveAssetUrl(item.post.author.avatarData),
            communityService.resolveAssetUrl(item.post.mediaData),
          ])
          .filter(
            (value): value is string => typeof value === "string" && value.length > 0
          );

        if (assetUrls.length > 0) {
          void preloadAuthenticatedRemoteImages(assetUrls, authToken);
        }
      } catch (error) {
        if (requestId !== forYouRequestIdRef.current) {
          return;
        }

        setForYouError(
          formatApiErrorMessage(error, "Não foi possível carregar o seu feed agora.")
        );
      } finally {
        if (requestId === forYouRequestIdRef.current) {
          setForYouLoading(false);
          setForYouLoadingMore(false);
          setForYouRefreshing(false);
        }
      }
    },
    [authToken, canAccessCompletedOnboardingContent, forYouFeed.page]
  );

  useEffect(() => {
    if (!isFocused || !canAccessCompletedOnboardingContent || activeTab !== "forYou") {
      return;
    }

    void loadForYouFeed();
    // Recarrega o feed "Para você" sempre que a aba volta ao foco para refletir
    // publicações e comunidades novas sem exigir pull-to-refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, canAccessCompletedOnboardingContent, isFocused]);

  const handleToggleForYouLike = useCallback(
    async (item: CommunityForYouPostResponse) => {
      if (likeBusyPostId) {
        return;
      }

      setLikeBusyPostId(item.post.id);

      try {
        const response = item.post.likedByCurrentUser
          ? await communityService.unlikePost(item.post.id)
          : await communityService.likePost(item.post.id);

        setForYouFeed((currentFeed) => ({
          ...currentFeed,
          content: currentFeed.content.map((currentItem) =>
            currentItem.post.id === item.post.id
              ? {
                  ...currentItem,
                  post: {
                    ...currentItem.post,
                    likesCount: response.likesCount ?? currentItem.post.likesCount,
                    likedByCurrentUser:
                      response.likedByCurrentUser ??
                      !currentItem.post.likedByCurrentUser,
                  },
                }
              : currentItem
          ),
        }));
      } catch {
        // O toast global do cliente HTTP ja comunica a falha da curtida.
      } finally {
        setLikeBusyPostId(null);
      }
    },
    [likeBusyPostId]
  );

  const handleOpenForYouComments = useCallback(
    (item: CommunityForYouPostResponse) => {
      speak(`Abrir comentários da publicação de ${item.post.author.name}`);
      router.push({
        pathname: "/community/comments",
        params: {
          communityId: item.communityId,
          communityName: item.communityName,
          postId: item.post.id,
          authorName: item.post.author.name,
          postBody: item.post.body,
          publishedAt: item.post.publishedAt ?? "",
          isMember: "true",
          canModerate: "false",
        },
      });
    },
    [router, speak]
  );

  const handleOpenForYouCommunity = useCallback(
    (item: CommunityForYouPostResponse) => {
      speak(`Abrir comunidade ${item.communityName}`);
      router.push({
        pathname: "/community/[communityId]",
        params: { communityId: item.communityId },
      });
    },
    [router, speak]
  );

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
        : await communityService.discoverCommunities({
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
        : await communityService.discoverCommunities({
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
          <View className="bg-[#131313] px-6 pt-5">
            <CommunityHomeTabs activeTab={activeTab} onChange={handleChangeHomeTab} />
          </View>

          {activeTab === "forYou" ? (
            forYouLoading && forYouFeed.content.length === 0 ? (
              <View className="flex-1 items-center justify-center bg-[#131313]">
                <ScreenLoading label="Carregando seu feed..." />
              </View>
            ) : (
              <ScrollView
                className="flex-1 bg-[#131313]"
                contentContainerClassName="min-h-full px-6 pb-28 pt-5"
                refreshControl={
                  <RefreshControl
                    refreshing={forYouRefreshing}
                    tintColor="#7C4DFF"
                    onRefresh={() => {
                      void loadForYouFeed({ refresh: true });
                    }}
                  />
                }
                showsVerticalScrollIndicator={false}
              >
                {forYouError && forYouFeed.content.length > 0 ? (
                  <View className="mb-4 rounded-2xl border border-[#6A4456] bg-[#2A1C24] px-4 py-4">
                    <Text className="text-[15px] font-bold text-[#FFD3DD]">
                      Atualização parcial
                    </Text>
                    <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#FFEAF0]">
                      {forYouError}
                    </Text>
                  </View>
                ) : null}

                {forYouFeed.content.length === 0 ? (
                  <ScreenEmpty
                    className="rounded-[28px] border border-[#353534] bg-surface-alt px-6 py-10"
                    icon={
                      <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-[#201F1F]">
                        <Ionicons name="sparkles-outline" size={32} color="#7C4DFF" />
                      </View>
                    }
                    title="Seu feed está vazio"
                    description={
                      forYouError ||
                      "As publicações das comunidades das quais você participa aparecem aqui. Entre em uma comunidade para começar."
                    }
                    action={{
                      label: "Descubra comunidades",
                      onPress: () => handleChangeHomeTab("discover"),
                      accessibilityHint: "Abre a aba de descoberta de comunidades",
                    }}
                  />
                ) : (
                  <View className="gap-4">
                    {forYouFeed.content.map((item) => (
                      <CommunityForYouPostCard
                        key={item.post.id}
                        authToken={authToken}
                        item={item}
                        likeBusy={likeBusyPostId === item.post.id}
                        onOpenCommunity={() => handleOpenForYouCommunity(item)}
                        onOpenComments={() => handleOpenForYouComments(item)}
                        onToggleLike={() => {
                          void handleToggleForYouLike(item);
                        }}
                      />
                    ))}
                  </View>
                )}

                {forYouFeed.content.length > 0 && forYouFeed.hasNext ? (
                  <Pressable
                    className="mt-6 items-center justify-center rounded-[24px] border border-[#3A3246] bg-[#17181C] px-5 py-2"
                    onPress={() => {
                      speak("Carregar mais publicações");
                      void loadForYouFeed({ append: true });
                    }}
                    disabled={forYouLoadingMore}
                    accessibilityRole="button"
                    accessibilityLabel="Carregar mais publicações"
                    accessibilityState={{
                      disabled: forYouLoadingMore,
                      busy: forYouLoadingMore,
                    }}
                  >
                    {forYouLoadingMore ? (
                      <ActivityIndicator color="#EAEA00" size="small" />
                    ) : (
                      <Text className="text-[14px] font-black text-white">Carregar mais</Text>
                    )}
                  </Pressable>
                ) : null}
              </ScrollView>
            )
          ) : loading && directory.communities.length === 0 ? (
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
                <View>
                  <Text className="text-[34px] font-black leading-10 text-white">
                    Comunidades
                  </Text>
                  <Text className="mt-3 text-[15px] font-semibold leading-6 text-content-secondary text-justify">
                    Explore comunidades criadas por usuários, pesquise pelo nome ou descrição e abra o feed da que fizer sentido para você.
                  </Text>
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

                <Pressable
                  className="mt-4 flex-row items-center justify-center gap-2 rounded-[24px] border border-[#3A3246] bg-[#17181C] px-4 py-3"
                  onPress={() => {
                    speak("Minhas comunidades");
                    router.push("/community/mine");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Minhas comunidades"
                  accessibilityHint="Abre a lista das comunidades das quais você participa"
                >
                  <Ionicons name="people-circle-outline" size={18} color="#EAEA00" />
                  <Text className="text-[14px] font-black text-white">Minhas comunidades</Text>
                </Pressable>

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
