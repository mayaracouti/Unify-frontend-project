import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  buildActionSpeech,
  buildCommunityCommentSpeech,
  useTTS,
} from "../../src/accessibility/tts";
import {
  AuthenticatedRemoteImage,
  preloadAuthenticatedRemoteImages,
} from "../../src/components/profile/authenticated-remote-image";
import { useAuth } from "../../src/context/AuthContext";
import { useScreenHeadingFocus } from "../../src/hooks/use-screen-heading-focus";
import { communityService } from "../../src/services/communityService";
import type { CommunityCommentResponse } from "../../src/types/community";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../src/utils/auth";
import { showGlobalToast } from "../../src/utils/globalToast";
import { buildUserProfileHref } from "../../src/utils/userProfileRoute";

function getInitials(name?: string | null) {
  return (name ?? "")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((namePart) => namePart[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function normalizeRouteParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

/**
 * Avatar do comentario. Com `userProfileId` + `onOpenProfile` vira um botao
 * que abre o perfil publico da pessoa; sem eles e decorativo.
 */
function CommentAvatar({
  authToken,
  avatarData,
  name,
  userProfileId,
  onOpenProfile,
}: {
  authToken: string | null;
  avatarData?: string | null;
  name?: string | null;
  userProfileId?: string | null;
  onOpenProfile?: (userProfileId: string, name?: string | null) => void;
}) {
  const initials = getInitials(name);
  const avatarUrl = communityService.resolveAssetUrl(avatarData);
  const resolvedProfileId = userProfileId?.trim() || null;
  const canOpenProfile = Boolean(resolvedProfileId && onOpenProfile);

  const content = (
    <View
      className="h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[#494455] bg-[#353534]"
      importantForAccessibility={canOpenProfile ? "no-hide-descendants" : "auto"}
    >
      {avatarUrl ? (
        <AuthenticatedRemoteImage
          uri={avatarUrl}
          authToken={authToken}
          className="h-full w-full"
          resizeMode="cover"
          fallback={
            <LinearGradient
              colors={["#CDBDFF", "#7C4DFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="h-full w-full items-center justify-center"
            >
              <Text className="text-[14px] font-black text-white">{initials || "?"}</Text>
            </LinearGradient>
          }
        />
      ) : (
        <LinearGradient
          colors={["#CDBDFF", "#7C4DFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="h-full w-full items-center justify-center"
        >
          <Text className="text-[14px] font-black text-white">{initials || "?"}</Text>
        </LinearGradient>
      )}
    </View>
  );

  if (!canOpenProfile || !resolvedProfileId) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir perfil de ${name?.trim() || "pessoa sem nome"}`}
      accessibilityHint="Abre o perfil público desta pessoa"
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      onPress={() => onOpenProfile?.(resolvedProfileId, name)}
    >
      {content}
    </Pressable>
  );
}

function CommentCard({
  authToken,
  canDelete,
  comment,
  deleting,
  onDelete,
  onOpenProfile,
}: {
  authToken: string | null;
  canDelete: boolean;
  comment: CommunityCommentResponse;
  deleting: boolean;
  onDelete: () => void;
  onOpenProfile: (userProfileId: string, name?: string | null) => void;
}) {
  const { speak } = useTTS();
  const truncatedBody =
    comment.body.length > 120 ? `${comment.body.slice(0, 120)}…` : comment.body;

  // O avatar e um botao irmao (abre o perfil); a area de texto e a dona da
  // fala do comentario. Sem Pressable aninhado.
  return (
    <View className="rounded-2xl border border-[#353534] bg-[#17181C] p-4">
      <View className="flex-row items-start gap-3">
        <CommentAvatar
          authToken={authToken}
          avatarData={comment.author.avatarData}
          name={comment.author.name}
          userProfileId={comment.author.userProfileId}
          onOpenProfile={onOpenProfile}
        />

        <Pressable
          className="flex-1"
          // Toque no comentario le autor e corpo reais vindos do backend.
          onPress={() => speak(buildCommunityCommentSpeech(comment))}
          accessibilityRole="button"
          accessibilityLabel={`Comentário de ${comment.author.name}: ${truncatedBody}`}
          accessibilityHint="Lê o comentário em voz alta"
        >
          <View className="flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-[16px] font-black text-white">
              {comment.author.name}
            </Text>
            <View className="flex-row items-center gap-3">
              {comment.publishedAt ? (
                <Text className="text-[12px] font-semibold text-[#CAC3D8]">
                  {comment.publishedAt}
                </Text>
              ) : null}
              {canDelete ? (
                <Pressable
                  className="h-9 w-9 items-center justify-center rounded-full bg-[#221820]"
                  onPress={onDelete}
                  disabled={deleting}
                  accessibilityRole="button"
                  accessibilityLabel={`Excluir comentário de ${comment.author.name}`}
                  accessibilityHint="Remove este comentário da conversa"
                  accessibilityState={{ disabled: deleting, busy: deleting }}
                >
                  {deleting ? (
                    <ActivityIndicator color="#FFD3DD" size="small" />
                  ) : (
                    <Ionicons name="trash-outline" size={16} color="#FFD3DD" />
                  )}
                </Pressable>
              ) : null}
            </View>
          </View>

          <Text className="mt-3 text-[15px] font-semibold leading-7 text-[#E5E2E1]">
            {comment.body}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function CommunityCommentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    communityId?: string | string[];
    communityName?: string | string[];
    postId?: string | string[];
    authorName?: string | string[];
    postBody?: string | string[];
    publishedAt?: string | string[];
    isMember?: string | string[];
    canModerate?: string | string[];
  }>();
  const { session } = useAuth();
  const { speak } = useTTS();

  // Ao entrar na tela, o leitor de tela do sistema comeca pelo titulo.
  const headingRef = useScreenHeadingFocus<Text>();

  const authToken = session?.accessToken ?? null;
  const communityId = useMemo(
    () => normalizeRouteParam(params.communityId).trim(),
    [params.communityId]
  );
  const communityName = useMemo(
    () => normalizeRouteParam(params.communityName).trim(),
    [params.communityName]
  );
  const postId = useMemo(() => normalizeRouteParam(params.postId).trim(), [params.postId]);
  const authorName = useMemo(
    () => normalizeRouteParam(params.authorName).trim() || "Autor da publicação",
    [params.authorName]
  );
  const postBody = useMemo(() => normalizeRouteParam(params.postBody), [params.postBody]);
  const publishedAt = useMemo(
    () => normalizeRouteParam(params.publishedAt).trim(),
    [params.publishedAt]
  );
  const isMember = useMemo(
    () => normalizeRouteParam(params.isMember).toLowerCase() === "true",
    [params.isMember]
  );
  const canModerate = useMemo(
    () => normalizeRouteParam(params.canModerate).toLowerCase() === "true",
    [params.canModerate]
  );

  const [comments, setComments] = useState<CommunityCommentResponse[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);

  const loadComments = useCallback(
    async (options?: { showLoader?: boolean }) => {
      if (options?.showLoader) {
        setLoading(true);
      }

      if (!postId) {
        setLoadError("Não foi possível identificar a publicação selecionada.");
        setComments([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        setLoadError(null);

        // TODO: paginação incremental — hoje sempre carregamos a primeira página
        // (size padrão do backend) dos comentários da publicação.
        const response = await communityService.getComments(postId);
        const nextComments = Array.isArray(response.content) ? response.content : [];
        setComments(nextComments);

        const avatarUrls = nextComments
          .map((comment) => communityService.resolveAssetUrl(comment.author.avatarData))
          .filter((value): value is string => typeof value === "string" && value.length > 0);

        if (avatarUrls.length > 0) {
          void preloadAuthenticatedRemoteImages(avatarUrls, authToken);
        }
      } catch (error) {
        setLoadError(
          formatApiErrorMessage(error, "Não foi possível carregar os comentários.")
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authToken, postId]
  );

  useEffect(() => {
    void loadComments({ showLoader: true });
  }, [loadComments]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadComments();
  }, [loadComments]);

  const handleSubmitComment = useCallback(async () => {
    if (submitting || !postId) {
      return;
    }

    const trimmedDraft = draft.trim();

    if (trimmedDraft.length === 0) {
      showGlobalToast({
        title: "Comentário vazio",
        variant: "warning",
        message: "Escreva algo antes de enviar.",
      });
      return;
    }

    if (!isMember) {
      showGlobalToast({
        title: "Participação necessária",
        variant: "warning",
        message: "Entre na comunidade para comentar publicações.",
      });
      return;
    }

    setSubmitting(true);

    try {
      const createdComment = await communityService.createComment(postId, {
        body: trimmedDraft,
      });

      setComments((currentComments) => [...currentComments, createdComment]);
      setDraft("");
      showGlobalToast({
        title: "Comentário publicado",
        variant: "success",
        message: "Seu comentário já apareceu na conversa.",
      });
      announceForAccessibility(accessibilityAnnouncements.commentPublished());
    } catch {
      // Global API error toast already explains the failure.
    } finally {
      setSubmitting(false);
    }
  }, [draft, isMember, postId, submitting]);

  const canDeleteComment = useCallback(
    (comment: CommunityCommentResponse) => {
      return Boolean(comment.commentedByCurrentUser || canModerate);
    },
    [canModerate]
  );

  const confirmDeleteComment = useCallback(
    async (comment: CommunityCommentResponse) => {
      if (!postId || pendingDeleteCommentId) {
        return;
      }

      setPendingDeleteCommentId(comment.id);

      try {
        await communityService.deleteComment(postId, comment.id);
        setComments((currentComments) =>
          currentComments.filter((currentComment) => currentComment.id !== comment.id)
        );
        showGlobalToast({
          title: "Comentário removido",
          variant: "success",
          message: "O comentário foi removido desta conversa.",
        });
        announceForAccessibility(accessibilityAnnouncements.commentDeleted());
      } catch {
        // Global API error toast already explains the failure.
      } finally {
        setPendingDeleteCommentId(null);
      }
    },
    [pendingDeleteCommentId, postId]
  );

  const handleOpenProfile = useCallback(
    (userProfileId: string, name?: string | null) => {
      speak(buildActionSpeech("Abrir perfil de", name?.trim() || null));
      router.push(buildUserProfileHref(userProfileId, name));
    },
    [router, speak]
  );

  const handleDeleteComment = useCallback(
    (comment: CommunityCommentResponse) => {
      speak(buildActionSpeech("Excluir comentário de", comment.author.name));
      Alert.alert(
        "Excluir comentário",
        "Essa ação remove o comentário da conversa. Deseja continuar?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Excluir",
            style: "destructive",
            onPress: () => {
              void confirmDeleteComment(comment);
            },
          },
        ]
      );
    },
    [confirmDeleteComment, speak]
  );

  return (
    <View className="flex-1 bg-[#0B0B0C]">
      <SafeAreaView className="flex-1 bg-[#0B0B0C]">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View className="h-16 flex-row items-center justify-between border-b border-[#2A2A2A] px-6">
            <View className="flex-row items-center">
              <Pressable
                className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                accessibilityRole="button"
                accessibilityLabel="Voltar para a comunidade"
                accessibilityHint="Volta para a comunidade sem salvar o comentário em edição"
                onPress={() => {
                  speak("Voltar para a comunidade");

                  if (communityId) {
                    router.replace({
                      pathname: "/community/[communityId]",
                      params: { communityId },
                    });
                    return;
                  }

                  router.back();
                }}
              >
                <Ionicons name="arrow-back" size={24} color="#E5E2E1" />
              </Pressable>
              <Text className="text-2xl font-black text-[#7C4DFF]">Unify</Text>
            </View>

            <Text
              ref={headingRef}
              accessibilityRole="header"
              className="text-[14px] font-bold text-[#CAC3D8]"
            >
              Comentários
            </Text>
          </View>

          {loading && comments.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#7C4DFF" size="large" />
            </View>
          ) : (
            <>
              <ScrollView
                className="flex-1"
                contentContainerClassName="mx-auto w-full max-w-[720px] px-6 pb-8 pt-8"
                keyboardShouldPersistTaps="handled"
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    tintColor="#7C4DFF"
                    onRefresh={handleRefresh}
                  />
                }
                showsVerticalScrollIndicator={false}
              >
                <Pressable
                  className="rounded-[28px] bg-[#111214] p-6"
                  // Toque relê a publicacao original (dados de runtime).
                  onPress={() =>
                    speak(
                      buildActionSpeech(`Publicação de ${authorName}.`, postBody)
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Publicação de ${authorName}`}
                  accessibilityHint="Lê a publicação original em voz alta"
                >
                  <Text className="text-[14px] font-bold uppercase tracking-[1.4px] text-[#7C4DFF]">
                    Publicação original
                  </Text>
                  {communityName ? (
                    <Text className="mt-3 text-[13px] font-semibold uppercase tracking-[1.2px] text-[#CAC3D8]">
                      {communityName}
                    </Text>
                  ) : null}
                  <Text className="mt-4 text-[22px] font-black text-white">{authorName}</Text>
                  {publishedAt ? (
                    <Text className="mt-1 text-[13px] font-semibold text-[#CAC3D8]">
                      {publishedAt}
                    </Text>
                  ) : null}
                  {postBody ? (
                    <Text className="mt-4 text-[16px] font-semibold leading-7 text-[#E5E2E1]">
                      {postBody}
                    </Text>
                  ) : null}
                </Pressable>

                {loadError ? (
                  <View className="mt-6 rounded-2xl border border-[#6A4456] bg-[#2A1C24] px-4 py-4">
                    <Text className="text-[15px] font-bold text-[#FFD3DD]">Falha ao atualizar</Text>
                    <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#FFEAF0]">
                      {loadError}
                    </Text>
                  </View>
                ) : null}

                <View className="mt-6 gap-4">
                  {comments.length > 0 ? (
                    comments.map((comment) => (
                      <CommentCard
                        key={comment.id}
                        authToken={authToken}
                        canDelete={canDeleteComment(comment)}
                        comment={comment}
                        deleting={pendingDeleteCommentId === comment.id}
                        onDelete={() => handleDeleteComment(comment)}
                        onOpenProfile={handleOpenProfile}
                      />
                    ))
                  ) : (
                    <View className="rounded-2xl border border-[#353534] bg-[#17181C] px-5 py-8">
                      <Text className="text-[20px] font-black text-white">
                        Ainda sem comentários
                      </Text>
                      <Text className="mt-3 text-[14px] font-semibold leading-6 text-[#CAC3D8]">
                        {isMember
                          ? "Seja a primeira pessoa a responder essa publicação."
                          : "Entre na comunidade para participar da conversa desta publicação."}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>

              <View className="border-t border-[#2A2A2A] bg-[#111214] px-6 py-5">
                {isMember ? (
                  <>
                    <TextInput
                      className="min-h-[108px] rounded-2xl border border-[#494455] bg-[#1C1B1B] px-4 py-4 text-[15px] leading-6 text-white"
                      multiline
                      maxLength={400}
                      placeholder="Escreva um comentário..."
                      placeholderTextColor="#948EA1"
                      textAlignVertical="top"
                      value={draft}
                      onChangeText={setDraft}
                      onFocus={() => speak("Escreva um comentário")}
                      accessibilityLabel="Escreva um comentário"
                      accessibilityHint="Obrigatório para publicar"
                    />
                    <View className="mt-4 flex-row items-center justify-between">
                      <Text className="text-[12px] font-semibold text-[#948EA1]">
                        {draft.length} / 400
                      </Text>
                      <Pressable
                        className={`rounded-full px-5 py-3 ${
                          draft.trim().length > 0 && !submitting
                            ? "bg-[#EAEA00]"
                            : "bg-[#3B3841]"
                        }`}
                        onPress={() => {
                          speak("Enviar comentário");
                          void handleSubmitComment();
                        }}
                        disabled={draft.trim().length === 0 || submitting}
                        accessibilityRole="button"
                        accessibilityLabel="Enviar comentário"
                        accessibilityHint="Publica o comentário abaixo da publicação original."
                        accessibilityState={{
                          disabled: draft.trim().length === 0 || submitting,
                          busy: submitting,
                        }}
                      >
                        {submitting ? (
                          <ActivityIndicator color="#1D1D00" size="small" />
                        ) : (
                          <Text className="text-[14px] font-black text-[#1D1D00]">
                            Enviar comentário
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <View className="rounded-2xl border border-[#494455] bg-[#1A1C1F] px-4 py-4">
                    <Text className="text-[15px] font-bold text-white">
                      Somente membros podem comentar.
                    </Text>
                    <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#CAC3D8]">
                      Volte para a comunidade e use o botão de participação para entrar antes de responder este post.
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}