import Ionicons from "@expo/vector-icons/Ionicons";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FollowPendingIcon } from "../../src/components/social/follow-pending-icon";

import {
  buildActionSpeech,
  buildConversationEntrySpeech,
  buildIncomingMessagesSpeech,
  speak,
  speakSequence,
} from "../../src/accessibility/tts";
import { getGlobalTextAdjustments } from "../../src/accessibility/global-text-adjustments";
import { ChatComposer } from "../../src/components/chat/chat-composer";
import { ImageLightbox } from "../../src/components/chat/image-lightbox";
import {
  buildMessageAccessibilityLabel,
  MessageBubble,
  type MessageAction,
} from "../../src/components/chat/message-bubble";
import {
  type BubbleAnchor,
  MessageContextMenu,
  type MessageContextMenuOption,
} from "../../src/components/chat/message-context-menu";
import { BlockUserSheet, type BlockUserTarget } from "../../src/components/privacy/block-user-sheet";
import { AuthenticatedRemoteImage } from "../../src/components/profile/authenticated-remote-image";
import { useProfileFollowToggle } from "../../src/components/social/use-profile-follow-toggle";
import { ActionSheet } from "../../src/components/ui/action-sheet";
import { useAppShell } from "../../src/context/AppShellContext";
import { useAuth } from "../../src/context/AuthContext";
import { useNotifications } from "../../src/context/NotificationContext";
import { useChatMessages } from "../../src/hooks/useChatMessages";
import { useScreenHeadingFocus } from "../../src/hooks/use-screen-heading-focus";
import { chatService } from "../../src/services/chatService";
import { followService } from "../../src/services/followService";
import { isApiError } from "../../src/types/auth";
import type {
  ChatMediaUpload,
  ChatMessageReplyResponse,
  ChatMessageResponse,
} from "../../src/types/chat";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../src/utils/auth";
import { buildReplyQuote } from "../../src/utils/chatReply";
import { followStateFromStats, type FollowState } from "../../src/utils/followRelation";
import { showGlobalToast } from "../../src/utils/globalToast";
import { setActiveConversationId } from "../../src/utils/pushNotifications";
import { buildUserProfileHref } from "../../src/utils/userProfileRoute";
import { KeyboardAvoidingContainer } from "../../src/components/ui/keyboard-aware";

type Lightbox = { uri: string; label: string };

/** Mensagem com o menu de contexto aberto e o retangulo do balao (ancora do menu). */
type MenuTarget = { message: ChatMessageResponse; anchor: BubbleAnchor };

