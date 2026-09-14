import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { buildActionSpeech, useTTS } from "../../accessibility/tts";
import { feedService } from "../../services/feedService";
import type { UserPostResponse } from "../../types/social";
import { formatApiErrorMessage } from "../../utils/auth";
import { FeedPostCard } from "./feed-post-card";
import { usePostListActions } from "./use-post-list-actions";

/** Quantas publicacoes a secao mostra antes do "Ver todas". */
export const PROFILE_POSTS_PREVIEW_SIZE = 3;

type ProfilePostsSectionProps = {
  authToken: string | null;
  highContrast: boolean;
  /** Perfil do proprio usuario: ganha editar/excluir e o atalho de criar. */
  isOwnProfile: boolean;
  onCreatePost?: () => void;
  onSeeAll: () => void;
  /** Nome de quem e o perfil (para textos vazios do perfil publico). */
  ownerName?: string | null;
  userProfileId: string;
};

/**
 * Secao "Publicacoes" do perfil (proprio ou publico): mostra so as ultimas
 * publicacoes pessoais; a serie historica completa fica em `/profile/posts`.
 * Recarrega a cada foco: criar/editar/apagar acontece em outras telas.
 */
export function ProfilePostsSection({
  authToken,
  highContrast,
  isOwnProfile,
  onCreatePost,
  onSeeAll,
  ownerName,
  userProfileId,
}: ProfilePostsSectionProps) {
  const { speak } = useTTS();
  const [posts, setPosts] = useState<UserPostResponse[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const { deletingPostId, dialogs, handlers, likeBusyPostId } = usePostListActions(setPosts);

  const load = useCallback(async () => {
    try {
      const response = await feedService.getProfilePosts(userProfileId, {
        page: 0,
        size: PROFILE_POSTS_PREVIEW_SIZE,
      });

      setPosts(response.posts);
      setHasMore(response.hasNext);
      setLoadError("");
    } catch (nextError) {
      setLoadError(
        formatApiErrorMessage(nextError, "Não foi possível carregar as publicações.")
      );
    } finally {
      setLoading(false);
    }
  }, [userProfileId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const titleColor = highContrast ? "text-hc-text" : "text-white";
  const secondaryColor = highContrast ? "text-hc-text" : "text-content-secondary";

  return (
    <View className="mt-10">
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons
            name="newspaper-outline"
            size={22}
            color="#D6C5FF"
            importantForAccessibility="no"
          />
          <Text accessibilityRole="header" className={`ml-3 text-[20px] font-black ${titleColor}`}>
            Postagens
          </Text>
        </View>

        {posts.length > 0 ? (
          <Pressable
            className="flex-row items-center rounded-full border border-[#494455] bg-[#1A1C1F] px-4 py-2"
            onPress={() => {
              speak(buildActionSpeech("Ver todas as postagens"));
              onSeeAll();
            }}
            accessibilityRole="button"
            accessibilityLabel="Ver todas as postagens"
            accessibilityHint={
              hasMore
                ? "Abre a lista completa, com as postagens mais antigas"
                : "Abre a lista completa de postagens"
            }
          >
            <Text className="text-[13px] font-black text-white">Ver todas</Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color="#CDBDFF"
              importantForAccessibility="no"
            />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Carregando publicações"
          accessibilityState={{ busy: true }}
          className="items-center justify-center rounded-[22px] border border-[#3A3246] bg-[#17181C] px-5 py-6"
        >
          <ActivityIndicator color="#EAEA00" size="small" />
        </View>
      ) : loadError ? (
        <View
          accessibilityRole="alert"
          className="rounded-[22px] border border-[#6A4456] bg-[#2A1C24] px-4 py-4"
        >
          <Text className="text-[15px] font-bold text-[#FFD3DD]">
            Não foi possível carregar as publicações
          </Text>
          <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#FFEAF0]">
            {loadError}
          </Text>
          <Pressable
            className="mt-4 self-start rounded-full border border-[#494455] px-4 py-2"
            onPress={() => {
              speak("Tentar novamente");
              setLoading(true);
              void load();
            }}
            accessibilityRole="button"
            accessibilityLabel="Tentar novamente"
          >
            <Text className="text-[13px] font-black text-white">Tentar novamente</Text>
          </Pressable>
        </View>
      ) : posts.length === 0 ? (
        <View className="rounded-[22px] border border-dashed border-[#494455] bg-[#151619] px-5 py-6">
          <View
            accessible
            accessibilityRole="text"
            accessibilityLabel={
              isOwnProfile
                ? "Você ainda não publicou nada. Suas publicações aparecem aqui e no feed de quem te segue."
                : `${ownerName?.trim() || "Esta pessoa"} ainda não publicou nada.`
            }
          >
            <Text className={`text-[16px] font-bold ${titleColor}`}>
              {isOwnProfile ? "Você ainda não publicou nada" : "Nenhuma publicação ainda"}
            </Text>
            <Text className={`mt-2 text-[14px] font-semibold leading-6 ${secondaryColor}`}>
              {isOwnProfile
                ? "Suas publicações aparecem aqui e no feed de quem te segue."
                : `${ownerName?.trim() || "Esta pessoa"} ainda não compartilhou nada.`}
            </Text>
          </View>

          {isOwnProfile && onCreatePost ? (
            <Pressable
              className="mt-4 flex-row items-center self-start rounded-full bg-[#7C4DFF] px-5 py-3"
              onPress={() => {
                speak(buildActionSpeech("Criar publicação"));
                onCreatePost();
              }}
              accessibilityRole="button"
              accessibilityLabel="Criar publicação"
              accessibilityHint="Abre a tela para escrever uma nova publicação"
            >
              <Ionicons name="add" size={18} color="#FCF6FF" importantForAccessibility="no" />
              <Text className="ml-1 text-[14px] font-black text-white">Criar publicação</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View>
          {posts.map((post) => (
            <FeedPostCard
              key={post.id}
              authToken={authToken}
              deleting={deletingPostId === post.id}
              highContrast={highContrast}
              isOwnPost={isOwnProfile}
              likeBusy={likeBusyPostId === post.id}
              post={post}
              {...handlers}
            />
          ))}

          {hasMore ? (
            <Pressable
              className="items-center rounded-full border border-[#494455] bg-[#1A1C1F] px-5 py-3"
              onPress={() => {
                speak(buildActionSpeech("Ver todas as postagens"));
                onSeeAll();
              }}
              accessibilityRole="button"
              accessibilityLabel="Ver postagens mais antigas"
              accessibilityHint="Abre a lista completa de postagens"
            >
              <Text className="text-[14px] font-black text-white">Ver postagens mais antigas</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {dialogs}
    </View>
  );
}
