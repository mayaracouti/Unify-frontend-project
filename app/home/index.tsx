import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";

import { buildActionSpeech, useTTS } from "../../src/accessibility/tts";
import { FeedPostCard } from "../../src/components/feed/feed-post-card";
import { usePostListActions } from "../../src/components/feed/use-post-list-actions";
import { AppTabScreen } from "../../src/components/navigation/app-tab-screen";
import { ScreenEmpty } from "../../src/components/ui/screen-empty";
import { ScreenError } from "../../src/components/ui/screen-error";
import { ScreenLoading } from "../../src/components/ui/screen-loading";
import { useAccessibility } from "../../src/context/AccessibilityContext";
import { useAppShell } from "../../src/context/AppShellContext";
import { useAuth } from "../../src/context/AuthContext";
import { feedService } from "../../src/services/feedService";
import type { UserPostResponse } from "../../src/types/social";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../src/utils/auth";

const PAGE_SIZE = 10;

/**
 * Aba Inicio: feed RANQUEADO (`GET /users/feed`). Mistura publicacoes de
 * quem eu sigo e das comunidades em que participo com sugestoes — perfis
 * com interesses parecidos e comunidades PUBLICAS afins — para descobrir
 * gente e comunidades sem sair do feed. Cada post traz `feedSource`; as
 * sugestoes ganham selo e acao rapida (seguir / entrar) no `FeedPostCard`.
 * As MINHAS publicacoes pessoais nao entram aqui: ficam na aba Perfil.
 */
