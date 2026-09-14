import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  buildActionSpeech,
  buildUserPostCommentSpeech,
  useTTS,
} from "../../src/accessibility/tts";
import { AuthenticatedRemoteImage } from "../../src/components/profile/authenticated-remote-image";
import { ActionSheet } from "../../src/components/ui/action-sheet";
import { useAppShell } from "../../src/context/AppShellContext";
import { useAuth } from "../../src/context/AuthContext";
import { useScreenHeadingFocus } from "../../src/hooks/use-screen-heading-focus";
import { feedService } from "../../src/services/feedService";
import type { UserPostCommentResponse } from "../../src/types/social";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../src/utils/auth";
import { showGlobalToast } from "../../src/utils/globalToast";
import { formatRelativePostDate, getNameInitial } from "../../src/utils/postFormatting";
import { buildUserProfileHref } from "../../src/utils/userProfileRoute";

const PAGE_SIZE = 20;
const COMMENT_MAX_LENGTH = 400;

function normalizeParam(value?: string | string[]) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function CommentAvatar({
  authToken,
  avatarUrl,
  name,
  onOpenProfile,
}: {
  authToken: string | null;
  avatarUrl: string | null;
  name: string;
  onOpenProfile?: () => void;
}) {
  const uri = feedService.resolveAssetUrl(avatarUrl);
  const fallback = (
    <LinearGradient
      colors={["#CDBDFF", "#7C4DFF"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="h-full w-full items-center justify-center"
    >
      <Text className="text-[14px] font-black text-white">{getNameInitial(name)}</Text>
    </LinearGradient>
  );
  const avatar = (
    <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[#494455] bg-[#353534]">
      {uri ? (
        <AuthenticatedRemoteImage
          uri={uri}
          authToken={authToken}
          className="h-full w-full"
          resizeMode="cover"
          fallback={fallback}
        />
      ) : (
        fallback
      )}
    </View>
  );

  if (!onOpenProfile) {
    return <View importantForAccessibility="no-hide-descendants">{avatar}</View>;
  }

  return (
    <Pressable
      onPress={onOpenProfile}
      accessibilityRole="button"
      accessibilityLabel={`Abrir perfil de ${name}`}
      accessibilityHint="Abre o perfil público desta pessoa"
    >
      {avatar}
    </Pressable>
  );
}

/**
 * Comentarios de uma publicacao PESSOAL (`/users/posts/{id}/comments`).
 * Comentarios de posts de comunidade continuam em `app/community/comments.tsx`.
 */
export default function PersonalPostCommentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    postId?: string | string[];
    authorName?: string | string[];
    authorUserProfileId?: string | string[];
    postBody?: string | string[];
    createdAt?: string | string[];
  }>();
  const headingRef = useScreenHeadingFocus<Text>();
  const { speak } = useTTS();
  const { session } = useAuth();
  const { currentUserProfileId } = useAppShell();
  const authToken = session?.accessToken ?? null;

  const postId = useMemo(() => normalizeParam(params.postId).trim(), [params.postId]);
  const authorName = useMemo(
    () => normalizeParam(params.authorName).trim() || "Autor da publicação",
    [params.authorName]
  );
  const authorUserProfileId = useMemo(
    () => normalizeParam(params.authorUserProfileId).trim(),
    [params.authorUserProfileId]
  );
  const postBody = useMemo(() => normalizeParam(params.postBody), [params.postBody]);
  const createdAt = useMemo(() => normalizeParam(params.createdAt).trim(), [params.createdAt]);
  const publishedAt = useMemo(
    () => (createdAt ? formatRelativePostDate(createdAt) : ""),
    [createdAt]
  );
  const isPostAuthor =
    Boolean(authorUserProfileId) && authorUserProfileId === currentUserProfileId;

  const [comments, setComments] = useState<UserPostCommentResponse[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserPostCommentResponse | null>(null);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);

  const loadComments = useCallback(
    async (options?: { append?: boolean; showLoader?: boolean }) => {
      if (!postId) {
        setLoadError("Não foi possível identificar a publicação selecionada.");
        setComments([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (options?.showLoader) {
        setLoading(true);
      }

      if (options?.append) {
        setLoadingMore(true);
      }

      try {
        setLoadError(null);
        const nextPage = options?.append ? page + 1 : 0;
        const response = await feedService.getComments(postId, {
          page: nextPage,
          size: PAGE_SIZE,
        });

        setPage(response.page);
        setHasNext(response.hasNext);
        setComments((current) => {
          if (!options?.append) {
            return response.comments;
          }

          const knownIds = new Set(current.map((comment) => comment.id));
          const appended = response.comments.filter((comment) => !knownIds.has(comment.id));

          if (appended.length > 0) {
            announceForAccessibility(
              accessibilityAnnouncements.moreItemsLoaded(appended.length, "comentários")
            );
          }

          return [...current, ...appended];
        });
      } catch (error) {
        setLoadError(formatApiErrorMessage(error, "Não foi possível carregar os comentários."));
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [page, postId]
  );

  useEffect(() => {
    void loadComments({ showLoader: true });
    // Uma carga por publicacao: depender de `loadComments` recarregaria a cada pagina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

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

    setSubmitting(true);

    try {
      const created = await feedService.createComment(postId, trimmedDraft);
      setComments((current) => [...current, created]);
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
  }, [draft, postId, submitting]);

  const confirmDeleteComment = useCallback(async () => {
    const target = deleteTarget;
    setDeleteTarget(null);

    if (!postId || !target || pendingDeleteCommentId) {
      return;
    }

    setPendingDeleteCommentId(target.id);

    try {
      await feedService.deleteComment(postId, target.id);
      setComments((current) => current.filter((comment) => comment.id !== target.id));
      announceForAccessibility(accessibilityAnnouncements.commentDeleted());
    } catch {
      // Global API error toast already explains the failure.
    } finally {
      setPendingDeleteCommentId(null);
    }
  }, [deleteTarget, pendingDeleteCommentId, postId]);

  const openProfile = useCallback(
    (userProfileId: string | null, name: string) => {
      if (!userProfileId || userProfileId === currentUserProfileId) {
        return;
      }

      speak(buildActionSpeech("Abrir perfil de", name));
      router.push(buildUserProfileHref(userProfileId, name));
    },
    [currentUserProfileId, router, speak]
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
                accessibilityLabel="Voltar"
                accessibilityHint="Volta para a tela anterior sem salvar o comentário em edição"
                onPress={() => {
                  speak("Voltar");
                  if (router.canGoBack()) {
                    router.back();
                    return;
                  }
                  router.replace("/home");
                }}
              >
                <Ionicons name="arrow-back" size={24} color="#E5E2E1" importantForAccessibility="no" />
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
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Carregando comentários"
              accessibilityState={{ busy: true }}
              className="flex-1 items-center justify-center"
            >
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
                    onRefresh={() => {
                      setRefreshing(true);
                      void loadComments();
                    }}
                  />
                }
                showsVerticalScrollIndicator={false}
              >
                <Pressable
                  className="rounded-[28px] bg-[#111214] p-6"
                  onPress={() => speak(buildActionSpeech(`Publicação de ${authorName}.`, postBody))}
                  accessibilityRole="button"
                  accessibilityLabel={`Publicação de ${authorName}${
                    publishedAt ? `, ${publishedAt}` : ""
                  }: ${postBody.slice(0, 200)}`}
                  accessibilityHint="Lê a publicação original em voz alta"
                >
                  <Text className="text-[14px] font-bold uppercase tracking-[1.4px] text-[#7C4DFF]">
                    Publicação original
                  </Text>
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
                  <View
                    accessibilityRole="alert"
                    className="mt-6 rounded-2xl border border-[#6A4456] bg-[#2A1C24] px-4 py-4"
                  >
                    <Text className="text-[15px] font-bold text-[#FFD3DD]">Falha ao atualizar</Text>
                    <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#FFEAF0]">
                      {loadError}
                    </Text>
                  </View>
                ) : null}

                <View className="mt-6 gap-4">
                  {comments.length > 0 ? (
                    comments.map((comment) => {
                      const commentAuthorName = comment.author.name?.trim() || "Pessoa sem nome";
                      const canDelete = comment.commentedByCurrentUser || isPostAuthor;
                      const deleting = pendingDeleteCommentId === comment.id;
                      const truncatedBody =
                        comment.body.length > 120
                          ? `${comment.body.slice(0, 120)}…`
                          : comment.body;

                      return (
                        <View
                          key={comment.id}
                          className="flex-row items-start gap-3 rounded-2xl border border-[#353534] bg-[#17181C] p-4"
                        >
                          <CommentAvatar
                            authToken={authToken}
                            avatarUrl={comment.author.avatarUrl}
                            name={commentAuthorName}
                            onOpenProfile={
                              comment.author.userProfileId &&
                              comment.author.userProfileId !== currentUserProfileId
                                ? () => openProfile(comment.author.userProfileId, commentAuthorName)
                                : undefined
                            }
                          />

                          <Pressable
                            className="flex-1"
                            onPress={() => speak(buildUserPostCommentSpeech(comment))}
                            accessibilityRole="button"
                            accessibilityLabel={`Comentário de ${commentAuthorName}, ${formatRelativePostDate(
                              comment.createdAt
                            )}: ${truncatedBody}`}
                            accessibilityHint="Lê o comentário em voz alta"
                          >
                            <View className="flex-row items-center justify-between gap-3">
                              <Text className="flex-1 text-[16px] font-black text-white">
                                {commentAuthorName}
                              </Text>
                              <Text className="text-[12px] font-semibold text-[#CAC3D8]">
                                {formatRelativePostDate(comment.createdAt)}
                              </Text>
                            </View>
                            <Text className="mt-3 text-[15px] font-semibold leading-7 text-[#E5E2E1]">
                              {comment.body}
                            </Text>
                          </Pressable>

                          {canDelete ? (
                            <Pressable
                              className="h-9 w-9 items-center justify-center rounded-full"
                              onPress={() => {
                                speak(buildActionSpeech("Excluir comentário de", commentAuthorName));
                                setDeleteTarget(comment);
                              }}
                              disabled={deleting}
                              accessibilityRole="button"
                              accessibilityLabel={`Excluir comentário de ${commentAuthorName}`}
                              accessibilityHint="Pede confirmação antes de excluir"
                              accessibilityState={{ disabled: deleting, busy: deleting }}
                            >
                              {deleting ? (
                                <ActivityIndicator color="#CAC3D8" size="small" />
                              ) : (
                                <Ionicons
                                  name="ellipsis-horizontal"
                                  size={18}
                                  color="#CAC3D8"
                                  importantForAccessibility="no"
                                />
                              )}
                            </Pressable>
                          ) : null}
                        </View>
                      );
                    })
                  ) : (
                    <View
                      accessible
                      accessibilityRole="text"
                      accessibilityLabel="Ainda sem comentários. Seja a primeira pessoa a responder essa publicação."
                      className="rounded-2xl border border-[#353534] bg-[#17181C] px-5 py-8"
                    >
                      <Text className="text-[20px] font-black text-white">Ainda sem comentários</Text>
                      <Text className="mt-3 text-[14px] font-semibold leading-6 text-[#CAC3D8]">
                        Seja a primeira pessoa a responder essa publicação.
                      </Text>
                    </View>
                  )}

                  {hasNext ? (
                    <Pressable
                      className="items-center rounded-full border border-[#494455] bg-[#1A1C1F] px-5 py-3"
                      onPress={() => {
                        speak("Carregar mais comentários");
                        void loadComments({ append: true });
                      }}
                      disabled={loadingMore}
                      accessibilityRole="button"
                      accessibilityLabel="Carregar mais comentários"
                      accessibilityState={{ busy: loadingMore, disabled: loadingMore }}
                    >
                      {loadingMore ? (
                        <ActivityIndicator color="#EAEA00" size="small" />
                      ) : (
                        <Text className="text-[14px] font-black text-white">
                          Carregar mais comentários
                        </Text>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              </ScrollView>

              <View className="border-t border-[#2A2A2A] bg-[#111214] px-6 py-5">
                <TextInput
                  className="min-h-[108px] rounded-2xl border border-[#494455] bg-[#1C1B1B] px-4 py-4 text-[15px] leading-6 text-white"
                  multiline
                  maxLength={COMMENT_MAX_LENGTH}
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
                    {draft.length} / {COMMENT_MAX_LENGTH}
                  </Text>
                  <Pressable
                    className={`rounded-full px-5 py-3 ${
                      draft.trim().length > 0 && !submitting ? "bg-[#EAEA00]" : "bg-[#3B3841]"
                    }`}
                    onPress={() => {
                      speak("Enviar comentário");
                      void handleSubmitComment();
                    }}
                    disabled={draft.trim().length === 0 || submitting}
                    accessibilityRole="button"
                    accessibilityLabel="Enviar comentário"
                    accessibilityHint="Publica o comentário abaixo da publicação original"
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
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      <ActionSheet
        message="O comentário sai da conversa. Não dá para desfazer."
        onClose={() => setDeleteTarget(null)}
        options={[
          {
            key: "confirm-delete",
            label: "Excluir comentário",
            hint: "Exclui o comentário de forma permanente",
            icon: "trash-outline",
            destructive: true,
            onPress: () => {
              void confirmDeleteComment();
            },
          },
        ]}
        title="Excluir comentário?"
        visible={Boolean(deleteTarget)}
      />
    </View>
  );
}
