import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";

import { buildActionSpeech, useTTS } from "../../src/accessibility/tts";
import { AppTabScreen } from "../../src/components/navigation/app-tab-screen";
import { AuthenticatedRemoteImage } from "../../src/components/profile/authenticated-remote-image";
import { ReportModal } from "../../src/components/report/report-modal";
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

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Data relativa em pt-BR. Falar "há 5 min" situa melhor do que um timestamp
 * cru quando o leitor de tela anuncia o cartão inteiro de uma vez.
 */
function formatRelativeDate(isoDate: string) {
  const timestamp = Date.parse(isoDate);

  if (Number.isNaN(timestamp)) {
    return "";
  }

  const elapsed = Date.now() - timestamp;

  if (elapsed < MINUTE_MS) {
    return "agora mesmo";
  }

  if (elapsed < HOUR_MS) {
    return `há ${Math.floor(elapsed / MINUTE_MS)} min`;
  }

  if (elapsed < DAY_MS) {
    return `há ${Math.floor(elapsed / HOUR_MS)} h`;
  }

  if (elapsed < 2 * DAY_MS) {
    return "ontem";
  }

  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${day}/${month}`;
}

function getInitial(name: string) {
  return (name.trim()[0] ?? "?").toUpperCase();
}

type PersonalPostCardProps = {
  authToken: string | null;
  deleting: boolean;
  highContrast: boolean;
  isOwnPost: boolean;
  onDelete: (post: UserPostResponse) => void;
  onReport: (post: UserPostResponse) => void;
  post: UserPostResponse;
};

function PersonalPostCard({
  authToken,
  deleting,
  highContrast,
  isOwnPost,
  onDelete,
  onReport,
  post,
}: PersonalPostCardProps) {
  const { speak } = useTTS();
  const formattedDate = useMemo(
    () => formatRelativeDate(post.createdAt),
    [post.createdAt]
  );
  const avatarUri = feedService.resolveAssetUrl(post.author.avatarUrl);
  const mediaUri = feedService.resolveAssetUrl(post.mediaUrl);

  const avatarFallback = (
    <LinearGradient
      colors={["#CDBDFF", "#7C4DFF"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="h-full w-full items-center justify-center"
    >
      <Text className="text-[16px] font-black text-white">
        {getInitial(post.author.name)}
      </Text>
    </LinearGradient>
  );

  return (
    <View
      className={`mb-4 rounded-[28px] p-6 ${
        highContrast ? "border border-hc-border bg-hc-surface" : "bg-[#111214]"
      }`}
    >
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`Publicação de ${post.author.name}, ${formattedDate}: ${post.body.slice(0, 120)}`}
      >
        <View className="flex-row items-center">
          <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-[#CDBDFF] bg-[#353534]">
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
          </View>

          <View className="ml-3 flex-1">
            <Text
              className={`text-[17px] font-black ${
                highContrast ? "text-hc-text" : "text-white"
              }`}
            >
              {post.author.name}
            </Text>
            <Text
              className={`mt-1 text-[13px] font-semibold ${
                highContrast ? "text-hc-text" : "text-[#CAC3D8]"
              }`}
            >
              {formattedDate}
            </Text>
          </View>
        </View>

        <Text
          className={`mt-4 text-[15px] font-semibold leading-6 ${
            highContrast ? "text-hc-text" : "text-white"
          }`}
        >
          {post.body}
        </Text>

        {mediaUri ? (
          <AuthenticatedRemoteImage
            accessibilityLabel={`Imagem da publicação de ${post.author.name}`}
            authToken={authToken}
            className="mt-3 h-56 w-full rounded-2xl"
            fallback={
              <View className="mt-3 h-56 w-full items-center justify-center rounded-2xl bg-[#2A2A2A]">
                <Ionicons name="image-outline" size={28} color="#948EA1" />
              </View>
            }
            resizeMode="cover"
            uri={mediaUri}
          />
        ) : null}
      </View>

      <View className="mt-4 flex-row justify-end">
        {isOwnPost ? (
          <Pressable
            className="h-11 w-11 items-center justify-center rounded-full border border-[#494455]"
            onPress={() => {
              speak(buildActionSpeech("Excluir publicação"));
              onDelete(post);
            }}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Excluir publicação"
            accessibilityHint="Remove esta publicação do seu feed"
            accessibilityState={{ disabled: deleting, busy: deleting }}
          >
            {deleting ? (
              <ActivityIndicator color="#FF8A8A" size="small" />
            ) : (
              <Ionicons name="trash-outline" size={20} color="#FF8A8A" />
            )}
          </Pressable>
        ) : (
          <Pressable
            className="h-11 w-11 items-center justify-center rounded-full border border-[#494455]"
            onPress={() => {
              speak(buildActionSpeech("Denunciar publicação"));
              onReport(post);
            }}
            accessibilityRole="button"
            accessibilityLabel="Denunciar publicação"
            accessibilityHint="Abre o formulário de denúncia"
          >
            <Ionicons name="flag-outline" size={20} color="#CAC3D8" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function Home() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { speak } = useTTS();
  const { session } = useAuth();
  const authToken = session?.accessToken ?? null;
  const { currentUserId, currentUserProfileId } = useAppShell();
  const { settings } = useAccessibility();
  const highContrast = settings.highContrast;
  const params = useLocalSearchParams<{ created?: string | string[] }>();
  const createdParam = Array.isArray(params.created)
    ? params.created[0]
    : params.created;

  const [posts, setPosts] = useState<UserPostResponse[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [reportedPost, setReportedPost] = useState<UserPostResponse | null>(null);

  // O anúncio de "publicação criada" e o de feed vazio valem uma vez cada,
  // senão o leitor de tela repete a cada re-render/refoco da tela.
  const announcedCreationRef = useRef(false);
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

              if (newCount > 0) {
                announceForAccessibility(
                  accessibilityAnnouncements.feedRefreshed(newCount)
                );
              }
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

  // Recarrega ao focar a tela: o feed muda quando o usuário publica, segue
  // alguém ou apaga um post em outra tela.
  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void loadFeed(true);
    // `loadFeed` muda a cada página carregada; depender dele aqui recarregaria
    // o feed durante a paginação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  useEffect(() => {
    if (createdParam !== "1" || announcedCreationRef.current) {
      return;
    }

    announcedCreationRef.current = true;
    announceForAccessibility(accessibilityAnnouncements.personalPostCreated());
  }, [createdParam]);

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

  const handleEndReached = useCallback(() => {
    if (!hasNext || loadingMore || loading || refreshing) {
      return;
    }

    void loadFeed(false);
  }, [hasNext, loadFeed, loading, loadingMore, refreshing]);

  const handleDelete = useCallback((post: UserPostResponse) => {
    Alert.alert(
      "Excluir publicação",
      "Esta publicação será removida do seu feed. Não dá para desfazer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            setDeletingPostId(post.id);

            void (async () => {
              try {
                await feedService.deletePost(post.id);
                setPosts((previous) =>
                  previous.filter((item) => item.id !== post.id)
                );
                announceForAccessibility(
                  accessibilityAnnouncements.personalPostDeleted()
                );
              } catch {
                // Global API error toast already explains the failure.
              } finally {
                setDeletingPostId(null);
              }
            })();
          },
        },
      ]
    );
  }, []);

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
          title="Seu feed está vazio"
          description="Você ainda não segue ninguém. Explore o Descobrir para encontrar pessoas e siga para ver as publicações delas aqui."
          action={{
            label: "Ir para o Descobrir",
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
        accessibilityLabel="Feed pessoal"
        data={posts}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-28"
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
          <PersonalPostCard
            authToken={authToken}
            deleting={deletingPostId === item.id}
            highContrast={highContrast}
            isOwnPost={
              (currentUserId !== null && item.author.userId === currentUserId) ||
              (currentUserProfileId !== null &&
                item.author.userProfileId === currentUserProfileId)
            }
            onDelete={handleDelete}
            onReport={setReportedPost}
            post={item}
          />
        )}
      />
    );
  };

  return (
    <AppTabScreen
      title="Início"
      subtitle="Publicações de quem você segue e as suas."
    >
      <View className={`flex-1 ${highContrast ? "bg-hc-bg" : "bg-[#1F2023]"}`}>
        {renderContent()}
      </View>

      <Pressable
        className="absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-full border-2 border-[#CDBDFF] bg-[#7C4DFF]"
        onPress={() => {
          speak(buildActionSpeech("Criar publicação"));
          router.push("/home/new-post");
        }}
        accessibilityRole="button"
        accessibilityLabel="Criar publicação"
        accessibilityHint="Abre a tela para escrever uma nova publicação"
      >
        <Ionicons name="add" size={38} color="#FCF6FF" />
      </Pressable>

      {/*
        Posts pessoais e de comunidade vivem na mesma tabela no backend
        (`posts`, coluna origin), então a denúncia aponta para a
        própria publicação; o autor vai junto como usuário denunciado.
      */}
      <ReportModal
        visible={reportedPost !== null}
        onClose={() => setReportedPost(null)}
        reportedUserId={reportedPost?.author.userId ?? ""}
        reportedPostId={reportedPost?.id ?? null}
        contextLabel={`publicação de ${reportedPost?.author.name ?? ""}`}
      />
    </AppTabScreen>
  );
}
