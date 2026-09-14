import Ionicons from "@expo/vector-icons/Ionicons";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  buildActionSpeech,
  buildConversationEntrySpeech,
  buildIncomingMessagesSpeech,
  speak,
  speakSequence,
} from "../../src/accessibility/tts";
import { ChatComposer } from "../../src/components/chat/chat-composer";
import { ImageLightbox } from "../../src/components/chat/image-lightbox";
import { MessageBubble, type MessageAction } from "../../src/components/chat/message-bubble";
import { AuthenticatedRemoteImage } from "../../src/components/profile/authenticated-remote-image";
import { ActionSheet, type ActionSheetOption } from "../../src/components/ui/action-sheet";
import { useAppShell } from "../../src/context/AppShellContext";
import { useAuth } from "../../src/context/AuthContext";
import { useChatMessages } from "../../src/hooks/useChatMessages";
import { useScreenHeadingFocus } from "../../src/hooks/use-screen-heading-focus";
import { chatService } from "../../src/services/chatService";
import { followService } from "../../src/services/followService";
import type { ChatMediaUpload, ChatMessageResponse } from "../../src/types/chat";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../src/utils/auth";
import { showGlobalToast } from "../../src/utils/globalToast";
import { buildUserProfileHref } from "../../src/utils/userProfileRoute";

type Lightbox = { uri: string; label: string };

/** Quem esta do outro lado: vem por params da lista ou, em deep link, da API. */
type Partner = {
  userProfileId: string | null;
  name: string | null;
  photoUrl: string | null;
};

function readParam(value?: string | string[]): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = typeof raw === "string" ? raw.trim() : "";

  return trimmed ? trimmed : null;
}

function PartnerAvatar({
  authToken,
  photoUrl,
}: {
  authToken: string | null;
  photoUrl: string | null;
}) {
  const fallback = (
    <View className="flex-1 items-center justify-center bg-[#2D2A33]">
      <Ionicons name="person" size={20} color="#CDBDFF" />
    </View>
  );

  return (
    <View className="h-11 w-11 overflow-hidden rounded-full border border-[#CDBDFF] bg-[#2D2A33]">
      {photoUrl ? (
        <AuthenticatedRemoteImage
          authToken={authToken}
          className="h-full w-full"
          fallback={fallback}
          resizeMode="cover"
          uri={photoUrl}
        />
      ) : (
        fallback
      )}
    </View>
  );
}