export default function Home() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { session } = useAuth();
  const authToken = session?.accessToken ?? null;
  const { currentUserId, currentUserProfileId } = useAppShell();
  const { settings } = useAccessibility();
  const highContrast = settings.highContrast;
  const { speak } = useTTS();

  const [posts, setPosts] = useState<UserPostResponse[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const {
    deletingPostId,
    dialogs,
    handlers,
    isAuthorFollowRequested,
    likeBusyPostIds,
    suggestionBusyPostId,
  } = usePostListActions(setPosts);

  // O anúncio de feed vazio vale uma vez, senão o leitor de tela repete a
  // cada re-render/refoco da tela.
  const announcedEmptyRef = useRef(false);

  const loadFeed = useCallback(
    async (reset: boolean, options?: { announceNewCount?: boolean }) => {
      const nextPage = reset ? 0 : page + 1;

      if (reset) {
        if (!options?.announceNewCount) {
          setLoading(true);
        }
      } else {
        setLoadingMore(true);
      }

      try {
        const response = await feedService.getFeed({
          page: nextPage,
          size: PAGE_SIZE,
        });

        setLoadError("");
        setPage(response.page);
        setHasNext(response.hasNext);

        if (reset) {
          setPosts((previous) => {
            if (options?.announceNewCount) {
              const knownIds = new Set(previous.map((post) => post.id));
              const newCount = response.posts.filter(
                (post) => !knownIds.has(post.id)
              ).length;

              // Sempre anuncia: quem atualiza pelo botao "Atualizar feed"
              // (alternativa ao gesto de puxar) precisa saber que terminou.
              announceForAccessibility(
                newCount > 0
                  ? accessibilityAnnouncements.feedRefreshed(newCount)
                  : "Feed atualizado. Nenhuma publicação nova."
              );
            }

            return response.posts;
          });
        } else {
          setPosts((previous) => {
            const knownIds = new Set(previous.map((post) => post.id));
            const appended = response.posts.filter(
              (post) => !knownIds.has(post.id)
            );

            if (appended.length > 0) {
              announceForAccessibility(
                accessibilityAnnouncements.moreItemsLoaded(
                  appended.length,
                  "publicações"
                )
              );
            }

            return [...previous, ...appended];
          });
        }
      } catch (nextError) {
        if (reset) {
          setLoadError(
            formatApiErrorMessage(
              nextError,
              "Não foi possível carregar seu feed."
            )
          );
        }
        // Global API error toast already explains the failure.
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [page]
  );

  // Recarrega ao focar a tela: o feed muda quando o usuário segue alguém,
  // entra em uma comunidade ou edita/apaga um post em outra tela.
  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void loadFeed(true);
    // `loadFeed` muda a cada página carregada; depender dele aqui recarregaria
    // o feed durante a paginação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  const isEmpty = !loading && !loadError && posts.length === 0;

  useEffect(() => {
    if (!isEmpty) {
      announcedEmptyRef.current = false;
      return;
    }

    if (announcedEmptyRef.current) {
      return;
    }

    announcedEmptyRef.current = true;
    announceForAccessibility(accessibilityAnnouncements.feedEmpty());
  }, [isEmpty]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadFeed(true, { announceNewCount: true });
  }, [loadFeed]);

  // Alternativa acessivel ao pull-to-refresh: o gesto de puxar e dificil com
  // leitor de tela ativo, entao o topo da lista tem um botao equivalente.
  const refreshButton = (
    <View className="mb-3 flex-row items-center justify-between gap-3">
      {/* Titulo discreto: o cabecalho grande da aba foi removido para dar espaco ao feed. */}
      <Text
        accessibilityRole="header"
        className={`flex-1 text-[20px] font-bold ${
          highContrast ? "text-hc-text" : "text-white"
        }`}
      >
        Início
      </Text>
      <Pressable
        className={`min-h-[44px] flex-row items-center gap-2 rounded-full px-4 py-2 ${
          highContrast ? "border border-hc-border bg-hc-surface" : "bg-[#2A2340]"
        }`}
        disabled={refreshing}
        onPress={() => {
          speak(buildActionSpeech("Atualizar feed"));
          handleRefresh();
        }}
        accessibilityRole="button"
        accessibilityLabel="Atualizar feed"
        accessibilityHint="Busca as publicações mais recentes"
        accessibilityState={{ disabled: refreshing, busy: refreshing }}
      >
        {refreshing ? (
          <ActivityIndicator color={highContrast ? "#FFFFFF" : "#CDBDFF"} size="small" />
        ) : (
          <Ionicons
            name="refresh"
            size={18}
            color={highContrast ? "#FFFFFF" : "#CDBDFF"}
            importantForAccessibility="no"
          />
        )}
        <Text
          className={`text-[14px] font-bold ${
            highContrast ? "text-hc-text" : "text-[#CDBDFF]"
          }`}
        >
          Atualizar feed
        </Text>
      </Pressable>
    </View>
  );

  const handleEndReached = useCallback(() => {
    if (!hasNext || loadingMore || loading || refreshing) {
      return;
    }

    void loadFeed(false);
  }, [hasNext, loadFeed, loading, loadingMore, refreshing]);

  const renderContent = () => {
    if (loading) {
      return <ScreenLoading label="Carregando seu feed" />;
    }

    if (loadError) {
      return (
        <ScreenError
          message={loadError}
          title="Não foi possível carregar o feed"
          onRetry={() => {
            void loadFeed(true);
          }}
          retrying={loading}
        />
      );
    }

    if (isEmpty) {
      return (
        <ScreenEmpty
          title="Ainda não há publicações"
          description="O feed mostra publicações de quem você segue, das suas comunidades e sugestões de pessoas e comunidades. Assim que alguém publicar, aparece aqui."
          action={{
            label: "Ir para o Encontros",
            onPress: () => {
              router.push("/matches");
            },
            accessibilityHint: "Abre a tela de descoberta de perfis",
          }}
          icon={
            <Ionicons
              name="people-outline"
              size={36}
              color="#7C4DFF"
              importantForAccessibility="no"
            />
          }
        />
      );
    }

    // FlatList (e não ScrollView como na comunidade): o feed pessoal cresce
    // sem limite via paginação infinita e precisa reciclar as linhas.
    return (
      <FlatList
        accessibilityLabel="Feed do Início"
        data={posts}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-10"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#EAEA00"
          />
        }
        ListHeaderComponent={refreshButton}
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
            isOwnPost={
              (currentUserId !== null && item.author.userId === currentUserId) ||
              (currentUserProfileId !== null &&
                item.author.userProfileId === currentUserProfileId)
            }
            likeBusy={likeBusyPostIds.has(item.id)}
            post={item}
            suggestionBusy={suggestionBusyPostId === item.id}
            authorFollowRequested={isAuthorFollowRequested(item)}
            {...handlers}
          />
        )}
      />
    );
  };

  return (
    <AppTabScreen title="Início" hideHeader>
      <View className={`flex-1 ${highContrast ? "bg-hc-bg" : "bg-[#1F2023]"}`}>
        {renderContent()}
      </View>

      {dialogs}
    </AppTabScreen>
  );
}
