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

import { ChatComposer } from "../../src/components/chat/chat-composer";
import { ImageLightbox } from "../../src/components/chat/image-lightbox";
import { MessageBubble, type MessageAction } from "../../src/components/chat/message-bubble";
import { ActionSheet, type ActionSheetOption } from "../../src/components/ui/action-sheet";
import { useAppShell } from "../../src/context/AppShellContext";
import { useAuth } from "../../src/context/AuthContext";
import { useChatMessages } from "../../src/hooks/useChatMessages";
import { useScreenHeadingFocus } from "../../src/hooks/use-screen-heading-focus";
import { chatService } from "../../src/services/chatService";
import type { ChatMediaUpload, ChatMessageResponse } from "../../src/types/chat";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../src/utils/auth";
import { showGlobalToast } from "../../src/utils/globalToast";

type Lightbox = { uri: string; label: string };

export default function ConversationScreen() {
  // Ao entrar na tela, o leitor de tela do sistema comeca pelo titulo.
  const headingRef = useScreenHeadingFocus<Text>();

  const router = useRouter();
  const isFocused = useIsFocused();
  const { session } = useAuth();
  const { refreshUnreadChatCount } = useAppShell();
  const { conversationId, name } = useLocalSearchParams<{
    conversationId?: string;
    name?: string;
  }>();

  const resolvedConversationId =
    typeof conversationId === "string" && conversationId.trim()
      ? conversationId.trim()
      : null;
  const otherName = typeof name === "string" && name.trim() ? name.trim() : "essa pessoa";
  const authToken = session?.accessToken ?? null;

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
      announceForAccessibility(
        accessibilityAnnouncements.newMessages(incoming.length, otherName)
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

  // Marcar como lida ao abrir e ao sair (garante o badge correto).
  useEffect(() => {
    if (!resolvedConversationId || !isFocused) {
      return;
    }

    void chatService.markAsRead(resolvedConversationId).finally(() => {
      void refreshUnreadChatCount();
    });

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

          <Text
            ref={headingRef}
            accessibilityRole="header"
            className="flex-1 text-[20px] font-black text-white"
            numberOfLines={1}
          >
            {otherName}
          </Text>
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
