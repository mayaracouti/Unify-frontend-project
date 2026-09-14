import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useMemo, useState, type ComponentProps } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { buildActionSpeech, buildFeedPostSpeech, useTTS } from "../../accessibility/tts";
import { feedService } from "../../services/feedService";
import type { UserPostResponse } from "../../types/social";
import { describeFeedSuggestion } from "../../utils/feedSource";
import { formatRelativePostDate, getNameInitial } from "../../utils/postFormatting";
import { AuthenticatedRemoteImage } from "../profile/authenticated-remote-image";
import { ActionSheet, type ActionSheetOption } from "../ui/action-sheet";

/** Acoes que o card delega para a tela (a tela decide o que fazer com cada uma). */
export type FeedPostCardHandlers = {
  onToggleLike: (post: UserPostResponse) => void;
  onOpenComments: (post: UserPostResponse) => void;
  onOpenProfile?: (post: UserPostResponse) => void;
  onOpenCommunity?: (post: UserPostResponse) => void;
  onEdit?: (post: UserPostResponse) => void;
  onDelete?: (post: UserPostResponse) => void;
  onReport?: (post: UserPostResponse) => void;
  /** Acao rapida de sugestao (feed do Inicio): seguir o autor de um `SUGGESTED_PROFILE`. */
  onFollowAuthor?: (post: UserPostResponse) => void;
  /** Acao rapida de sugestao (feed do Inicio): entrar na comunidade de um `SUGGESTED_COMMUNITY`. */
  onJoinCommunity?: (post: UserPostResponse) => void;
};

type FeedPostCardProps = FeedPostCardHandlers & {
  authToken: string | null;
  post: UserPostResponse;
  /** Post do usuario autenticado: ganha editar/excluir e perde denunciar. */
  isOwnPost: boolean;
  highContrast: boolean;
  likeBusy: boolean;
  deleting: boolean;
  /** Acao rapida da sugestao (seguir/entrar) em andamento. */
  suggestionBusy?: boolean;
  /** Oculta o cabecalho da comunidade (ex.: dentro da propria comunidade). */
  hideCommunity?: boolean;
};

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function FeedCounterAction({
  accessibilityHint,
  accessibilityLabel,
  active,
  count,
  icon,
  loading,
  onPress,
}: {
  accessibilityHint: string;
  accessibilityLabel: string;
  active: boolean;
  count: number;
  icon: ComponentProps<typeof Ionicons>["name"];
  loading?: boolean;
  onPress: () => void;
}) {
  const busy = Boolean(loading);

  return (
    <Pressable
      className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-lg"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy, disabled: busy, selected: active }}
      onPress={onPress}
      disabled={busy}
    >
      {busy ? (
        <ActivityIndicator color="#7C4DFF" size="small" />
      ) : (
        <Ionicons
          name={icon}
          size={22}
          color={active ? "#7C4DFF" : "#CAC3D8"}
          importantForAccessibility="no"
        />
      )}
      <Text
        className={`text-[15px] font-bold ${active ? "text-[#7C4DFF]" : "text-[#E5E2E1]"}`}
        importantForAccessibility="no"
      >
        {count}
      </Text>
    </Pressable>
  );
}

/**
 * Card de publicacao do feed unificado. Serve para a aba Inicio (posts de quem
 * sigo + das comunidades em que participo), para a secao "Publicacoes" do
 * perfil e para o perfil publico de outra pessoa.
 *
 * Indicadores de curtidas e comentarios ficam visiveis para todo mundo. As
 * acoes de dono (editar/excluir) e a denuncia ficam atras de um unico botao
 * discreto de reticencias — nada de lixeira grande no card.
 */
