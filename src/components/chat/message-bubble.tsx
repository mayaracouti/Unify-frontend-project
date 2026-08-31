import Ionicons from "@expo/vector-icons/Ionicons";
import { Text, View } from "react-native";

import { chatService } from "../../services/chatService";
import type { ChatMessageResponse } from "../../types/chat";
import { formatAudioDuration, formatTimeForSpeech } from "../../utils/chatFormatting";
import { AuthenticatedRemoteImage } from "../profile/authenticated-remote-image";
import { AudioMessagePlayer } from "./audio-message-player";

/**
 * Rotulo completo da mensagem para o leitor de tela.
 * Formato: "Mensagem de <quem> <quando>. <conteudo>. <status de leitura>"
 */
function buildMessageAccessibilityLabel(
  message: ChatMessageResponse,
  otherName: string
): string {
  const author = message.fromMe ? "Você" : otherName;
  const when = formatTimeForSpeech(message.createdAt);

  const content =
    message.type === "TEXT"
      ? message.body ?? ""
      : message.type === "IMAGE"
        ? `Imagem${message.body ? `. Legenda: ${message.body}` : ""}`
        : message.type === "AUDIO"
          ? `Mensagem de áudio de ${formatAudioDuration(message.mediaDurationSeconds)}`
          : "Vídeo";

  const readStatus =
    message.fromMe && message.readAt ? "Lida." : message.fromMe ? "Enviada." : "";

  return `Mensagem de ${author} ${when}. ${content}. ${readStatus}`
    .replace(/\s+/g, " ")
    .trim();
}

export function MessageBubble({
  authToken,
  message,
  otherName,
}: {
  authToken: string | null;
  message: ChatMessageResponse;
  otherName: string;
}) {
  const mine = message.fromMe;
  const mediaUrl = chatService.resolveAssetUrl(message.mediaUrl);

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={buildMessageAccessibilityLabel(message, otherName)}
      className={`mb-3 max-w-[82%] rounded-[20px] px-4 py-3 ${
        mine ? "self-end bg-[#7C4DFF]" : "self-start bg-[#1D1F24]"
      }`}
    >
      {message.type === "TEXT" ? (
        <Text className={`text-[16px] ${mine ? "text-white" : "text-[#E5E2E1]"}`}>
          {message.body}
        </Text>
      ) : null}

      {message.type === "IMAGE" && mediaUrl ? (
        <View className="h-52 w-56 overflow-hidden rounded-[14px] bg-[#2D2A33]">
          {/* o rotulo do balao ja descreve a imagem: aqui ela e decorativa */}
          <AuthenticatedRemoteImage
            authToken={authToken}
            className="h-full w-full"
            fallback={
              <View className="flex-1 items-center justify-center">
                <Ionicons name="image-outline" size={32} color="#CAC3D8" />
              </View>
            }
            resizeMode="cover"
            uri={mediaUrl}
          />
        </View>
      ) : null}

      {message.type === "AUDIO" && mediaUrl ? (
        <AudioMessagePlayer
          authToken={authToken}
          durationSeconds={message.mediaDurationSeconds}
          messageId={message.id}
          mine={mine}
          uri={mediaUrl}
        />
      ) : null}

      {message.type === "VIDEO" ? (
        <Text className="text-[14px] font-semibold text-[#FFD28A]">
          Vídeo ainda não é suportado nesta versão.
        </Text>
      ) : null}

      {message.body && message.type !== "TEXT" ? (
        <Text className={`mt-2 text-[14px] ${mine ? "text-white/90" : "text-[#CAC3D8]"}`}>
          {message.body}
        </Text>
      ) : null}

      {/* metadados visuais — ja cobertos pelo accessibilityLabel do balao */}
      <View
        className="mt-1 flex-row items-center justify-end gap-1"
        importantForAccessibility="no-hide-descendants"
      >
        <Text className={`text-[11px] ${mine ? "text-white/70" : "text-[#9F96B8]"}`}>
          {new Date(message.createdAt).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
        {mine ? (
          <Ionicons
            name={message.readAt ? "checkmark-done" : "checkmark"}
            size={14}
            color={message.readAt ? "#EAEA00" : "rgba(255,255,255,0.7)"}
          />
        ) : null}
      </View>
    </View>
  );
}
