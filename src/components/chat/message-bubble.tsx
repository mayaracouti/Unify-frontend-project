import Ionicons from "@expo/vector-icons/Ionicons";
import { memo, useCallback, useRef } from "react";
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

import { useOnDemandSpeech } from "../../accessibility/tts";
import { chatService } from "../../services/chatService";
import { useAccessibility } from "../../context/AccessibilityContext";
import type {
  ChatDeliveryStatus,
  ChatMessageReplyResponse,
  ChatMessageResponse,
} from "../../types/chat";
import { describeAudioMessage, formatTimeForSpeech } from "../../utils/chatFormatting";
import { describeChatImage } from "../../utils/chatImageDescription";
import {
  describeReplyForSpeech,
  describeReplyQuote,
  replyQuoteAuthor,
} from "../../utils/chatReply";
import { AuthenticatedRemoteImage } from "../profile/authenticated-remote-image";
import { AudioMessagePlayer } from "./audio-message-player";
import type { BubbleAnchor } from "./message-context-menu";
import { SwipeToReply } from "./swipe-to-reply";

/**
 * Acao pedida sobre uma mensagem: abrir o menu de contexto (toque longo, com
 * o retangulo do balao para ancorar o menu), responder (puxao ou atalho),
 * ir ate a mensagem citada, ou os atalhos de editar/apagar (so as minhas).
 */
export type MessageAction = "menu" | "reply" | "jump-to-reply" | "edit" | "delete";

/** Destaque da linha inteira (borda a borda da lista) ao pular para a mensagem. */
const HIGHLIGHT_ROW_STYLE = {
  backgroundColor: "rgba(234,234,0,0.14)",
  marginHorizontal: -16,
  paddingHorizontal: 16,
  paddingTop: 6,
  marginTop: -6,
} as const;

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
 * Formato: "Mensagem de <quem> <quando>. <em resposta a>. <conteudo>. <editada>. <status de leitura>"
 */
