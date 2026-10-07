import { PostContent } from "../../src/components/community/post/post-content";
import { useCommunityPostReader } from "../../src/hooks/use-community-post-reader";
import * as ImagePicker from "expo-image-picker";
import { useCommunityCommentEditor } from "../../src/hooks/use-community-comment-editor";
import { PostImage } from "../../src/components/community/post/post-image";
import { ActionSheet } from "../../src/components/ui/action-sheet";
import { splitPostSpeech } from "../../src/utils/personalPostContent";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { CommunityCommentResponse, CommunityPostResponse } from "../../src/types/community";
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
  postId,
  authToken,
  canDelete,
  comment,
  deleting,
  onDelete,
  onOpenProfile,
}: {
  postId: string;
  authToken: string | null;
  canDelete: boolean;
  comment: CommunityCommentResponse;
  deleting: boolean;
  onDelete: () => void;
  onOpenProfile: (userProfileId: string, name?: string | null) => void;
}) {
  const { speakSequence } = useTTS();
  const commentSpeech = buildCommunityCommentSpeech(comment) ?? "Comentário";

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
          onPress={() => speakSequence(splitPostSpeech(commentSpeech))}
          accessibilityRole="button"
          accessibilityLabel={commentSpeech}
          accessibilityHint="Lê o comentário completo e a descrição da imagem em voz alta"
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
      {comment.mediaData ? <PostImage uri={communityService.resolveAssetUrl(comment.mediaData)!}
        description={comment.imageDescription} authorName={comment.author.name} authToken={authToken} analyzeImage={async () => (await communityService.describeCommentImage(postId, comment.id)).description} /> : null}
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
  const [sourcePost, setSourcePost] = useState<CommunityPostResponse | null>(null);
  const sourceRequestRef = useRef(0);
  useEffect(() => {
    const generation = ++sourceRequestRef.current;
    setSourcePost(null);
    if (postId) void communityService.getPost(postId).then((post) => {
      if (sourceRequestRef.current === generation) setSourcePost(post);
    }).catch(() => { /* Existing route text remains available; API reports failure. */ });
    const lifecycle = sourceRequestRef; return () => { lifecycle.current++; };
  }, [postId]);
  const sourceReader = useCommunityPostReader(sourcePost ?? { id: postId, author: { name: authorName }, body: postBody });
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
  const editor = useCommunityCommentEditor(postId, isMember, authToken);
  const { body: draft, setBody: setDraft, submitting } = editor;
  const [imageSourceVisible, setImageSourceVisible] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const pickingImageRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
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

    if (!isMember) {
      showGlobalToast({
        title: "Participação necessária",
        variant: "warning",
        message: "Entre na comunidade para comentar publicações.",
      });
      return;
    }

    const createdComment = await editor.submit();
    if (createdComment) {
      setComments((currentComments) => [...currentComments, createdComment]);
      showGlobalToast({
        title: "Comentário publicado",
        variant: "success",
        message: "Seu comentário já apareceu na conversa.",
      });
      announceForAccessibility(accessibilityAnnouncements.commentPublished());
    }
  }, [editor, isMember, postId, submitting]);

  async function pickCommentImage(source: "camera" | "library") {
    setImageSourceVisible(false);
    if (!isMember || submitting || pickingImageRef.current) return;
    pickingImageRef.current = true;
    setPickingImage(true);
    try {
      const permission = source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showGlobalToast({ title: source === "camera" ? "Câmera bloqueada" : "Galeria bloqueada",
          message: "Autorize o acesso nas configurações do aparelho para anexar imagens.", variant: "warning" });
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.8, allowsEditing: false };
      const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) editor.selectImage(result.assets[0]);
    } catch {
      showGlobalToast({ title: "Não foi possível selecionar a imagem", message: "Tente novamente.", variant: "error" });
    } finally {
      pickingImageRef.current = false;
      setPickingImage(false);
    }
  }

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
                  onPress={sourceReader.read}
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

                </Pressable>
                <PostContent editedAt={sourcePost?.editedAt} body={sourcePost?.body ?? postBody} imageDescription={sourcePost?.imageDescription}
                  mediaUri={communityService.resolveAssetUrl(sourcePost?.mediaData)} authorName={sourcePost?.author.name ?? authorName}
                  authToken={authToken} onRead={sourceReader.read} onStop={sourceReader.stop} />

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
                        postId={postId}
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
                    <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                      <TextInput
                        className="min-h-[108px] rounded-2xl border border-[#494455] bg-[#1C1B1B] px-4 py-4 text-[15px] leading-6 text-white"
                        multiline
                        maxLength={400}
                        placeholder="Escreva um comentário..."
                        placeholderTextColor="#948EA1"
                        textAlignVertical="top"
                        value={draft}
                        editable={!submitting}
                        onChangeText={setDraft}
                        onFocus={() => speak("Escreva um comentário")}
                        accessibilityLabel="Escreva um comentário"
                        accessibilityHint="Escreva um comentário ou anexe uma imagem. Até 400 caracteres."
                      />
                      {editor.image ? (
                        <View>
                          <PostImage uri={editor.image.uri} description={editor.imageDescription} authorName="você" authToken={null} />
                          <Text className="mt-3 font-bold text-white">Descrição da imagem (opcional)</Text>
                          <TextInput multiline maxLength={240} editable={!submitting}
                            value={editor.imageDescription} onChangeText={editor.setImageDescription}
                            accessibilityLabel="Descrição da imagem do comentário"
                            accessibilityHint="Descreva o conteúdo relevante para quem não pode ver. Até 240 caracteres."
                            placeholder="O que aparece na imagem?" placeholderTextColor="#948EA1"
                            className="mt-2 min-h-[80px] rounded-xl border border-[#494455] p-3 text-white" />
                          <Text className="mt-1 text-right text-[#CAC3D8]">{editor.imageDescription.length} / 240</Text>
                          <Pressable accessibilityRole="button" accessibilityLabel="Remover imagem do comentário"
                            accessibilityHint="Remove a imagem e sua descrição, mantendo o texto do comentário"
                            disabled={submitting} accessibilityState={{ disabled: submitting }}
                            className="min-h-[44px] justify-center" onPress={() => editor.selectImage(null)}>
                            <Text className="font-bold text-[#FF8A8A]">Remover imagem</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </ScrollView>
                    <View className="mt-4 flex-row items-center justify-between">
                      <Text className="text-[12px] font-semibold text-[#948EA1]">
                        {draft.length} / 400
                      </Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={editor.image ? "Trocar imagem do comentário" : "Adicionar imagem ao comentário"}
                        accessibilityHint="Escolhe entre câmera e galeria. Permite descrever a imagem antes de enviar."
                        disabled={submitting || pickingImage} accessibilityState={{ disabled: submitting || pickingImage, busy: pickingImage }}
                        className="min-h-[44px] min-w-[44px] items-center justify-center"
                        onPress={() => setImageSourceVisible(true)}>
                        <Ionicons name="image-outline" size={26} color="#EAEA00" importantForAccessibility="no" />
                      </Pressable>
                      <Pressable
                        className={`rounded-full px-5 py-3 ${
                          (draft.trim().length > 0 || editor.image) && !submitting && !pickingImage
                            ? "bg-[#EAEA00]"
                            : "bg-[#3B3841]"
                        }`}
                        onPress={() => {
                          speak("Enviar comentário");
                          void handleSubmitComment();
                        }}
                        disabled={(!draft.trim() && !editor.image) || submitting || pickingImage}
                        accessibilityRole="button"
                        accessibilityLabel="Enviar comentário"
                        accessibilityHint="Publica o comentário abaixo da publicação original."
                        accessibilityState={{
                          disabled: (!draft.trim() && !editor.image) || submitting || pickingImage,
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
      <ActionSheet title="Imagem do comentário" visible={imageSourceVisible} onClose={() => setImageSourceVisible(false)}
        options={[
          { key: "camera", label: "Tirar foto", hint: "Abre a câmera", icon: "camera-outline", onPress: () => { void pickCommentImage("camera"); } },
          { key: "library", label: "Escolher da galeria", hint: "Abre as imagens salvas", icon: "images-outline", onPress: () => { void pickCommentImage("library"); } },
        ]} />
    </View>
  );
}
