import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Text, View } from "react-native";

import { chatService } from "../../services/chatService";
import type { ConversationSummaryResponse } from "../../types/chat";
import { formatRelativeDateTime, formatTimeForSpeech } from "../../utils/chatFormatting";
import { AuthenticatedRemoteImage } from "../profile/authenticated-remote-image";

export function ConversationRow({
  authToken,
  conversation,
  onPress,
}: {
  authToken: string | null;
  conversation: ConversationSummaryResponse;
  onPress: (conversation: ConversationSummaryResponse) => void;
}) {
  const displayName = conversation.otherUserName?.trim() || "Pessoa sem nome";
  const photoUrl = chatService.resolveAssetUrl(conversation.otherUserPhoto?.url ?? null);
  const preview = conversation.lastMessage?.preview ?? "Ainda sem mensagens";
  const unread = conversation.unreadCount;

  /**
   * Rotulo unico e completo: nome, previa, horario e nao lidas.
   * O leitor de tela le tudo em UM foco, na ordem em que a informacao importa.
   */
  const accessibilityLabel = [
    `Conversa com ${displayName}`,
    conversation.lastMessage
      ? `${conversation.lastMessage.fromMe ? "Você" : displayName}: ${preview}`
      : "Ainda sem mensagens",
    conversation.lastMessageAt ? formatTimeForSpeech(conversation.lastMessageAt) : null,
    unread > 0
      ? `${unread} ${unread === 1 ? "mensagem não lida" : "mensagens não lidas"}`
      : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Abre a conversa"
      className="flex-row items-center gap-4 rounded-[24px] border border-[#353534] bg-[#111214] p-4"
      onPress={() => onPress(conversation)}
    >
      <View className="h-16 w-16 overflow-hidden rounded-full border border-[#CDBDFF] bg-[#2D2A33]">
        {photoUrl ? (
          <AuthenticatedRemoteImage
            authToken={authToken}
            className="h-full w-full"
            fallback={
              <View className="flex-1 items-center justify-center bg-[#2D2A33]">
                <Ionicons name="person" size={28} color="#CDBDFF" />
              </View>
            }
            resizeMode="cover"
            uri={photoUrl}
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-[#2D2A33]">
            <Ionicons name="person" size={28} color="#CDBDFF" />
          </View>
        )}
      </View>

      {/* Conteudo visual: ja descrito pelo rotulo do Pressable. */}
      <View className="flex-1" importantForAccessibility="no-hide-descendants">
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 text-[18px] font-black text-white" numberOfLines={1}>
            {displayName}
          </Text>
          {conversation.lastMessageAt ? (
            <Text className="ml-2 text-[12px] font-semibold text-[#9F96B8]">
              {formatRelativeDateTime(conversation.lastMessageAt)}
            </Text>
          ) : null}
        </View>

        <View className="mt-1 flex-row items-center justify-between gap-2">
          <Text
            className={`flex-1 text-[14px] ${
              unread > 0 ? "font-bold text-white" : "font-semibold text-[#CAC3D8]"
            }`}
            numberOfLines={1}
          >
            {conversation.lastMessage?.fromMe ? "Você: " : ""}
            {preview}
          </Text>

          {unread > 0 ? (
            <View className="min-w-[24px] items-center justify-center rounded-full bg-[#7C4DFF] px-2 py-1">
              <Text className="text-[11px] font-black text-white">
                {unread > 99 ? "99+" : unread}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
