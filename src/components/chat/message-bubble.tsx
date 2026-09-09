import Ionicons from "@expo/vector-icons/Ionicons";
import { memo } from "react";
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  Pressable,
  Text,
  View,
} from "react-native";

import { chatService } from "../../services/chatService";
import type { ChatDeliveryStatus, ChatMessageResponse } from "../../types/chat";
import { describeAudioMessage, formatTimeForSpeech } from "../../utils/chatFormatting";
import { AuthenticatedRemoteImage } from "../profile/authenticated-remote-image";
import { AudioMessagePlayer } from "./audio-message-player";

/** Acao pedida sobre uma mensagem minha: abrir o menu (toque longo) ou um atalho direto. */
export type MessageAction = "menu" | "edit" | "delete";

const STATUS_ICON: Record<ChatDeliveryStatus, keyof typeof Ionicons.glyphMap> = {
  sent: "paper-plane-outline",
  delivered: "checkmark-circle",
  read: "eye",
};

const STATUS_COLOR: Record<ChatDeliveryStatus, string> = {
  sent: "rgba(255,255,255,0.6)",
  delivered: "rgba(255,255,255,0.9)",
  read: "#EAEA00",
};

const STATUS_SPEECH: Record<ChatDeliveryStatus, string> = {
  sent: "Enviada.",
  delivered: "Entregue.",
  read: "Vista.",
};

export function resolveDeliveryStatus(message: ChatMessageResponse): ChatDeliveryStatus {
  if (message.readAt) {
    return "read";
  }
  if (message.deliveredAt) {
    return "delivered";
  }
  return "sent";
}

/**
 * Rotulo completo da mensagem para o leitor de tela.
 * Formato: "Mensagem de <quem> <quando>. <conteudo>. <editada>. <status de leitura>"
 */
