import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTTS } from "../../src/accessibility/tts";
import { CommunityDirectoryCard } from "../../src/components/community/community-card";
import { GlobalBottomNav } from "../../src/components/navigation/global-bottom-nav";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import { preloadAuthenticatedRemoteImages } from "../../src/components/profile/authenticated-remote-image";
import { ScreenEmpty } from "../../src/components/ui/screen-empty";
import { ScreenLoading } from "../../src/components/ui/screen-loading";
import { useAuth } from "../../src/context/AuthContext";
import { useAsyncState } from "../../src/hooks/useAsyncState";
import { communityService } from "../../src/services/communityService";
import type {
  CommunityDirectoryResponse,
  CommunitySummaryResponse,
} from "../../src/types/community";
import { formatApiErrorMessage } from "../../src/utils/auth";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";

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

export default function MyCommunitiesScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { speak } = useTTS();
  const { session } = useAuth();

  const authToken = session?.accessToken ?? null;
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
    if (!isFocused) {
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

        const response = await communityService.getMyCommunities({
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
          formatApiErrorMessage(error, "Não foi possível carregar suas comunidades agora.")
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
  }, [authToken, isFocused]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const requestId = ++requestIdRef.current;

    try {
      setLoadError("");

      const response = await communityService.getMyCommunities({
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
        formatApiErrorMessage(error, "Não foi possível atualizar suas comunidades agora.")
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setRefreshing(false);
      }
    }
  };

  const handleLoadMore = async () => {
    if (!directory.hasNext || loadingMore) {
      return;
    }

    setLoadingMore(true);
    const requestId = ++requestIdRef.current;

    try {
      const response = await communityService.getMyCommunities({
        page: directory.page + 1,
        size: DIRECTORY_PAGE_SIZE,
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      setDirectory((currentDirectory) => buildMergedDirectory(currentDirectory, response, true));
      announceForAccessibility(
        accessibilityAnnouncements.moreItemsLoaded(response.communities.length, "comunidades")
      );

      const assetUrls = collectDirectoryAssetUrls(response);

      if (assetUrls.length > 0) {
        void preloadAuthenticatedRemoteImages(assetUrls, authToken);
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setLoadError(formatApiErrorMessage(error, "Não foi possível carregar mais comunidades."));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingMore(false);
      }
    }
  };

  return (
    <View className="flex-1 bg-[#0D0D0E]">
      <SafeAreaView className="flex-1 bg-black">
        <GlobalTopNav />

        <View className="flex-1">
          {loading && directory.communities.length === 0 ? (
            <View className="flex-1 items-center justify-center bg-[#131313]">
              <ScreenLoading label="Carregando suas comunidades..." />
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
              showsVerticalScrollIndicator={false}
            >
              <View className="rounded-[32px] bg-surface-alt p-6">
                <View>
                  <Text className="text-[34px] font-black leading-10 text-white">
                    Minhas comunidades
                  </Text>
                  <Text className="mt-3 text-justify text-[15px] font-semibold leading-6 text-content-secondary">
                    Aqui ficam apenas as comunidades das quais você participa, incluindo as
                    que você criou.
                  </Text>
                </View>

                <Pressable
                  className="mt-4 flex-row items-center justify-center gap-2 rounded-[24px] border border-[#3A3246] bg-[#17181C] px-4 py-3"
                  onPress={() => {
                    speak("Explorar comunidades");
                    router.push("/community");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Explorar comunidades"
                  accessibilityHint="Abre a lista com todas as comunidades disponíveis"
                >
                  <Ionicons name="compass-outline" size={18} color="#EAEA00" />
                  <Text className="text-[14px] font-black text-white">Explorar comunidades</Text>
                </Pressable>
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
                  <ScreenEmpty
                    className="items-center rounded-[28px] border border-[#353534] bg-surface-alt px-6 py-10"
                    icon={
                      <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-[#201F1F]">
                        <Ionicons name="people-outline" size={32} color="#7C4DFF" />
                      </View>
                    }
                    title="Nenhuma comunidade ainda"
                    description={
                      loadError || "Você ainda não participa de nenhuma comunidade."
                    }
                    action={{
                      label: "Explorar comunidades",
                      onPress: () => router.push("/community"),
                      accessibilityHint: "Abre a lista com todas as comunidades disponíveis",
                    }}
                  />
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
                  accessibilityHint="Adiciona mais comunidades à lista"
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
