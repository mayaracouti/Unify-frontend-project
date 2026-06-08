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

import { GlobalBottomNav } from "../../src/components/navigation/global-bottom-nav";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import {
  AuthenticatedRemoteImage,
  preloadAuthenticatedRemoteImages,
} from "../../src/components/profile/authenticated-remote-image";
import { useAuth } from "../../src/context/AuthContext";
import { useRequireCompletedOnboarding } from "../../src/hooks/useRequireCompletedOnboarding";
import { communityService } from "../../src/services/communityService";
import type {
  CommunityDirectoryResponse,
  CommunityRole,
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

function formatMemberCount(memberCount?: number | null) {
  if (typeof memberCount !== "number") {
    return null;
  }

  if (memberCount >= 1000) {
    const compactValue = memberCount / 1000;
    const formattedValue = compactValue.toLocaleString("pt-BR", {
      maximumFractionDigits: compactValue >= 10 ? 1 : 1,
      minimumFractionDigits: compactValue % 1 === 0 ? 0 : 1,
    });

    return `${formattedValue}k membros`;
  }

  return `${memberCount.toLocaleString("pt-BR")} membros`;
}

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

function canModerateRole(role?: CommunityRole | null) {
  return role === "ADMIN" || role === "MODERATOR";
}

function DirectoryEmptyState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View className="rounded-[28px] border border-[#353534] bg-[#111214] px-6 py-10">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-[#201F1F]">
        <Ionicons name="people-outline" size={32} color="#7C4DFF" />
      </View>
      <Text className="mt-6 text-[22px] font-black text-[#E5E2E1]">
        Nenhuma comunidade encontrada
      </Text>
      <Text className="mt-3 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          className="mt-6 self-start rounded-full border border-[#494455] bg-[#201F1F] px-5 py-3"
          onPress={onRetry}
        >
          <Text className="text-[14px] font-bold text-white">Tentar novamente</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SearchEmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <View className="rounded-[28px] border border-[#353534] bg-[#111214] px-6 py-8">
      <Text className="text-[22px] font-black text-white">Sem resultados</Text>
      <Text className="mt-3 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
        Nenhuma comunidade corresponde a "{searchQuery}" no backend.
      </Text>
    </View>
  );
}

function traduzirNomeRole(role: CommunityRole | null | undefined) {
  switch (role) {
    case "ADMIN":
      return "Administrador";
    case "MODERATOR":
      return "Moderador";
    case "MEMBER":
      return "Membro";
    default:
      return role;
  }
}

function CommunityRoleBadge({
  isOwner,
  role,
}: {
  isOwner?: boolean | null;
  role?: CommunityRole | null;
}) {
  const label = isOwner ? "Criador" : traduzirNomeRole(role);

  if (!label) {
    return (
      <View className="rounded-full bg-[#1E1A28] px-3 py-2">
        <Text className="text-[12px] font-black uppercase tracking-[1.1px] text-[#CDBDFF]">
          Explorar
        </Text>
      </View>
    );
  }

  return (
    <View
      className={`rounded-full px-3 py-2 ${
        isOwner
          ? "bg-[#312114]"
          : canModerateRole(role)
            ? "bg-[#1B2631]"
            : "bg-[#1E1A28]"
      }`}
    >
      <Text
        className={`text-[12px] font-black uppercase tracking-[1.1px] ${
          isOwner
            ? "text-[#FFD28A]"
            : canModerateRole(role)
              ? "text-[#9FD9FF]"
              : "text-[#CDBDFF]"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

function CommunityDirectoryCard({
  authToken,
  community,
  onPress,
}: {
  authToken: string | null;
  community: CommunitySummaryResponse;
  onPress: () => void;
}) {
  const iconUrl = communityService.resolveAssetUrl(community.iconData);
  const ownerAvatarUrl = communityService.resolveAssetUrl(community.owner?.avatarData);
  const memberCountLabel = formatMemberCount(community.memberCount);

  return (
    <Pressable
      className="rounded-[28px] border border-[#353534] bg-[#111214] p-5"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${community.name}`}
    >
      <View className="flex-row items-start gap-4">
        <View className="h-20 w-20 overflow-hidden rounded-2xl border border-[#CDBDFF] bg-[#7C4DFF]">
          {iconUrl ? (
            <AuthenticatedRemoteImage
              uri={iconUrl}
              authToken={authToken}
              className="h-full w-full"
              resizeMode="cover"
              fallback={
                <View className="flex-1 items-center justify-center bg-[#7C4DFF]">
                  <Ionicons name="people" size={34} color="#FCF6FF" />
                </View>
              }
            />
          ) : (
            <View className="flex-1 items-center justify-center bg-[#7C4DFF]">
              <Ionicons name="people" size={34} color="#FCF6FF" />
            </View>
          )}
        </View>

        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-3">
            <Text className="flex-1 text-[24px] font-black leading-8 text-white">
              {community.name}
            </Text>
            <CommunityRoleBadge isOwner={community.isOwner} role={community.currentUserRole} />
          </View>

          {community.description ? (
            <Text className="mt-3 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
              {community.description}
            </Text>
          ) : (
            <Text className="mt-3 text-[15px] font-semibold leading-6 text-[#948EA1]">
              Esta comunidade ainda não possui descrição.
            </Text>
          )}

          <View className="mt-4 flex-row items-center gap-3 rounded-2xl bg-[#17181C] px-4 py-3">
            <View className="h-10 w-10 overflow-hidden rounded-full bg-[#2C2834]">
              {ownerAvatarUrl ? (
                <AuthenticatedRemoteImage
                  uri={ownerAvatarUrl}
                  authToken={authToken}
                  className="h-full w-full"
                  resizeMode="cover"
                  fallback={
                    <View className="flex-1 items-center justify-center bg-[#2C2834]">
                      <Ionicons name="person" size={16} color="#E5E2E1" />
                    </View>
                  }
                />
              ) : (
                <View className="flex-1 items-center justify-center bg-[#2C2834]">
                  <Ionicons name="person" size={16} color="#E5E2E1" />
                </View>
              )}
            </View>

            <View className="flex-1">
              <Text className="text-[13px] font-semibold text-[#CAC3D8]">Criada por</Text>
              <Text className="text-[15px] font-black text-white">
                {community.owner?.name ?? "Comunidade sem criador informado"}
              </Text>
            </View>
          </View>

          <View className="mt-4 flex-row flex-wrap gap-2">
            {memberCountLabel ? (
              <View className="rounded-full border border-[#3A3246] bg-[#17181C] px-3 py-2">
                <Text className="text-[13px] font-bold text-[#E5E2E1]">{memberCountLabel}</Text>
              </View>
            ) : null}

            <View className="rounded-full border border-[#3A3246] bg-[#17181C] px-3 py-2">
              <Text className="text-[13px] font-bold text-[#E5E2E1]">
                {community.isMember ? "Você participa" : "Você ainda não participa"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View className="mt-5 flex-row items-center justify-between rounded-2xl bg-[#17181C] px-4 py-4">
        <View>
          <Text className="text-[15px] font-bold text-white">Abrir comunidade</Text>
          <Text className="mt-1 text-[13px] font-semibold text-[#CAC3D8]">
            Veja publicações, comentários e ações de participação.
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={24} color="#EAEA00" />
      </View>
    </Pressable>
  );
}

export default function CommunityDirectoryScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { session } = useAuth();

  const { canAccessCompletedOnboardingContent } = useRequireCompletedOnboarding();

  const authToken = session?.accessToken ?? null;
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const initialLoadRef = useRef(false);
  const requestIdRef = useRef(0);

  const [directory, setDirectory] = useState<CommunityDirectoryResponse>(
    EMPTY_DIRECTORY_RESPONSE
  );
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        setLoadError(null);

        const response = deferredSearchQuery
          ? await communityService.searchCommunities(deferredSearchQuery, {
              page: 0,
              size: DIRECTORY_PAGE_SIZE,
            })
          : await communityService.listCommunities({
              page: 0,
              size: DIRECTORY_PAGE_SIZE,
            });

        if (requestId !== requestIdRef.current) {
          return;
        }

        setDirectory(response);

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
  }, [authToken, canAccessCompletedOnboardingContent, deferredSearchQuery, isFocused]);

  const handleRefresh = async () => {
    if (!canAccessCompletedOnboardingContent) {
      return;
    }

    setRefreshing(true);
    const requestId = ++requestIdRef.current;

    try {
      setLoadError(null);

      const response = deferredSearchQuery
        ? await communityService.searchCommunities(deferredSearchQuery, {
            page: 0,
            size: DIRECTORY_PAGE_SIZE,
          })
        : await communityService.listCommunities({
            page: 0,
            size: DIRECTORY_PAGE_SIZE,
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
          })
        : await communityService.listCommunities({
            page: nextPage,
            size: DIRECTORY_PAGE_SIZE,
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
              <ActivityIndicator color="#7C4DFF" size="large" />
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
              <View className="rounded-[32px] bg-[#111214] p-6">
                <View className="flex-row items-start justify-between gap-4">
                  <View className="flex-1">
                    <Text className="text-[34px] font-black leading-10 text-white">
                      Comunidades
                    </Text>
                    <Text className="mt-3 text-[15px] font-semibold leading-6 text-[#CAC3D8] text-justify">
                      Explore comunidades criadas por usuários, pesquise pelo nome ou descrição e abra o feed da que fizer sentido para você.
                    </Text>
                  </View>

                  {/* <Pressable
                    className="rounded-full bg-[#EAEA00] px-4 py-3"
                    onPress={() => router.push("/community/new")}
                  >
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="add-circle" size={18} color="#1D1D00" />
                      <Text className="text-[14px] font-black text-[#1D1D00]">
                        Criar
                      </Text>
                    </View>
                  </Pressable> */}
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
                        onPress={() => setSearchQuery("")}
                      >
                        <Ionicons name="close" size={16} color="#E5E2E1" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                {/* <View className="mt-5 rounded-2xl border border-[#353534] bg-[#17181C] px-4 py-4">
                  <Text className="text-[13px] font-bold uppercase tracking-[1.1px] text-[#7C4DFF]">
                    Resultado atual
                  </Text>
                  <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#CAC3D8]">
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
                        loadError ??
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
                    void handleLoadMore();
                  }}
                  disabled={loadingMore}
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
            onPress={() => router.push("/community/new")}
          >
            <Ionicons name="add" size={38} color="#FCF6FF" />
          </Pressable>
        </View>

        <GlobalBottomNav />
      </SafeAreaView>
    </View>
  );
}
