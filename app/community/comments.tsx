import { ReportModal } from "../../src/components/report/report-modal";
import { useIsFocused } from "expo-router/react-navigation";
import { useCommunityPost } from "../../src/hooks/use-community-post";
import { useCommunityPage } from "../../src/hooks/use-community-page";
import { CommunityLoadMore } from "../../src/components/community/load-more";
import { ScreenError } from "../../src/components/ui/screen-error";
import { useAppShell } from "../../src/context/AppShellContext";
import { canParticipate, canModerate as canModerateCommunity, isCommunityAuthor } from "../../src/utils/communityPermissions";
import { confirmCommunityAction } from "../../src/utils/confirmCommunityAction";
import { goBackOrReplace } from "../../src/utils/navigation";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  onEdit,
  onReport,
  onOpenProfile,
}: {
  authToken: string | null;
  canDelete: boolean;
  comment: CommunityCommentResponse;
  deleting: boolean;
  onDelete: () => void;
  onEdit?: () => void;
  onReport?: () => void;
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
                  {comment.publishedAt}{comment.editedAt ? " · editado" : ""}
                </Text>
              ) : null}
              {onReport ? <Pressable onPress={(event) => { event.stopPropagation(); onReport(); }} accessibilityRole="button"
                accessibilityLabel="Denunciar comentário" accessibilityHint="Abre o formulário de denúncia"
                className="h-10 w-10 items-center justify-center">
                <Ionicons name="flag-outline" size={18} color="#CDBDFF" />
              </Pressable> : null}
              {onEdit ? (
                <Pressable onPress={(event) => { event.stopPropagation(); onEdit(); }} disabled={deleting} accessibilityRole="button"
                  accessibilityLabel="Editar comentário" accessibilityHint="Abre seu comentário para alterar o texto"
                  className="h-10 w-10 items-center justify-center">
                  <Ionicons name="pencil-outline" size={18} color="#CDBDFF" />
                </Pressable>
              ) : null}
              {canDelete ? (
                <Pressable
                  className="h-9 w-9 items-center justify-center rounded-full bg-[#221820]"
                  onPress={(event) => { event.stopPropagation(); onDelete(); }}
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

const commentKey = (comment: CommunityCommentResponse) => comment.id;

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
  const { currentUserId, currentUserProfileId } = useAppShell();
  const isFocused = useIsFocused();
  const submitLock = useRef(false);
  const { speak } = useTTS();

  // Ao entrar na tela, o leitor de tela do sistema comeca pelo titulo.
  const headingRef = useScreenHeadingFocus<Text>();

  const authToken = session?.accessToken ?? null;
  const postId = useMemo(() => normalizeRouteParam(params.postId).trim(), [params.postId]);
  const access = useCommunityPost(postId);
  const reloadAccess = access.reload;
  const communityId = access.community?.id ?? normalizeRouteParam(params.communityId).trim();
  const communityName = access.community?.name ?? "";
  const authorName = access.data?.post.author.name ?? "Autor da publicação";
  const postBody = access.data?.post.body ?? "";
  const publishedAt = access.data?.post.publishedAt ?? "";
  const isMember = canParticipate(access.community);
  const canModerate = canModerateCommunity(access.community);
  const fetchComments = useCallback((page: number) => {
    if (!postId) return Promise.reject(new Error("Não foi possível identificar a publicação."));
    return communityService.getComments(postId, { page, size: 20 });
  }, [postId]);
  const list = useCommunityPage(fetchComments, commentKey);
  const { items: comments, setItems: setComments, loading, error: loadError, refresh: reloadComments } = list;
  const [draft, setDraft] = useState("");
  const [reportTarget, setReportTarget] = useState<CommunityCommentResponse | null>(null);
  const [editingComment, setEditingComment] = useState<CommunityCommentResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);
  const deleteLock = useRef(false);
  useEffect(() => {
    if (isFocused) void reloadComments();
  }, [isFocused, reloadComments]);
  useEffect(() => {
    setDraft("");
    setEditingComment(null);
  }, [postId]);
  useEffect(() => {
    const urls = comments.map((comment) => communityService.resolveAssetUrl(comment.author.avatarData))
      .filter((url): url is string => Boolean(url));
    if (urls.length) void preloadAuthenticatedRemoteImages(urls, authToken);
  }, [comments, authToken]);
  const handleRefresh = useCallback(() => {
    void reloadAccess();
    void reloadComments();
  }, [reloadAccess, reloadComments]);
  const refreshing = loading && comments.length > 0;
  const ownsComment = useCallback((comment: CommunityCommentResponse) =>
    isCommunityAuthor(comment.author, currentUserId, currentUserProfileId) || comment.commentedByCurrentUser === true,
    [currentUserId, currentUserProfileId]);

  const handleSubmitComment = useCallback(async () => {
    if (submitLock.current || !postId) {
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

    submitLock.current = true;
    setSubmitting(true);

    try {
      const createdComment = editingComment
        ? await communityService.updateComment(postId, editingComment.id, { body: trimmedDraft })
        : await communityService.createComment(postId, { body: trimmedDraft });

      setComments((current) => editingComment
        ? current.map((comment) => comment.id === createdComment.id ? createdComment : comment)
        : [createdComment, ...current.filter((comment) => comment.id !== createdComment.id)]);
      setEditingComment(null);
      // Reset the offset after insertion so the next page cannot skip comments.
      void reloadComments();
      setDraft("");
      showGlobalToast({
        title: editingComment ? "Comentário atualizado" : "Comentário publicado",
        variant: "success",
        message: "Seu comentário já apareceu na conversa.",
      });
      announceForAccessibility(accessibilityAnnouncements.commentPublished());
    } catch {
      // Global API error toast already explains the failure.
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }, [draft, editingComment, isMember, postId, reloadComments, setComments]);

  const canDeleteComment = useCallback(
    (comment: CommunityCommentResponse) => {
      return Boolean(ownsComment(comment) || canModerate);
    },
    [canModerate, ownsComment]
  );

  const confirmDeleteComment = useCallback(
    async (comment: CommunityCommentResponse) => {
      if (!postId || deleteLock.current || !canDeleteComment(comment)) {
        return;
      }

      deleteLock.current = true;
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
        if (editingComment?.id === comment.id) { setEditingComment(null); setDraft(""); }
        void reloadComments();
        announceForAccessibility(accessibilityAnnouncements.commentDeleted());
      } catch {
        // Global API error toast already explains the failure.
      } finally {
        deleteLock.current = false;
        setPendingDeleteCommentId(null);
      }
    },
    [canDeleteComment, editingComment?.id, postId, reloadComments, setComments]
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
      confirmCommunityAction("Excluir comentário", "Essa ação remove o comentário da conversa. Deseja continuar?", "Excluir", () => { void confirmDeleteComment(comment); });
    },
    [confirmDeleteComment, speak]
  );

  if (access.loading) return <View className="flex-1 items-center justify-center bg-[#0B0B0C]"><ActivityIndicator color="#7C4DFF" /></View>;
  if (access.error || !access.data) return <View className="flex-1 bg-[#0B0B0C] p-6">
    <ScreenError message={access.error || "Publicação não encontrada."} onRetry={() => void access.reload()} />
    <Pressable accessibilityRole="button" accessibilityLabel="Voltar para comunidades" onPress={() => goBackOrReplace(router, "/community")}>
      <Text className="py-5 text-center font-bold text-white">Voltar</Text>
    </Pressable>
  </View>;

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

                  goBackOrReplace(router, "/community");
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

                {access.error ? <ScreenError message={access.error} onRetry={() => void access.reload()} /> : null}
                {loadError ? (
                  <View className="mt-6 rounded-2xl border border-[#6A4456] bg-[#2A1C24] px-4 py-4">
                    <Text className="text-[15px] font-bold text-[#FFD3DD]">Falha ao atualizar</Text>
                    <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#FFEAF0]">
                      {loadError}
                    </Text>
                    <CommunityLoadMore visible busy={loading} onPress={() => void reloadComments()} label="Tentar novamente" />
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
                        onReport={!ownsComment(comment) && comment.author.id ? () => setReportTarget(comment) : undefined}
                        onDelete={() => handleDeleteComment(comment)}
                        onEdit={isMember && ownsComment(comment) && !submitting ? () => {
                          setEditingComment(comment); setDraft(comment.body);
                        } : undefined}
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
                <CommunityLoadMore visible={list.hasNext} busy={loading || list.loadingMore}
                  onPress={() => void list.loadMore()} label="Carregar mais comentários" />
              </ScrollView>

              <View className="border-t border-[#2A2A2A] bg-[#111214] px-6 py-5">
                {isMember ? (
                  <>
                    {editingComment ? <View className="mb-3 flex-row justify-between">
                      <Text className="font-bold text-white">Editando comentário</Text>
                      <Pressable disabled={submitting} accessibilityRole="button" accessibilityLabel="Cancelar edição"
                        onPress={() => { setEditingComment(null); setDraft(""); }}>
                        <Text className="text-[#CDBDFF]">Cancelar</Text>
                      </Pressable>
                    </View> : null}
                    <TextInput
                      className="min-h-[108px] rounded-2xl border border-[#494455] bg-[#1C1B1B] px-4 py-4 text-[15px] leading-6 text-white"
                      multiline
                      maxLength={400}
                      placeholder="Escreva um comentário..."
                      placeholderTextColor="#948EA1"
                      textAlignVertical="top"
                      editable={!submitting}
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
                            {editingComment ? "Salvar comentário" : "Enviar comentário"}
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
      {reportTarget?.author.id ? <ReportModal visible onClose={() => setReportTarget(null)}
        reportedUserId={reportTarget.author.id} reportedPostId={postId} reportedCommentId={reportTarget.id}
        contextLabel={`comentário de ${reportTarget.author.name}`} /> : null}
    </View>
  );
}