function buildMessageAccessibilityLabel(
  message: ChatMessageResponse,
  otherName: string
): string {
  const author = message.fromMe ? "Você" : otherName;
  const when = formatTimeForSpeech(message.createdAt);

  const content = message.deletedAt
    ? "Mensagem apagada"
    : message.type === "TEXT"
      ? message.body ?? ""
      : message.type === "IMAGE"
        ? `Imagem${message.body ? `. Legenda: ${message.body}` : ""}`
        : message.type === "AUDIO"
          ? describeAudioMessage(message.mediaDurationSeconds)
          : "Vídeo";

  const edited = message.editedAt && !message.deletedAt ? "Editada." : "";
  const readStatus =
    message.fromMe && !message.deletedAt ? STATUS_SPEECH[resolveDeliveryStatus(message)] : "";

  return `Mensagem de ${author} ${when}. ${content}. ${edited} ${readStatus}`
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Balao de mensagem. `memo` com comparacao rasa padrao: o polling do chat
 * substitui apenas as mensagens que mudaram, entao as demais nao repintam.
 */
export const MessageBubble = memo(function MessageBubble({
  authToken,
  message,
  onMessageAction,
  onOpenImage,
  otherName,
}: {
  authToken: string | null;
  message: ChatMessageResponse;
  /** Presente = a mensagem e minha e pode ser editada/apagada. */
  onMessageAction?: (message: ChatMessageResponse, action: MessageAction) => void;
  onOpenImage?: (uri: string, accessibilityLabel: string) => void;
  otherName: string;
}) {
  const mine = message.fromMe;
  const deleted = Boolean(message.deletedAt);
  const mediaUrl = deleted ? null : chatService.resolveAssetUrl(message.mediaUrl);
  const label = buildMessageAccessibilityLabel(message, otherName);
  const canAct = mine && !deleted && Boolean(onMessageAction);

  // Toque longo e inacessivel para leitor de tela e limitacao motora: as mesmas
  // acoes ficam expostas como acoes de acessibilidade (menu de acoes do TalkBack /
  // rotor do VoiceOver) no elemento focavel de cada tipo de mensagem.
  const accessibilityActions: AccessibilityActionInfo[] | undefined = canAct
    ? [
        ...(message.type === "TEXT" ? [{ name: "edit", label: "Editar mensagem" }] : []),
        { name: "delete", label: "Apagar mensagem" },
      ]
    : undefined;

  const handleAccessibilityAction = canAct
    ? (event: AccessibilityActionEvent) => {
        const name = event.nativeEvent.actionName;
        if (name === "edit" || name === "delete") {
          onMessageAction?.(message, name);
        } else if (name === "longpress") {
          onMessageAction?.(message, "menu");
        }
      }
    : undefined;

  const openMenu = canAct ? () => onMessageAction?.(message, "menu") : undefined;
  const actionHint = canAct ? "Toque e segure para editar ou apagar" : undefined;

  const bubbleClassName = `mb-3 max-w-[82%] rounded-[20px] px-4 py-3 ${
    mine ? "self-end bg-[#7C4DFF]" : "self-start bg-[#1D1F24]"
  }`;

  const imageLabel = `Imagem enviada por ${mine ? "você" : otherName}${
    message.body ? `. Legenda: ${message.body}` : ""
  }`;

  // Mensagens de texto e apagadas nao tem controles internos: o balao inteiro e
  // o elemento focavel, e o toque longo fica nele.
  const wholeBubbleFocusable = deleted || message.type === "TEXT" || message.type === "VIDEO";

  return (
    <Pressable
      accessible={wholeBubbleFocusable}
      accessibilityRole={wholeBubbleFocusable ? "text" : undefined}
      accessibilityLabel={wholeBubbleFocusable ? label : undefined}
      accessibilityHint={wholeBubbleFocusable ? actionHint : undefined}
      accessibilityActions={wholeBubbleFocusable ? accessibilityActions : undefined}
      onAccessibilityAction={wholeBubbleFocusable ? handleAccessibilityAction : undefined}
      className={bubbleClassName}
      delayLongPress={350}
      onLongPress={openMenu}
    >
      {deleted ? (
        <View className="flex-row items-center gap-2">
          <Ionicons
            name="ban-outline"
            size={16}
            color={mine ? "rgba(255,255,255,0.75)" : "#9F96B8"}
            importantForAccessibility="no"
          />
          <Text
            className={`text-[15px] italic ${mine ? "text-white/80" : "text-[#9F96B8]"}`}
          >
            Mensagem apagada
          </Text>
        </View>
      ) : null}

      {!deleted && message.type === "TEXT" ? (
        <Text className={`text-[16px] ${mine ? "text-white" : "text-[#E5E2E1]"}`}>
          {message.body}
        </Text>
      ) : null}

      {!deleted && message.type === "IMAGE" && mediaUrl ? (
        <Pressable
          accessible
          accessibilityRole="imagebutton"
          accessibilityLabel={label}
          accessibilityHint={
            canAct
              ? "Toque para abrir em tela cheia. Toque e segure para apagar"
              : "Toque para abrir em tela cheia"
          }
          accessibilityActions={accessibilityActions}
          onAccessibilityAction={handleAccessibilityAction}
          className="h-52 w-56 overflow-hidden rounded-[14px] bg-[#2D2A33]"
          delayLongPress={350}
          onLongPress={openMenu}
          onPress={() => onOpenImage?.(mediaUrl, imageLabel)}
        >
          {/* o rotulo do botao ja descreve a imagem: aqui ela e decorativa */}
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
          <View
            className="absolute bottom-2 right-2 h-8 w-8 items-center justify-center rounded-full bg-black/55"
            importantForAccessibility="no-hide-descendants"
          >
            <Ionicons name="expand-outline" size={16} color="#FFFFFF" />
          </View>
        </Pressable>
      ) : null}

      {!deleted && message.type === "AUDIO" && mediaUrl ? (
        <AudioMessagePlayer
          accessibilityActions={accessibilityActions}
          messageLabel={label}
          authToken={authToken}
          durationSeconds={message.mediaDurationSeconds}
          messageId={message.id}
          mine={mine}
          onAccessibilityAction={handleAccessibilityAction}
          onLongPress={openMenu}
          uri={mediaUrl}
        />
      ) : null}

      {!deleted && message.type === "VIDEO" ? (
        <Text className="text-[14px] font-semibold text-[#FFD28A]">
          Vídeo ainda não é suportado nesta versão.
        </Text>
      ) : null}

      {!deleted && message.body && message.type !== "TEXT" ? (
        <Text className={`mt-2 text-[14px] ${mine ? "text-white/90" : "text-[#CAC3D8]"}`}>
          {message.body}
        </Text>
      ) : null}

      {/* metadados visuais — ja cobertos pelo accessibilityLabel do balao */}
      <View
        className="mt-1 flex-row items-center justify-end gap-1"
        importantForAccessibility="no-hide-descendants"
      >
        {message.editedAt && !deleted ? (
          <Text className={`text-[11px] italic ${mine ? "text-white/70" : "text-[#9F96B8]"}`}>
            editada ·
          </Text>
        ) : null}
        <Text className={`text-[11px] ${mine ? "text-white/70" : "text-[#9F96B8]"}`}>
          {new Date(message.createdAt).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
        {mine && !deleted ? (
          <Ionicons
            name={STATUS_ICON[resolveDeliveryStatus(message)]}
            size={14}
            color={STATUS_COLOR[resolveDeliveryStatus(message)]}
          />
        ) : null}
      </View>
    </Pressable>
  );
});