export const FeedPostCard = memo(function FeedPostCard({
  authToken,
  post,
  isOwnPost,
  highContrast,
  likeBusy,
  deleting,
  suggestionBusy,
  hideCommunity,
  onToggleLike,
  onOpenComments,
  onOpenProfile,
  onOpenCommunity,
  onEdit,
  onDelete,
  onReport,
  onFollowAuthor,
  onJoinCommunity,
}: FeedPostCardProps) {
  const { speak } = useTTS();
  const [menuVisible, setMenuVisible] = useState(false);

  const formattedDate = useMemo(() => formatRelativePostDate(post.createdAt), [post.createdAt]);
  const avatarUri = feedService.resolveAssetUrl(post.author.avatarUrl);
  const mediaUri = feedService.resolveAssetUrl(post.mediaUrl);
  const communityIconUri = feedService.resolveAssetUrl(post.community?.iconUrl);
  const authorName = post.author.name?.trim() || "Pessoa sem nome";
  const canOpenProfile = Boolean(onOpenProfile && post.author.userProfileId && !isOwnPost);
  const showCommunity = Boolean(post.community) && !hideCommunity;

  // Selo de sugestao: so no feed do Inicio (feedSource vem do ranking) e so
  // quando a tela oferece a acao rapida correspondente.
  const suggestion = describeFeedSuggestion(post);
  const suggestionHandler =
    suggestion?.action === "follow"
      ? onFollowAuthor
      : suggestion?.action === "join"
        ? onJoinCommunity
        : undefined;
  const showSuggestion = Boolean(suggestion && suggestionHandler && !isOwnPost);

  const menuOptions: ActionSheetOption[] = [];

  if (isOwnPost && onEdit) {
    menuOptions.push({
      key: "edit",
      label: "Editar publicação",
      hint: "Abre o texto da publicação para alterar",
      icon: "pencil-outline",
      onPress: () => {
        setMenuVisible(false);
        speak(buildActionSpeech("Editar publicação"));
        onEdit(post);
      },
    });
  }

  if (isOwnPost && onDelete) {
    menuOptions.push({
      key: "delete",
      label: "Excluir publicação",
      hint: "Pede confirmação antes de excluir",
      icon: "trash-outline",
      destructive: true,
      onPress: () => {
        setMenuVisible(false);
        speak(buildActionSpeech("Excluir publicação"));
        onDelete(post);
      },
    });
  }

  if (!isOwnPost && onReport) {
    menuOptions.push({
      key: "report",
      label: "Denunciar publicação",
      hint: "Abre o formulário de denúncia",
      icon: "flag-outline",
      onPress: () => {
        setMenuVisible(false);
        speak(buildActionSpeech("Denunciar publicação"));
        onReport(post);
      },
    });
  }

  const textColor = highContrast ? "text-hc-text" : "text-white";
  const secondaryColor = highContrast ? "text-hc-text" : "text-[#CAC3D8]";

  const avatarFallback = (
    <LinearGradient
      colors={["#CDBDFF", "#7C4DFF"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="h-full w-full items-center justify-center"
    >
      <Text className="text-[16px] font-black text-white">{getNameInitial(authorName)}</Text>
    </LinearGradient>
  );

  const avatar = (
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
  );

  const summaryLabel = [
    showSuggestion && suggestion ? suggestion.label : null,
    `Publicação de ${authorName}`,
    showCommunity && post.community ? `na comunidade ${post.community.name}` : null,
    formattedDate,
    post.editedAt ? "editada" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View
      className={`mb-4 rounded-[28px] p-5 ${
        highContrast ? "border border-hc-border bg-hc-surface" : "bg-[#111214]"
      }`}
    >
      {showSuggestion && suggestion ? (
        <View
          className={`mb-4 flex-row items-center gap-3 rounded-2xl px-3 py-2 ${
            highContrast ? "border border-hc-border bg-hc-surface" : "bg-[#2A2340]"
          }`}
          accessibilityRole="text"
          accessibilityLabel={`${suggestion.label}. ${suggestion.reason}`}
        >
          <Ionicons
            name={suggestion.action === "follow" ? "sparkles-outline" : "compass-outline"}
            size={16}
            color={highContrast ? "#FFFFFF" : "#CDBDFF"}
            importantForAccessibility="no"
          />
          <View className="flex-1">
            <Text
              className={`text-[12px] font-black uppercase tracking-wide ${
                highContrast ? "text-hc-text" : "text-[#CDBDFF]"
              }`}
              numberOfLines={1}
            >
              {suggestion.label}
            </Text>
            <Text
              className={`text-[12px] font-semibold ${secondaryColor}`}
              numberOfLines={2}
            >
              {suggestion.reason}
            </Text>
          </View>
          <Pressable
            className={`h-9 min-w-[76px] flex-row items-center justify-center gap-1 rounded-full px-3 ${
              highContrast ? "border border-hc-border bg-hc-bg" : "bg-[#7C4DFF]"
            }`}
            onPress={() => {
              speak(buildActionSpeech(suggestion.actionLabel));
              suggestionHandler?.(post);
            }}
            disabled={Boolean(suggestionBusy)}
            accessibilityRole="button"
            accessibilityLabel={suggestion.actionLabel}
            accessibilityHint={suggestion.actionHint}
            accessibilityState={{ busy: Boolean(suggestionBusy), disabled: Boolean(suggestionBusy) }}
          >
            {suggestionBusy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons
                  name={suggestion.action === "follow" ? "person-add-outline" : "enter-outline"}
                  size={15}
                  color="#FFFFFF"
                  importantForAccessibility="no"
                />
                <Text className="text-[13px] font-black text-white">{suggestion.actionLabel}</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}

      {showCommunity && post.community ? (
        <Pressable
          className="mb-4 flex-row items-center gap-3 rounded-2xl border border-[#3A3246] bg-[#17181C] px-3 py-2.5"
          onPress={() => {
            speak(buildActionSpeech("Abrir comunidade", post.community?.name ?? null));
            onOpenCommunity?.(post);
          }}
          disabled={!onOpenCommunity}
          accessibilityRole="button"
          accessibilityLabel={`Abrir comunidade ${post.community.name}`}
          accessibilityHint="Abre o feed completo desta comunidade"
        >
          <View className="h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#2A2A2A]">
            {communityIconUri ? (
              <AuthenticatedRemoteImage
                uri={communityIconUri}
                authToken={authToken}
                className="h-full w-full"
                resizeMode="cover"
                fallback={<Ionicons name="people-outline" size={16} color="#CDBDFF" />}
              />
            ) : (
              <Ionicons name="people-outline" size={16} color="#CDBDFF" />
            )}
          </View>
          <Text className="flex-1 text-[14px] font-black text-white" numberOfLines={1}>
            {post.community.name}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color="#948EA1"
            importantForAccessibility="no"
          />
        </Pressable>
      ) : null}

      <View className="flex-row items-center">
        {canOpenProfile ? (
          <Pressable
            onPress={() => {
              speak(buildActionSpeech("Abrir perfil de", authorName));
              onOpenProfile?.(post);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Abrir perfil de ${authorName}`}
            accessibilityHint="Abre o perfil público desta pessoa"
          >
            {avatar}
          </Pressable>
        ) : (
          <View importantForAccessibility="no-hide-descendants">{avatar}</View>
        )}

        <Pressable
          className="ml-3 flex-1"
          onPress={() => speak(buildFeedPostSpeech(post))}
          accessibilityRole="button"
          accessibilityLabel={`${summaryLabel}: ${post.body.slice(0, 120)}`}
          accessibilityHint="Lê a publicação em voz alta"
        >
          <Text className={`text-[17px] font-black ${textColor}`} numberOfLines={1}>
            {authorName}
          </Text>
          <Text className={`mt-0.5 text-[13px] font-semibold ${secondaryColor}`}>
            {formattedDate}
            {post.editedAt ? " · editada" : ""}
          </Text>
        </Pressable>

        {menuOptions.length > 0 ? (
          <Pressable
            className="ml-2 h-9 w-9 items-center justify-center rounded-full"
            onPress={() => {
              speak("Mais opções da publicação");
              setMenuVisible(true);
            }}
            disabled={deleting}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel="Mais opções da publicação"
            accessibilityHint={isOwnPost ? "Abre editar ou excluir" : "Abre a opção de denunciar"}
            accessibilityState={{ disabled: deleting, busy: deleting }}
          >
            {deleting ? (
              <ActivityIndicator color="#CAC3D8" size="small" />
            ) : (
              <Ionicons
                name="ellipsis-horizontal"
                size={20}
                color="#CAC3D8"
                importantForAccessibility="no"
              />
            )}
          </Pressable>
        ) : null}
      </View>

      {/* O cabecalho resume; aqui o leitor nativo recebe o texto completo. */}
      <Pressable
        onPress={() => speak(buildFeedPostSpeech(post))}
        accessibilityRole="text"
        accessibilityLabel={post.body}
      >
        <Text className={`mt-4 text-[15px] font-semibold leading-6 ${textColor}`}>
          {post.body}
        </Text>
      </Pressable>

      {mediaUri ? (
        <View className="mt-3 h-56 w-full overflow-hidden rounded-2xl bg-[#2A2A2A]">
          <AuthenticatedRemoteImage
            accessibilityLabel={`Imagem da publicação de ${authorName}`}
            authToken={authToken}
            className="h-full w-full"
            fallback={
              <View className="flex-1 items-center justify-center bg-[#2A2A2A]">
                <Ionicons name="image-outline" size={28} color="#948EA1" />
              </View>
            }
            resizeMode="cover"
            uri={mediaUri}
          />
        </View>
      ) : null}

      <View className="mt-4 h-px bg-[#353534]" />

      <View className="mt-1 flex-row items-center justify-between">
        <FeedCounterAction
          accessibilityLabel={`${
            post.likedByCurrentUser ? "Remover curtida" : "Curtir publicação"
          }. ${formatCount(post.likesCount, "curtida", "curtidas")}`}
          accessibilityHint={
            post.likedByCurrentUser
              ? "Retira a sua curtida desta publicação"
              : "Registra a sua curtida nesta publicação"
          }
          active={post.likedByCurrentUser}
          count={post.likesCount}
          icon={post.likedByCurrentUser ? "thumbs-up" : "thumbs-up-outline"}
          loading={likeBusy}
          onPress={() => {
            speak(buildActionSpeech(post.likedByCurrentUser ? "Remover curtida" : "Curtir"));
            onToggleLike(post);
          }}
        />
        <FeedCounterAction
          accessibilityLabel={`Abrir comentários. ${formatCount(
            post.commentsCount,
            "comentário",
            "comentários"
          )}`}
          accessibilityHint="Abre a tela de comentários desta publicação"
          active={post.commentedByCurrentUser}
          count={post.commentsCount}
          icon={post.commentedByCurrentUser ? "chatbubble" : "chatbubble-outline"}
          onPress={() => {
            speak(buildActionSpeech("Abrir comentários"));
            onOpenComments(post);
          }}
        />
      </View>

      <ActionSheet
        onClose={() => setMenuVisible(false)}
        options={menuOptions}
        title="Publicação"
        visible={menuVisible}
      />
    </View>
  );
});