export function buildMessageAccessibilityLabel(
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
        ? describeChatImage(message.body)
        : message.type === "AUDIO"
          ? describeAudioMessage(message.mediaDurationSeconds)
          : "Vídeo";

  const reply =
    message.replyTo && !message.deletedAt
      ? `${describeReplyForSpeech(message.replyTo, otherName)}.`
      : "";
  const edited = message.editedAt && !message.deletedAt ? "Editada." : "";
  const readStatus =
    message.fromMe && !message.deletedAt ? STATUS_SPEECH[resolveDeliveryStatus(message)] : "";

  return `Mensagem de ${author} ${when}. ${reply} ${content}. ${edited} ${readStatus}`
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "Ouvir mensagem" (plano 05, 5.9): le em voz alta a mensagem RECEBIDA — com
 * a leitura por voz do app desligada e tambem com TalkBack. Fica fora do
 * balao (irmao dele) porque o balao de texto e um unico elemento focavel:
 * um botao dentro dele ficaria inalcancavel para o leitor de tela.
 */
function ListenMessageButton({
  highContrast,
  messageId,
  otherName,
  text,
}: {
  highContrast: boolean;
  messageId: string;
  otherName: string;
  text: string;
}) {
  const { speaking, toggle } = useOnDemandSpeech(`chat-message:${messageId}`);

  return (
    <Pressable
      className={`h-11 w-11 items-center justify-center rounded-full ${
        highContrast ? "border border-hc-border bg-hc-surface" : "bg-[#2D2A33]"
      }`}
      accessibilityRole="button"
      accessibilityLabel={speaking ? "Parar leitura da mensagem" : `Ouvir mensagem de ${otherName}`}
      accessibilityHint={
        speaking ? "Interrompe a leitura em voz alta" : "Lê o conteúdo desta mensagem em voz alta"
      }
      accessibilityState={{ selected: speaking }}
      onPress={() => {
        toggle(`Mensagem de ${otherName}. ${text}`);
      }}
    >
      <Ionicons
        name={speaking ? "stop-circle" : "volume-high-outline"}
        size={20}
        color={speaking ? "#9B7BFF" : "#CAC3D8"}
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

/**
 * Citacao dentro do balao (mensagem respondida): barra lateral colorida,
 * autor e uma previa curta. Tocar leva ate a original na conversa.
 *
 * Em baloes de texto o balao inteiro e o elemento focavel, entao a citacao
 * entra no rotulo dele e "ver mensagem respondida" vira acao de
 * acessibilidade; em imagem/audio (com controles proprios) a citacao e
 * focavel sozinha.
 */
function ReplyQuote({
  focusable,
  highContrast,
  mine,
  onPress,
  otherName,
  quote,
}: {
  focusable: boolean;
  highContrast: boolean;
  /** O balao que CONTEM a citacao e meu (fundo roxo / amarelo no alto contraste). */
  mine: boolean;
  onPress?: () => void;
  otherName: string;
  quote: ChatMessageReplyResponse;
}) {
  const { icon, text } = describeReplyQuote(quote);
  const author = replyQuoteAuthor(quote, otherName);
  // Alto contraste: meu balao fica amarelo, entao a citacao dentro dele e preta.
  const onAccent = highContrast && mine;

  const barColor = onAccent ? "#000000" : quote.fromMe ? "#EAEA00" : "#CDBDFF";
  const authorClass = onAccent ? "text-black" : quote.fromMe ? "text-[#EAEA00]" : "text-[#CDBDFF]";
  const textClass = onAccent ? "text-black/80" : mine ? "text-white/85" : "text-[#CAC3D8]";
  const iconColor = onAccent ? "rgba(0,0,0,0.7)" : mine ? "rgba(255,255,255,0.8)" : "#9F96B8";
  const surfaceClass = highContrast
    ? onAccent
      ? "border border-black/40 bg-black/10"
      : "border border-hc-border bg-hc-bg"
    : mine
      ? "bg-black/20"
      : "bg-black/25";

  return (
    <Pressable
      accessible={focusable}
      accessibilityRole={focusable ? "button" : undefined}
      accessibilityLabel={focusable ? `${describeReplyForSpeech(quote, otherName)}.` : undefined}
      accessibilityHint={focusable ? "Mostra a mensagem original na conversa" : undefined}
      importantForAccessibility={focusable ? "yes" : "no-hide-descendants"}
      className={`mb-2 flex-row overflow-hidden rounded-[12px] ${surfaceClass}`}
      onPress={onPress}
    >
      <View style={{ width: 4, backgroundColor: barColor }} />
      <View className="shrink px-3 py-2">
        <Text className={`text-[13px] font-bold ${authorClass}`} numberOfLines={1}>
          {author}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-1">
          {icon ? <Ionicons name={icon} size={14} color={iconColor} /> : null}
          <Text
            className={`shrink text-[13px] ${textClass} ${quote.deleted ? "italic" : ""}`}
            numberOfLines={2}
          >
            {text}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Balao de mensagem. `memo` com comparacao rasa padrao: o polling do chat
 * substitui apenas as mensagens que mudaram, entao as demais nao repintam.
 */
export const MessageBubble = memo(function MessageBubble({
  authToken,
  highlighted = false,
  message,
  onMessageAction,
  onOpenImage,
  otherName,
  replyEnabled = true,
}: {
  authToken: string | null;
  /** Destaque breve ao chegar aqui tocando numa citacao. */
  highlighted?: boolean;
  message: ChatMessageResponse;
  /** Ausente = mensagem so de leitura (sem menu, sem responder). */
  onMessageAction?: (
    message: ChatMessageResponse,
    action: MessageAction,
    anchor?: BubbleAnchor
  ) => void;
  onOpenImage?: (uri: string, accessibilityLabel: string) => void;
  otherName: string;
  /** Falso com envio travado (bloqueio): nao da para responder. */
  replyEnabled?: boolean;
}) {
  const { settings } = useAccessibility();
  const mine = message.fromMe;
  const deleted = Boolean(message.deletedAt);
  const mediaUrl = deleted ? null : chatService.resolveAssetUrl(message.mediaUrl);
  const label = buildMessageAccessibilityLabel(message, otherName);
  const canReply = !deleted && replyEnabled && Boolean(onMessageAction);
  const canEditOrDelete = mine && !deleted && Boolean(onMessageAction);
  const canOpenMenu = canReply || canEditOrDelete;
  const quote = deleted ? null : message.replyTo ?? null;
  const bubbleRef = useRef<View | null>(null);

  // Toque longo e puxao sao inacessiveis para leitor de tela e limitacao
  // motora: as mesmas acoes ficam expostas como acoes de acessibilidade (menu
  // de acoes do TalkBack / rotor do VoiceOver) no elemento focavel de cada tipo.
  const accessibilityActions: AccessibilityActionInfo[] | undefined =
    canOpenMenu || quote
      ? [
          ...(canReply ? [{ name: "reply", label: "Responder mensagem" }] : []),
          ...(quote ? [{ name: "jump-to-reply", label: "Ver mensagem respondida" }] : []),
          ...(canEditOrDelete && message.type === "TEXT"
            ? [{ name: "edit", label: "Editar mensagem" }]
            : []),
          ...(canEditOrDelete ? [{ name: "delete", label: "Apagar mensagem" }] : []),
        ]
      : undefined;

  // O menu nasce do balao: mede o retangulo dele na tela antes de abrir.
  // `measure` (pageX/pageY) e nao `measureInWindow`, que no Android desconta
  // a status bar e desalinha com o Modal translucido. Na web o `measure` do
  // react-native-web soma offsets e ignora o scaleY(-1) da lista `inverted`
  // (o retangulo sai espelhado): la vale o retangulo real do DOM.
  const openMenu = useCallback(() => {
    const node = bubbleRef.current;
    if (!node) {
      onMessageAction?.(message, "menu");
      return;
    }
    if (Platform.OS === "web") {
      const rect = (node as unknown as HTMLElement).getBoundingClientRect?.();
      if (rect) {
        onMessageAction?.(message, "menu", {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });
        return;
      }
    }
    node.measure((_x, _y, width, height, pageX, pageY) => {
      onMessageAction?.(message, "menu", { x: pageX, y: pageY, width, height });
    });
  }, [message, onMessageAction]);

  const handleReply = useCallback(
    () => onMessageAction?.(message, "reply"),
    [message, onMessageAction]
  );

  const handleAccessibilityAction = accessibilityActions
    ? (event: AccessibilityActionEvent) => {
        const name = event.nativeEvent.actionName;
        if (name === "reply" || name === "jump-to-reply" || name === "edit" || name === "delete") {
          onMessageAction?.(message, name);
        } else if (name === "longpress" && canOpenMenu) {
          openMenu();
        }
      }
    : undefined;

  const onLongPress = canOpenMenu ? openMenu : undefined;
  const actionHint = canOpenMenu
    ? canEditOrDelete
      ? "Toque e segure para responder, editar ou apagar"
      : "Toque e segure para responder"
    : undefined;

  const bubbleClassName = `shrink rounded-[20px] px-4 py-3 ${
    mine
      ? settings.highContrast
        ? "bg-hc-accent"
        : "bg-[#7C4DFF]"
      : settings.highContrast
        ? "bg-hc-surface border border-hc-border"
        : "border border-[#3A3545] bg-[#2D2A33]"
  }`;

  // So mensagens recebidas com texto (corpo ou legenda) ganham "Ouvir".
  const listenText =
    !mine && !deleted && message.body?.trim() && message.type !== "AUDIO"
      ? message.body.trim()
      : null;

  // No alto contraste o balao proprio fica com fundo amarelo (hc-accent): texto
  // branco perderia contraste, entao usamos preto nesse caso.
  const ownTextClass = settings.highContrast ? "text-black" : "text-white";

  const imageLabel = `Imagem enviada por ${mine ? "você" : otherName}. ${describeChatImage(message.body)}`;

  // Mensagens de texto e apagadas nao tem controles internos: o balao inteiro e
  // o elemento focavel, e o toque longo fica nele.
  const wholeBubbleFocusable = deleted || message.type === "TEXT" || message.type === "VIDEO";

  return (
    <SwipeToReply
      direction={mine ? "left" : "right"}
      enabled={canReply}
      onReply={handleReply}
      style={highlighted ? HIGHLIGHT_ROW_STYLE : undefined}
    >
      <View
        className={`mb-3 max-w-[92%] flex-row items-center gap-2 ${
          mine ? "self-end" : "self-start"
        }`}
      >
        <Pressable
          ref={bubbleRef}
          accessible={wholeBubbleFocusable}
          accessibilityRole={wholeBubbleFocusable ? "text" : undefined}
          accessibilityLabel={wholeBubbleFocusable ? label : undefined}
          accessibilityHint={wholeBubbleFocusable ? actionHint : undefined}
          accessibilityActions={wholeBubbleFocusable ? accessibilityActions : undefined}
          onAccessibilityAction={wholeBubbleFocusable ? handleAccessibilityAction : undefined}
          className={bubbleClassName}
          delayLongPress={350}
          onLongPress={onLongPress}
        >
          {quote ? (
            <ReplyQuote
              focusable={!wholeBubbleFocusable}
              highContrast={settings.highContrast}
              mine={mine}
              onPress={() => onMessageAction?.(message, "jump-to-reply")}
              otherName={otherName}
              quote={quote}
            />
          ) : null}

          {deleted ? (
            <View className="flex-row items-center gap-2">
              <Ionicons
                name="ban-outline"
                size={16}
                color={mine ? "rgba(255,255,255,0.75)" : "#9F96B8"}
                importantForAccessibility="no"
              />
              <Text
                className={`text-[15px] italic ${
                  mine ? (settings.highContrast ? "text-black/80" : "text-white/80") : "text-[#9F96B8]"
                }`}
              >
                Mensagem apagada
              </Text>
            </View>
          ) : null}

          {!deleted && message.type === "TEXT" ? (
            <Text className={`text-[16px] ${mine ? ownTextClass : "text-[#E5E2E1]"}`}>
              {message.body}
            </Text>
          ) : null}

          {!deleted && message.type === "IMAGE" && mediaUrl ? (
            <Pressable
              accessible
              accessibilityRole="imagebutton"
              accessibilityLabel={label}
              accessibilityHint={
                actionHint
                  ? `Toque para abrir em tela cheia. ${actionHint}`
                  : "Toque para abrir em tela cheia"
              }
              accessibilityActions={accessibilityActions}
              onAccessibilityAction={handleAccessibilityAction}
              className="h-52 w-56 overflow-hidden rounded-[14px] bg-[#2D2A33]"
              delayLongPress={350}
              onLongPress={onLongPress}
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
              onLongPress={onLongPress}
              uri={mediaUrl}
            />
          ) : null}

          {!deleted && message.type === "VIDEO" ? (
            <Text className="text-[14px] font-semibold text-[#FFD28A]">
              Vídeo ainda não é suportado nesta versão.
            </Text>
          ) : null}

          {!deleted && message.body && message.type !== "TEXT" ? (
            <Text
              className={`mt-2 text-[14px] ${
                mine ? (settings.highContrast ? "text-black/90" : "text-white/90") : "text-[#CAC3D8]"
              }`}
            >
              {message.body}
            </Text>
          ) : null}

          {/* metadados visuais — ja cobertos pelo accessibilityLabel do balao */}
          <View
            className="mt-1 flex-row items-center justify-end gap-1"
            importantForAccessibility="no-hide-descendants"
          >
            {message.editedAt && !deleted ? (
              <Text
                className={`text-[11px] italic ${
                  mine ? (settings.highContrast ? "text-black/70" : "text-white/70") : "text-[#9F96B8]"
                }`}
              >
                editada ·
              </Text>
            ) : null}
            <Text
              className={`text-[11px] ${
                mine ? (settings.highContrast ? "text-black/70" : "text-white/70") : "text-[#9F96B8]"
              }`}
            >
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

        {listenText ? (
          <ListenMessageButton
            highContrast={settings.highContrast}
            messageId={message.id}
            otherName={otherName}
            text={listenText}
          />
        ) : null}
      </View>
    </SwipeToReply>
  );
});
