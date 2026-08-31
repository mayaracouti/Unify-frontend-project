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
import { MessageBubble } from "../../src/components/chat/message-bubble";
import { useAppShell } from "../../src/context/AppShellContext";
import { useAuth } from "../../src/context/AuthContext";
import { useChatMessages } from "../../src/hooks/useChatMessages";
import { useRequireCompletedOnboarding } from "../../src/hooks/useRequireCompletedOnboarding";
import { chatService } from "../../src/services/chatService";
import type { ChatMediaUpload, ChatMessageResponse } from "../../src/types/chat";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../src/utils/auth";
import { showGlobalToast } from "../../src/utils/globalToast";

export default function ConversationScreen() {
  useRequireCompletedOnboarding();

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
    appendLocalMessage,
    error,
    hasNext,
    loadOlderMessages,
    loading,
    loadingMore,
    messages,
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

  async function handleSendText(body: string) {
    if (!resolvedConversationId) {
      return;
    }

    setSending(true);
    try {
      const message = await chatService.sendTextMessage(resolvedConversationId, body);
      appendLocalMessage(message);
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      announceForAccessibility(accessibilityAnnouncements.messageSent());
    } catch (nextError) {
      announceForAccessibility(accessibilityAnnouncements.messageSendFailed());
      showGlobalToast({
        title: "Não foi possível enviar",
        message: formatApiErrorMessage(nextError, "Tente novamente em instantes."),
        variant: "error",
      });
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
      appendLocalMessage(message);
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      announceForAccessibility(media.type === "AUDIO" ? "Áudio enviado." : "Imagem enviada.");
    } catch (nextError) {
      announceForAccessibility(accessibilityAnnouncements.messageSendFailed());
      showGlobalToast({
        title: "Não foi possível enviar",
        message: formatApiErrorMessage(
          nextError,
          "Verifique o tamanho do arquivo e tente de novo."
        ),
        variant: "error",
      });
    } finally {
      setSending(false);
    }
  }

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
                <MessageBubble authToken={authToken} message={item} otherName={otherName} />
              )}
              showsVerticalScrollIndicator={false}
            />
          )}

          <ChatComposer
            onSendMedia={(media) => {
              void handleSendMedia(media);
            }}
            onSendText={(body) => {
              void handleSendText(body);
            }}
            sending={sending}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