export default function ConversationScreen() {
  // Ao entrar na tela, o leitor de tela do sistema comeca pelo titulo.
  const headingRef = useScreenHeadingFocus<Text>();

  const router = useRouter();
  const isFocused = useIsFocused();
  const { session } = useAuth();
  const { refreshUnreadChatCount } = useAppShell();
  const { conversationId, name, otherUserProfileId, otherUserPhotoUrl } =
    useLocalSearchParams<{
      conversationId?: string;
      name?: string;
      otherUserProfileId?: string;
      otherUserPhotoUrl?: string;
    }>();

  const resolvedConversationId = readParam(conversationId);
  const authToken = session?.accessToken ?? null;

  const [partner, setPartner] = useState<Partner>(() => ({
    userProfileId: readParam(otherUserProfileId),
    name: readParam(name),
    photoUrl: readParam(otherUserPhotoUrl),
  }));
  const otherName = partner.name ?? "essa pessoa";
  const partnerProfileId = partner.userProfileId;

  // Deep link sem params: nao ha "get conversation", entao a lista de
  // conversas (uma chamada, silenciosa) resolve quem esta do outro lado.
  useEffect(() => {
    if (!resolvedConversationId || partnerProfileId) {
      return;
    }

    let active = true;

    void chatService
      .pollConversations()
      .then((response) => {
        if (!active) {
          return;
        }

        const found = response.conversations.find(
          (item) => item.conversationId === resolvedConversationId
        );

        if (!found) {
          return;
        }

        setPartner((current) => ({
          userProfileId: found.otherUserProfileId ?? current.userProfileId,
          name: found.otherUserName?.trim() || current.name,
          photoUrl:
            chatService.resolveAssetUrl(found.otherUserPhoto?.url ?? null) ?? current.photoUrl,
        }));
      })
      .catch(() => {
        // Silencioso: o cabecalho segue com "essa pessoa" e sem botao de seguir.
      });

    return () => {
      active = false;
    };
  }, [partnerProfileId, resolvedConversationId]);

  // ---- seguir / deixar de seguir a pessoa da conversa --------------------
  const [followState, setFollowState] = useState<{ following: boolean } | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const followStatsRequestRef = useRef(0);

  useEffect(() => {
    setFollowState(null);

    if (!partnerProfileId) {
      return;
    }

    const requestId = ++followStatsRequestRef.current;

    void followService
      .getFollowStats(partnerProfileId)
      .then((stats) => {
        if (requestId === followStatsRequestRef.current) {
          setFollowState({ following: stats.followedByCurrentUser });
        }
      })
      .catch(() => {
        // Global API error toast already explains the failure.
      });
  }, [partnerProfileId]);

  const toggleFollow = useCallback(async () => {
    if (!partnerProfileId || !followState || followBusy) {
      return;
    }

    const willFollow = !followState.following;
    speak(buildActionSpeech(willFollow ? "Seguir" : "Deixar de seguir", otherName));

    setFollowBusy(true);
    // Otimista: o botao responde na hora e volta se a requisicao falhar.
    setFollowState({ following: willFollow });

    try {
      const response = willFollow
        ? await followService.follow(partnerProfileId)
        : await followService.unfollow(partnerProfileId);

      setFollowState({ following: response.following });
      announceForAccessibility(
        response.following
          ? accessibilityAnnouncements.followStarted(otherName)
          : accessibilityAnnouncements.followStopped(otherName)
      );
    } catch {
      setFollowState({ following: !willFollow });
      // Global API error toast already explains the failure.
    } finally {
      setFollowBusy(false);
    }
  }, [followBusy, followState, otherName, partnerProfileId]);

  const openPartnerProfile = useCallback(() => {
    if (!partnerProfileId) {
      return;
    }

    speak(buildActionSpeech("Abrir perfil de", otherName));
    router.push(buildUserProfileHref(partnerProfileId, otherName));
  }, [otherName, partnerProfileId, router]);

  const [sending, setSending] = useState(false);
  /** Mensagem minha com o menu de acoes (toque longo) aberto. */
  const [actionTarget, setActionTarget] = useState<ChatMessageResponse | null>(null);
  /** Mensagem aguardando confirmacao de exclusao. */
  const [deleteTarget, setDeleteTarget] = useState<ChatMessageResponse | null>(null);
  /** Mensagem em edicao no compositor. */
  const [editing, setEditing] = useState<ChatMessageResponse | null>(null);
  const [lightbox, setLightbox] = useState<Lightbox | null>(null);
  const listRef = useRef<FlatList<ChatMessageResponse>>(null);

  const handleNewIncomingMessages = useCallback(
    (incoming: ChatMessageResponse[]) => {
      // Mensagem que chega com a tela aberta tambem e "nao lida" para quem
      // ouve: aviso + leitura (tipo quando nao e texto, horario e conteudo).
      const incomingSpeech = buildIncomingMessagesSpeech(incoming, otherName);
      speakSequence(incomingSpeech);
      announceForAccessibility(
        incomingSpeech.length > 0
          ? `${incomingSpeech.join(". ")}.`
          : accessibilityAnnouncements.newMessages(incoming.length, otherName)
      );
      // Auto-scroll: a lista e `inverted`, entao o fim da conversa e o offset 0.
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      // Chegou mensagem com a tela aberta: marcar como lida imediatamente.
      if (resolvedConversationId) {
        void chatService.markAsRead(resolvedConversationId);
      }
    },
    [otherName, resolvedConversationId]
  );

  const {
    error,
    hasNext,
    initialLoad,
    loadOlderMessages,
    loading,
    loadingMore,
    messages,
    upsertLocalMessage,
  } = useChatMessages({
    conversationId: resolvedConversationId,
    enabled: isFocused,
    onNewIncomingMessages: handleNewIncomingMessages,
  });

  // Sequencia de entrada: pessoa, total de nao lidas e cada mensagem pendente
  // (tipo quando nao e texto, horario e conteudo). Reage a identidade de
  // `initialLoad`: um objeto novo a cada abertura da conversa.
  const spokenInitialLoadRef = useRef<typeof initialLoad>(null);

  useEffect(() => {
    if (!initialLoad || initialLoad.conversationId !== resolvedConversationId) {
      return;
    }

    if (spokenInitialLoadRef.current === initialLoad) {
      return;
    }
    spokenInitialLoadRef.current = initialLoad;

    const entrySpeech = buildConversationEntrySpeech(
      otherName,
      initialLoad.unreadMessages,
      initialLoad.unreadCount
    );
    // Dois canais que nunca soam juntos: `speakSequence` cala com o leitor
    // nativo ligado e `announceForAccessibility` so soa com ele ligado.
    speakSequence(entrySpeech);
    announceForAccessibility(`${entrySpeech.join(". ")}.`);
  }, [initialLoad, otherName, resolvedConversationId]);

  // Marcar como lida SO depois da carga inicial: assim a resposta ainda traz
  // as pendencias (`unreadCount`, `readAt` nulo) que a sequencia acima le.
  useEffect(() => {
    if (!initialLoad || initialLoad.conversationId !== resolvedConversationId) {
      return;
    }

    void chatService.markAsRead(initialLoad.conversationId).finally(() => {
      void refreshUnreadChatCount();
    });
  }, [initialLoad, refreshUnreadChatCount, resolvedConversationId]);

  // Ao sair da tela o badge de nao lidas precisa refletir o que foi lido aqui.
  useEffect(() => {
    if (!resolvedConversationId || !isFocused) {
      return;
    }

    return () => {
      void refreshUnreadChatCount();
    };
  }, [isFocused, refreshUnreadChatCount, resolvedConversationId]);

  // A mensagem em edicao foi apagada/alterada por outro caminho (polling): sai da edicao.
  useEffect(() => {
    if (!editing) {
      return;
    }
    const current = messages.find((message) => message.id === editing.id);
    if (!current || current.deletedAt) {
      setEditing(null);
    }
  }, [editing, messages]);

  function showSendError(nextError: unknown, fallback: string) {
    announceForAccessibility(accessibilityAnnouncements.messageSendFailed());
    showGlobalToast({
      title: "Não foi possível enviar",
      message: formatApiErrorMessage(nextError, fallback),
      variant: "error",
    });
  }

  async function handleSendText(body: string) {
    if (!resolvedConversationId) {
      return;
    }

    setSending(true);
    try {
      const message = await chatService.sendTextMessage(resolvedConversationId, body);
      upsertLocalMessage(message);
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      announceForAccessibility(accessibilityAnnouncements.messageSent());
    } catch (nextError) {
      showSendError(nextError, "Tente novamente em instantes.");
    } finally {
      setSending(false);
    }
  }

  async function handleSendMedia(media: ChatMediaUpload) {
    if (!resolvedConversationId) {
      return;
    }

    setSending(true);
    try {
      const message = await chatService.sendMediaMessage(resolvedConversationId, media);
      upsertLocalMessage(message);
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      announceForAccessibility(media.type === "AUDIO" ? "Áudio enviado." : "Imagem enviada.");
    } catch (nextError) {
      showSendError(nextError, "Verifique o tamanho do arquivo e tente de novo.");
    } finally {
      setSending(false);
    }
  }

  async function handleSubmitEdit(messageId: string, body: string) {
    if (!resolvedConversationId) {
      return;
    }

    setSending(true);
    try {
      const message = await chatService.editMessage(resolvedConversationId, messageId, body);
      upsertLocalMessage(message);
      setEditing(null);
      announceForAccessibility(accessibilityAnnouncements.messageEdited());
    } catch (nextError) {
      showGlobalToast({
        title: "Não foi possível editar",
        message: formatApiErrorMessage(nextError, "Tente novamente em instantes."),
        variant: "error",
      });
    } finally {
      setSending(false);
    }
  }

  async function handleConfirmDelete() {
    const target = deleteTarget;
    setDeleteTarget(null);

    if (!resolvedConversationId || !target) {
      return;
    }

    try {
      const message = await chatService.deleteMessage(resolvedConversationId, target.id);
      upsertLocalMessage(message);
      if (editing?.id === target.id) {
        setEditing(null);
      }
      announceForAccessibility(accessibilityAnnouncements.messageDeleted());
    } catch (nextError) {
      showGlobalToast({
        title: "Não foi possível apagar",
        message: formatApiErrorMessage(nextError, "Tente novamente em instantes."),
        variant: "error",
      });
    }
  }

  function handleMessageAction(message: ChatMessageResponse, action: MessageAction) {
    if (action === "menu") {
      setActionTarget(message);
      return;
    }
    if (action === "edit") {
      setEditing(message);
      return;
    }
    setDeleteTarget(message);
  }

  const actionOptions: ActionSheetOption[] = actionTarget
    ? [
        ...(actionTarget.type === "TEXT"
          ? [
              {
                key: "edit",
                label: "Editar mensagem",
                hint: "Carrega o texto no campo de mensagem para alterar",
                icon: "pencil-outline" as const,
                onPress: () => {
                  setActionTarget(null);
                  setEditing(actionTarget);
                },
              },
            ]
          : []),
        {
          key: "delete",
          label: "Apagar mensagem",
          hint: "Pede confirmação antes de apagar",
          icon: "trash-outline" as const,
          destructive: true,
          onPress: () => {
            setActionTarget(null);
            setDeleteTarget(actionTarget);
          },
        },
      ]
    : [];

  return (
    <View className="flex-1 bg-[#1F2023]">
      <SafeAreaView className="flex-1">
        {/* Cabecalho */}
        <View className="flex-row items-center gap-3 border-b border-[#353534] px-4 py-3">
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel="Voltar para a lista de conversas"
            accessibilityHint="Volta para a lista de conversas"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="h-11 w-11 items-center justify-center rounded-full bg-[#17181C]"
            onPress={() => router.back()}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color="#FFFFFF"
              importantForAccessibility="no"
            />
          </Pressable>

          {partnerProfileId ? (
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Abrir perfil de ${otherName}`}
              accessibilityHint="Abre o perfil público desta pessoa"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              onPress={openPartnerProfile}
            >
              <PartnerAvatar authToken={authToken} photoUrl={partner.photoUrl} />
            </Pressable>
          ) : (
            // Sem id de perfil o avatar e decorativo: o titulo ja diz o nome.
            <View importantForAccessibility="no-hide-descendants">
              <PartnerAvatar authToken={authToken} photoUrl={partner.photoUrl} />
            </View>
          )}

          <Text
            ref={headingRef}
            accessibilityRole="header"
            className="flex-1 text-[20px] font-black text-white"
            numberOfLines={1}
          >
            {otherName}
          </Text>

          {partnerProfileId ? (
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel={
                followState?.following
                  ? `Deixar de seguir ${otherName}`
                  : `Seguir ${otherName}`
              }
              accessibilityHint={
                followState?.following
                  ? "Remove as publicações desta pessoa do seu feed"
                  : "Publicações desta pessoa aparecem no seu feed"
              }
              accessibilityState={{
                busy: followBusy,
                disabled: followBusy || !followState,
                selected: followState?.following ?? false,
              }}
              className={`h-10 flex-row items-center justify-center rounded-full border px-3 ${
                followState?.following
                  ? "border-[#CDBDFF] bg-[#2B2338]"
                  : "border-[#494455] bg-[#1A1C1F]"
              }`}
              disabled={followBusy || !followState}
              onPress={() => {
                void toggleFollow();
              }}
            >
              {followBusy ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons
                  name={followState?.following ? "checkmark" : "person-add-outline"}
                  size={16}
                  color="#FFFFFF"
                  importantForAccessibility="no"
                />
              )}
              <Text className="ml-1.5 text-[13px] font-bold text-white">
                {followState?.following ? "Seguindo" : "Seguir"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          {loading && messages.length === 0 ? (
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Carregando mensagens"
              accessibilityState={{ busy: true }}
              className="flex-1 items-center justify-center"
            >
              <ActivityIndicator color="#EAEA00" />
            </View>
          ) : (
            <FlatList
              accessibilityLabel={`Mensagens da conversa com ${otherName}`}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
              data={messages}
              // `inverted`: a mensagem mais recente fica embaixo, e o auto-scroll
              // vira scrollToOffset(0) — mais estavel que scrollToEnd.
              inverted
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <View
                  accessible
                  accessibilityRole="alert"
                  accessibilityLabel={`Nenhuma mensagem ainda. Envie a primeira mensagem para ${otherName}.`}
                  className="mt-10 items-center px-6"
                >
                  <Text className="text-center text-[16px] font-semibold text-[#CAC3D8]">
                    {error ?? `Diga oi para ${otherName}!`}
                  </Text>
                </View>
              }
              ListFooterComponent={
                loadingMore ? (
                  <View className="py-4">
                    <ActivityIndicator color="#7C4DFF" size="small" />
                  </View>
                ) : null
              }
              onEndReached={() => {
                if (hasNext) {
                  void loadOlderMessages();
                }
              }}
              onEndReachedThreshold={0.4}
              ref={listRef}
              renderItem={({ item }) => (
                <MessageBubble
                  authToken={authToken}
                  message={item}
                  onMessageAction={item.fromMe ? handleMessageAction : undefined}
                  onOpenImage={(uri, label) => setLightbox({ uri, label })}
                  otherName={otherName}
                />
              )}
              showsVerticalScrollIndicator={false}
            />
          )}

          <ChatComposer
            editing={editing ? { messageId: editing.id, body: editing.body ?? "" } : null}
            onCancelEdit={() => setEditing(null)}
            onSendMedia={(media) => {
              void handleSendMedia(media);
            }}
            onSendText={(body) => {
              void handleSendText(body);
            }}
            onSubmitEdit={(messageId, body) => {
              void handleSubmitEdit(messageId, body);
            }}
            sending={sending}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      <ActionSheet
        onClose={() => setActionTarget(null)}
        options={actionOptions}
        title="Mensagem"
        visible={Boolean(actionTarget)}
      />

      <ActionSheet
        message="Ela continua no histórico da conversa como “Mensagem apagada”, sem o conteúdo."
        onClose={() => setDeleteTarget(null)}
        options={[
          {
            key: "confirm-delete",
            label: "Apagar",
            hint: "Apaga a mensagem para as duas pessoas",
            icon: "trash-outline",
            destructive: true,
            onPress: () => {
              void handleConfirmDelete();
            },
          },
        ]}
        title="Apagar mensagem?"
        visible={Boolean(deleteTarget)}
      />

      <ImageLightbox
        accessibilityLabel={lightbox?.label ?? "Imagem"}
        authToken={authToken}
        onClose={() => setLightbox(null)}
        uri={lightbox?.uri ?? null}
      />
    </View>
  );
}
