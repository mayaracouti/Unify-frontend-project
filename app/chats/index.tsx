import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConversationRow } from "../../src/components/chat/conversation-row";
import { GlobalBottomNav } from "../../src/components/navigation/global-bottom-nav";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import { useAppShell } from "../../src/context/AppShellContext";
import { useAuth } from "../../src/context/AuthContext";
import { useScreenHeadingFocus } from "../../src/hooks/use-screen-heading-focus";
import { chatService } from "../../src/services/chatService";
import type { ConversationSummaryResponse } from "../../src/types/chat";
import { announceForAccessibility } from "../../src/utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../src/utils/auth";

const LIST_POLL_INTERVAL_MS = 15000;

export default function ChatsScreen() {
  // Ao entrar na tela, o leitor de tela do sistema comeca pelo titulo.
  const headingRef = useScreenHeadingFocus<Text>();
  const isFocused = useIsFocused();
  const router = useRouter();
  const { session } = useAuth();
  const { refreshUnreadChatCount } = useAppShell();

  const [conversations, setConversations] = useState<ConversationSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authToken = session?.accessToken ?? null;
  const inFlightRef = useRef(false);

  const load = useCallback(async (mode: "initial" | "refresh" | "poll") => {
    // Um ciclo por vez: o polling nunca atropela um refresh manual.
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;

    try {
      const response =
        mode === "poll"
          ? await chatService.pollConversations()
          : await chatService.listConversations();

      setConversations(response.conversations);
      setError(null);

      if (mode === "initial") {
        announceForAccessibility(
          response.conversations.length === 0
            ? "Você ainda não tem conversas."
            : `${response.conversations.length} ${
                response.conversations.length === 1 ? "conversa" : "conversas"
              }. ${response.totalUnread} não ${
                response.totalUnread === 1 ? "lida" : "lidas"
              }.`
        );
      }
    } catch (nextError) {
      // Falha de polling e silenciosa: so erro de carga/refresh aparece.
      if (mode !== "poll") {
        setError(formatApiErrorMessage(nextError, "Não foi possível carregar suas conversas."));
      }
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    setLoading(true);
    void load("initial");

    const intervalId = setInterval(() => {
      void load("poll");
      void refreshUnreadChatCount();
    }, LIST_POLL_INTERVAL_MS);

    // Cleanup obrigatorio: fora de foco o polling para.
    return () => clearInterval(intervalId);
  }, [isFocused, load, refreshUnreadChatCount]);

  return (
    <View className="flex-1 bg-[#1F2023]">
      <SafeAreaView className="flex-1">
        <GlobalTopNav />

        <View className="flex-1 px-5 pt-5">
          <Text
            ref={headingRef}
            accessibilityRole="header"
            className="text-[32px] font-extrabold text-white"
          >
            Conversas
          </Text>
          <Text className="mt-2 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
            Suas conversas com quem deu match com você.
          </Text>

          {loading && conversations.length === 0 ? (
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Carregando conversas"
              accessibilityState={{ busy: true }}
              className="flex-1 items-center justify-center"
            >
              <ActivityIndicator color="#EAEA00" />
            </View>
          ) : (
            <FlatList
              accessibilityLabel="Lista de conversas"
              className="mt-5 flex-1"
              contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
              data={conversations}
              keyExtractor={(item) => item.conversationId}
              ListEmptyComponent={
                <View
                  accessible
                  accessibilityRole="alert"
                  accessibilityLabel={
                    error ??
                    "Você ainda não tem conversas. Quando alguém der match com você, a conversa aparece aqui."
                  }
                  className="rounded-[28px] border border-[#353534] bg-[#111214] px-6 py-10"
                >
                  <Text
                    accessibilityRole="header"
                    className="text-[22px] font-black text-[#E5E2E1]"
                  >
                    Nenhuma conversa ainda
                  </Text>
                  <Text className="mt-3 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
                    {error ??
                      "Quando você e outra pessoa derem match, a conversa aparece aqui automaticamente."}
                  </Text>
                </View>
              }
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  tintColor="#7C4DFF"
                  onRefresh={() => {
                    setRefreshing(true);
                    void load("refresh");
                  }}
                />
              }
              renderItem={({ item }) => (
                <ConversationRow
                  authToken={authToken}
                  conversation={item}
                  onPress={(conversation) =>
                    router.push({
                      pathname: "/chats/[conversationId]",
                      params: {
                        conversationId: conversation.conversationId,
                        name: conversation.otherUserName ?? "",
                      },
                    })
                  }
                />
              )}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        <GlobalBottomNav />
      </SafeAreaView>
    </View>
  );
}
