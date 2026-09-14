import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTTS } from "../../src/accessibility/tts";
import { FeedPostCard } from "../../src/components/feed/feed-post-card";
import { usePostListActions } from "../../src/components/feed/use-post-list-actions";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import { ScreenEmpty } from "../../src/components/ui/screen-empty";
import { ScreenError } from "../../src/components/ui/screen-error";
import { ScreenLoading } from "../../src/components/ui/screen-loading";
import { useAccessibility } from "../../src/context/AccessibilityContext";
import { useAppShell } from "../../src/context/AppShellContext";
import { useAuth } from "../../src/context/AuthContext";
import { useScreenHeadingFocus } from "../../src/hooks/use-screen-heading-focus";
import { feedService } from "../../src/services/feedService";
import type { UserPostResponse } from "../../src/types/social";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../src/utils/auth";

const PAGE_SIZE = 10;

function normalizeParam(value?: string | string[]) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/**
 * Serie historica completa das publicacoes pessoais de um perfil, com
 * paginacao infinita. Sem `userProfileId` na rota, mostra as do proprio
 * usuario (atalho "Ver todas" da aba Perfil).
 */
export default function ProfilePostsScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{
    userProfileId?: string | string[];
    name?: string | string[];
  }>();
  const headingRef = useScreenHeadingFocus<Text>();
  const { speak } = useTTS();
  const { session } = useAuth();
  const authToken = session?.accessToken ?? null;
  const { currentUserProfileId } = useAppShell();
  const { settings } = useAccessibility();
  const highContrast = settings.highContrast;

  const requestedProfileId = normalizeParam(params.userProfileId);
  const ownerName = normalizeParam(params.name);
  const targetProfileId = requestedProfileId || currentUserProfileId;
  const isOwnProfile = Boolean(targetProfileId) && targetProfileId === currentUserProfileId;
  const heading = isOwnProfile ? "Suas postagens" : `Postagens de ${ownerName || "perfil"}`;

  const [posts, setPosts] = useState<UserPostResponse[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const { deletingPostId, dialogs, handlers, likeBusyPostId } = usePostListActions(setPosts);

  const loadPosts = useCallback(
    async (reset: boolean) => {
      if (!targetProfileId) {
        return;
      }

      const nextPage = reset ? 0 : page + 1;

      if (reset) {
        setLoading((current) => current || posts.length === 0);
      } else {
        setLoadingMore(true);
      }

      try {
        const response = await feedService.getProfilePosts(targetProfileId, {
          page: nextPage,
          size: PAGE_SIZE,
        });

        setLoadError("");
        setPage(response.page);
        setHasNext(response.hasNext);

        if (reset) {
          setPosts(response.posts);
          return;
        }

        setPosts((previous) => {
          const knownIds = new Set(previous.map((post) => post.id));
          const appended = response.posts.filter((post) => !knownIds.has(post.id));

          if (appended.length > 0) {
            announceForAccessibility(
              accessibilityAnnouncements.moreItemsLoaded(appended.length, "publicações")
            );
          }

          return [...previous, ...appended];
        });
      } catch (nextError) {
        if (reset) {
          setLoadError(
            formatApiErrorMessage(nextError, "Não foi possível carregar as publicações.")
          );
        }
        // Global API error toast already explains the failure.
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    // `posts.length` so decide se o loader aparece; nao deve recriar o callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, targetProfileId]
  );

  // Recarrega ao focar: editar/apagar acontece em outra tela.
  useEffect(() => {
    if (!isFocused || !targetProfileId) {
      return;
    }

    void loadPosts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, targetProfileId]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadPosts(true);
  }, [loadPosts]);

  const handleEndReached = useCallback(() => {
    if (!hasNext || loadingMore || loading || refreshing) {
      return;
    }

    void loadPosts(false);
  }, [hasNext, loadPosts, loading, loadingMore, refreshing]);

  const emptyDescription = useMemo(
    () =>
      isOwnProfile
        ? "Você ainda não publicou nada. Toque no botão de mais na barra inferior para criar a primeira publicação."
        : `${ownerName || "Esta pessoa"} ainda não compartilhou nada.`,
    [isOwnProfile, ownerName]
  );

  const renderContent = () => {
    if (!targetProfileId) {
      return (
        <ScreenError
          message="Não foi possível identificar o perfil das publicações."
          title="Perfil indisponível"
        />
      );
    }

    if (loading) {
      return <ScreenLoading label="Carregando publicações" />;
    }

    if (loadError) {
      return (
        <ScreenError
          message={loadError}
          title="Não foi possível carregar as publicações"
          onRetry={() => {
            setLoading(true);
            void loadPosts(true);
          }}
          retrying={loading}
        />
      );
    }

    if (posts.length === 0) {
      return (
        <ScreenEmpty
          title="Nenhuma publicação ainda"
          description={emptyDescription}
          action={
            isOwnProfile
              ? {
                  label: "Criar publicação",
                  onPress: () => router.push("/profile/new-post"),
                  accessibilityHint: "Abre a tela para escrever uma nova publicação",
                }
              : undefined
          }
        />
      );
    }

    return (
      <FlatList
        accessibilityLabel={heading}
        data={posts}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-10"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#EAEA00" />
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
          <FeedPostCard
            authToken={authToken}
            deleting={deletingPostId === item.id}
            highContrast={highContrast}
            isOwnPost={isOwnProfile}
            likeBusy={likeBusyPostId === item.id}
            post={item}
            {...handlers}
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
          <View className="mb-6 flex-row items-center">
            <Pressable
              className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-[#17181C]"
              onPress={() => {
                speak("Voltar");
                if (router.canGoBack()) {
                  router.back();
                  return;
                }
                router.replace("/profile");
              }}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              accessibilityHint="Volta para o perfil"
            >
              <Ionicons name="arrow-back" size={24} color="#A270FF" importantForAccessibility="no" />
            </Pressable>

            <Text
              ref={headingRef}
              accessibilityRole="header"
              className={`flex-1 text-[28px] font-extrabold ${
                highContrast ? "text-hc-text" : "text-white"
              }`}
              numberOfLines={2}
            >
              {heading}
            </Text>
          </View>

          <View className="flex-1">{renderContent()}</View>
        </View>
      </SafeAreaView>

      {dialogs}
    </View>
  );
}