/** Tempo do destaque na mensagem original ao tocar numa citacao. */
const JUMP_HIGHLIGHT_MS = 1600;

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
  // Fonte do sistema grande: o botão de seguir do cabeçalho fica só com o ícone
  // para o nome da pessoa não virar "Bruno.." (o rótulo acessível continua inteiro).
  const { fontScale } = useWindowDimensions();
  const compactHeaderActions = fontScale >= 1.3;
  // Ao entrar na tela, o leitor de tela do sistema comeca pelo titulo.
  const headingRef = useScreenHeadingFocus<Text>();

  const router = useRouter();
  const isFocused = useIsFocused();
  const { session } = useAuth();
  const { refreshUnreadChatCount } = useAppShell();
  // Ler a conversa tambem tira o aviso agrupado dela do sino (backend).
  const { refreshUnreadCount: refreshUnreadNotifications } = useNotifications();
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
  const partnerName = partner.name;

  // Deep link sem params (ou toque no push, que traz o perfil mas nao o
  // nome): nao ha "get conversation", entao a lista de conversas (uma
  // chamada, silenciosa) resolve quem esta do outro lado.
  useEffect(() => {
    if (!resolvedConversationId || (partnerProfileId && partnerName)) {
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
  }, [partnerName, partnerProfileId, resolvedConversationId]);

  // ---- seguir / deixar de seguir a pessoa da conversa --------------------
  const [followState, setFollowState] = useState<FollowState | null>(null);
  const followStatsRequestRef = useRef(0);

  useEffect(() => {
    setFollowState(null);

    if (!partnerProfileId) {
      return;
    }

    const requestId = ++followStatsRequestRef.current;

    // Silencioso: com bloqueio o backend responde 404 e o botao de seguir
    // simplesmente fica desabilitado — sem toast a cada abertura da conversa.
    void followService
      .getFollowStats(partnerProfileId, { silent: true })
      .then((stats) => {
        if (requestId === followStatsRequestRef.current) {
          setFollowState(followStateFromStats(stats));
        }
      })
      .catch(() => {
        // Sem estatisticas o botao de seguir fica desabilitado.
      });
  }, [partnerProfileId]);

  // Tres estados (seguir / pedir para seguir, solicitado, seguindo); a
  // resposta do backend decide se virou "Seguindo" ou "Solicitado".
  const {
    busy: followBusy,
    button: followButton,
    confirmSheet: cancelFollowRequestSheet,
    press: pressFollow,
  } = useProfileFollowToggle({
    setState: setFollowState,
    state: followState,
    targetName: otherName,
    targetProfileId: partnerProfileId || null,
  });

  const openPartnerProfile = useCallback(() => {
    if (!partnerProfileId) {
      return;
    }

    speak(buildActionSpeech("Abrir perfil de", otherName));
    router.push(buildUserProfileHref(partnerProfileId, otherName));
  }, [otherName, partnerProfileId, router]);

  const [sending, setSending] = useState(false);
  /** Mensagem com o menu de contexto (toque longo) aberto. */
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  /** Mensagem sendo respondida (citacao que vai junto do proximo envio). */
  const [replyingTo, setReplyingTo] = useState<ChatMessageReplyResponse | null>(null);
  /** Original destacada depois de tocar numa citacao. */
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Mensagem aguardando confirmacao de exclusao. */
  const [deleteTarget, setDeleteTarget] = useState<ChatMessageResponse | null>(null);
  /** Mensagem em edicao no compositor. */
  const [editing, setEditing] = useState<ChatMessageResponse | null>(null);
  const [lightbox, setLightbox] = useState<Lightbox | null>(null);
  const listRef = useRef<FlatList<ChatMessageResponse>>(null);
  /** Menu de reticencias do cabecalho (bloquear). */
  const [conversationMenuVisible, setConversationMenuVisible] = useState(false);
  const [blockTarget, setBlockTarget] = useState<BlockUserTarget | null>(null);
  /**
   * O backend recusou o envio com 409 (bloqueio em qualquer direcao): o
   * compositor some e fica o aviso. O historico continua visivel.
   */
  const [sendBlocked, setSendBlocked] = useState(false);

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
      listRef.current?.scrollToOffset({ offset: 0, animated: !getGlobalTextAdjustments().reduceMotion });
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
      void refreshUnreadNotifications();
    });
  }, [initialLoad, refreshUnreadChatCount, refreshUnreadNotifications, resolvedConversationId]);

  // Ao sair da tela o badge de nao lidas precisa refletir o que foi lido aqui.
  // Enquanto a conversa esta aberta, push de mensagem DELA nao vira banner (a
  // mensagem ja aparece aqui e a propria tela anuncia).
  useEffect(() => {
    if (!resolvedConversationId || !isFocused) {
      return;
    }

    setActiveConversationId(resolvedConversationId);

    return () => {
      setActiveConversationId(null);
      void refreshUnreadChatCount();
      void refreshUnreadNotifications();
    };
  }, [isFocused, refreshUnreadChatCount, refreshUnreadNotifications, resolvedConversationId]);

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

  // A mensagem sendo respondida foi apagada (pelo outro, no polling): o
  // backend recusaria a resposta, entao a citacao sai antes do envio.
  useEffect(() => {
    if (!replyingTo) {
      return;
    }
    const current = messages.find((message) => message.id === replyingTo.id);
    if (current?.deletedAt) {
      setReplyingTo(null);
      announceForAccessibility("A mensagem que você estava respondendo foi apagada.");
    }
  }, [messages, replyingTo]);

  // Espelho para callbacks estaveis (o balao e memo): ler a lista sem
  // recriar o handler a cada rodada do polling.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(
    () => () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    },
    []
  );

  function showSendError(nextError: unknown, fallback: string) {
    if (isApiError(nextError) && nextError.status === 409) {
      // Bloqueio: o toast global ja mostra a mensagem do backend; aqui o
      // compositor e trocado pelo aviso permanente (live region abaixo).
      setSendBlocked(true);
      setEditing(null);
      announceForAccessibility(accessibilityAnnouncements.chatBlocked());
      return;
    }

    announceForAccessibility(accessibilityAnnouncements.messageSendFailed());
    showGlobalToast({
      title: "Não foi possível enviar",
      message: formatApiErrorMessage(nextError, fallback),
      variant: "error",
    });
  }

  async function handleSendText(body: string) {
    if (!resolvedConversationId) {
      return false;
    }

    setSending(true);
    try {
      const message = await chatService.sendTextMessage(
        resolvedConversationId,
        body,
        replyingTo?.id
      );
      upsertLocalMessage(message);
      setReplyingTo(null);
      listRef.current?.scrollToOffset({ offset: 0, animated: !getGlobalTextAdjustments().reduceMotion });
      announceForAccessibility(accessibilityAnnouncements.messageSent());
      return true;
    } catch (nextError) {
      showSendError(nextError, "Tente novamente em instantes.");
      return false;
    } finally {
      setSending(false);
    }
  }

  async function handleSendMedia(media: ChatMediaUpload) {
    if (!resolvedConversationId) {
      return false;
    }

    setSending(true);
    try {
      const message = await chatService.sendMediaMessage(
        resolvedConversationId,
        replyingTo ? { ...media, replyToMessageId: replyingTo.id } : media
      );
      upsertLocalMessage(message);
      setReplyingTo(null);
      listRef.current?.scrollToOffset({ offset: 0, animated: !getGlobalTextAdjustments().reduceMotion });
      announceForAccessibility(media.type === "AUDIO" ? "Áudio enviado." : "Imagem enviada.");
      return true;
    } catch (nextError) {
      showSendError(nextError, "Verifique o tamanho do arquivo e tente de novo.");
      return false;
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

  const startReply = useCallback(
    (message: ChatMessageResponse) => {
      const quote = buildReplyQuote(message);
      setEditing(null);
      setReplyingTo(quote);
      speak(quote.fromMe ? "Respondendo à sua mensagem" : `Respondendo a ${otherName}`);
    },
    [otherName]
  );

  /** Tocar numa citacao: rola ate a original e a destaca por um instante. */
  const jumpToMessage = useCallback(
    (messageId: string) => {
      const list = messagesRef.current;
      const index = list.findIndex((message) => message.id === messageId);

      if (index < 0) {
        showGlobalToast({
          title: "Mensagem mais antiga",
          message: "Role a conversa para cima para carregar a mensagem original.",
          variant: "info",
        });
        return;
      }

      listRef.current?.scrollToIndex({
        index,
        viewPosition: 0.5,
        animated: !getGlobalTextAdjustments().reduceMotion,
      });

      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      setHighlightedId(messageId);
      highlightTimerRef.current = setTimeout(() => setHighlightedId(null), JUMP_HIGHLIGHT_MS);

      announceForAccessibility(
        `Mensagem original. ${buildMessageAccessibilityLabel(list[index], otherName)}`
      );
    },
    [otherName]
  );

  const handleMessageAction = useCallback(
    (message: ChatMessageResponse, action: MessageAction, anchor?: BubbleAnchor) => {
      switch (action) {
        case "menu":
          if (anchor) {
            setMenuTarget({ message, anchor });
          }
          return;
        case "reply":
          startReply(message);
          return;
        case "jump-to-reply":
          if (message.replyTo) {
            jumpToMessage(message.replyTo.id);
          }
          return;
        case "edit":
          setReplyingTo(null);
          setEditing(message);
          return;
        case "delete":
          setDeleteTarget(message);
          return;
      }
    },
    [jumpToMessage, startReply]
  );

  const openImage = useCallback((uri: string, label: string) => setLightbox({ uri, label }), []);

  const menuMessage = menuTarget?.message ?? null;
  const menuOptions: MessageContextMenuOption[] = menuMessage
    ? [
        ...(!sendBlocked
          ? [
              {
                key: "reply",
                label: "Responder",
                hint: "Cita esta mensagem na sua próxima mensagem",
                icon: "arrow-undo-outline" as const,
                onPress: () => {
                  setMenuTarget(null);
                  startReply(menuMessage);
                },
              },
            ]
          : []),
        ...(menuMessage.fromMe && menuMessage.type === "TEXT"
          ? [
              {
                key: "edit",
                label: "Editar",
                hint: "Carrega o texto no campo de mensagem para alterar",
                icon: "pencil-outline" as const,
                onPress: () => {
                  setMenuTarget(null);
                  setReplyingTo(null);
                  setEditing(menuMessage);
                },
              },
            ]
          : []),
        ...(menuMessage.fromMe
          ? [
              {
                key: "delete",
                label: "Apagar",
                hint: "Pede confirmação antes de apagar",
                icon: "trash-outline" as const,
                destructive: true,
                onPress: () => {
                  setMenuTarget(null);
                  setDeleteTarget(menuMessage);
                },
              },
            ]
          : []),
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
            numberOfLines={compactHeaderActions ? 2 : 1}
          >
            {otherName}
          </Text>

          {partnerProfileId ? (
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel={followButton?.accessibilityLabel ?? `Seguir ${otherName}`}
              accessibilityHint={
                followButton?.accessibilityHint ??
                "Publicações desta pessoa aparecem no seu feed"
              }
              accessibilityState={{
                busy: followBusy,
                disabled: followBusy || !followButton,
                selected: followButton?.selected ?? false,
              }}
              className={`min-h-[44px] min-w-[44px] flex-row items-center justify-center rounded-full border px-3 ${
                followButton?.selected
                  ? "border-[#CDBDFF] bg-[#2B2338]"
                  : "border-[#494455] bg-[#1A1C1F]"
              }`}
              disabled={followBusy || !followButton}
              onPress={pressFollow}
            >
              {followBusy ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : followButton?.relation === "REQUESTED" ? (
                <FollowPendingIcon size={16} badgeBackground="#2B2338" />
              ) : (
                <Ionicons
                  name={followButton?.icon ?? "person-add-outline"}
                  size={16}
                  color="#FFFFFF"
                  importantForAccessibility="no"
                />
              )}
              {compactHeaderActions ? null : (
                <Text className="ml-1.5 text-[13px] font-bold text-white">
                  {followButton?.text ?? "Seguir"}
                </Text>
              )}
            </Pressable>
          ) : null}

          {partnerProfileId ? (
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Mais opções da conversa com ${otherName}`}
              accessibilityHint="Abre as opções, como bloquear esta pessoa"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              className="h-11 w-11 items-center justify-center rounded-full bg-[#17181C]"
              onPress={() => {
                speak("Mais opções");
                setConversationMenuVisible(true);
              }}
            >
              <Ionicons
                name="ellipsis-vertical"
                size={20}
                color="#FFFFFF"
                importantForAccessibility="no"
              />
            </Pressable>
          ) : null}
        </View>

        <KeyboardAvoidingContainer className="flex-1">
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
              extraData={`${highlightedId ?? ""}|${sendBlocked}`}
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
              // Citacao para mensagem fora da janela renderizada: rola pela
              // altura media ate ela existir e tenta de novo.
              onScrollToIndexFailed={({ index, averageItemLength }) => {
                listRef.current?.scrollToOffset({
                  offset: averageItemLength * index,
                  animated: false,
                });
                setTimeout(() => {
                  if (index < messagesRef.current.length) {
                    listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false });
                  }
                }, 120);
              }}
              ref={listRef}
              renderItem={({ item }) => (
                <MessageBubble
                  authToken={authToken}
                  highlighted={item.id === highlightedId}
                  message={item}
                  onMessageAction={handleMessageAction}
                  onOpenImage={openImage}
                  otherName={otherName}
                  replyEnabled={!sendBlocked}
                />
              )}
              showsVerticalScrollIndicator={false}
            />
          )}

          {sendBlocked ? (
            <View
              accessible
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              accessibilityLabel="Não é possível enviar mensagens para este contato."
              className="flex-row items-center gap-3 border-t border-[#353534] bg-[#111214] px-4 py-4"
            >
              <Ionicons name="ban-outline" size={22} color="#FF8FAB" importantForAccessibility="no" />
              <Text className="flex-1 text-[15px] font-semibold leading-6 text-[#FFCCD8]">
                Não é possível enviar mensagens para este contato.
              </Text>
            </View>
          ) : (
            <ChatComposer
              editing={editing ? { messageId: editing.id, body: editing.body ?? "" } : null}
              onCancelEdit={() => setEditing(null)}
              onCancelReply={() => {
                speak("Resposta cancelada");
                setReplyingTo(null);
              }}
              onSendMedia={handleSendMedia}
              onSendText={handleSendText}
              onSubmitEdit={(messageId, body) => {
                void handleSubmitEdit(messageId, body);
              }}
              otherName={otherName}
              replyingTo={replyingTo}
              sending={sending}
            />
          )}
        </KeyboardAvoidingContainer>
      </SafeAreaView>

      <MessageContextMenu
        align={menuMessage?.fromMe ? "end" : "start"}
        anchor={menuTarget?.anchor ?? null}
        onClose={() => setMenuTarget(null)}
        options={menuOptions}
        title={menuMessage?.fromMe ? "Opções da sua mensagem" : `Opções da mensagem de ${otherName}`}
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

      <ActionSheet
        onClose={() => setConversationMenuVisible(false)}
        options={
          partnerProfileId
            ? [
                {
                  key: "block",
                  label: `Bloquear ${otherName}`,
                  hint: "Pede confirmação. Vocês deixam de se ver e de trocar mensagens",
                  icon: "ban-outline",
                  destructive: true,
                  onPress: () => {
                    setConversationMenuVisible(false);
                    speak(buildActionSpeech("Bloquear", otherName));
                    setBlockTarget({ userProfileId: partnerProfileId, name: otherName });
                  },
                },
              ]
            : []
        }
        title={`Conversa com ${otherName}`}
        visible={conversationMenuVisible}
      />

      {cancelFollowRequestSheet}

      <BlockUserSheet
        target={blockTarget}
        onClose={() => setBlockTarget(null)}
        onBlocked={() => {
          setSendBlocked(true);
          if (router.canGoBack()) {
            router.back();
            return;
          }
          router.replace("/chats");
        }}
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
