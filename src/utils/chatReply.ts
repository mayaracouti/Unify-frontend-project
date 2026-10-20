import type Ionicons from "@expo/vector-icons/Ionicons";

import type { ChatMessageReplyResponse, ChatMessageResponse } from "../types/chat";
import { describeAudioMessage, formatAudioClock } from "./chatFormatting";

/** Mesmo corte do backend (PREVIEW_MAX_LENGTH): a citacao local bate com a do servidor. */
const REPLY_PREVIEW_MAX_LENGTH = 120;
/** Legenda de imagem que e descricao de acessibilidade (ver chatImageDescription). */
const IMAGE_DESCRIPTION_PREFIX = "Descrição da imagem: ";

function truncate(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length <= REPLY_PREVIEW_MAX_LENGTH
    ? trimmed
    : trimmed.slice(0, REPLY_PREVIEW_MAX_LENGTH);
}

/**
 * Citacao montada no cliente a partir da mensagem original — mesmo formato
 * que o backend devolve em `replyTo`. Usada na barra "Respondendo a" do
 * compositor e para atualizar citacoes quando a original muda no polling.
 */
export function buildReplyQuote(message: ChatMessageResponse): ChatMessageReplyResponse {
  const deleted = Boolean(message.deletedAt);

  return {
    id: message.id,
    senderUserProfileId: message.senderUserProfileId,
    senderName: message.senderName,
    fromMe: message.fromMe,
    type: message.type,
    preview: deleted ? null : truncate(message.body),
    mediaDurationSeconds: deleted ? null : message.mediaDurationSeconds,
    deleted,
  };
}

function sameQuote(first: ChatMessageReplyResponse, second: ChatMessageReplyResponse) {
  return (
    first.id === second.id &&
    first.preview === second.preview &&
    first.deleted === second.deleted &&
    first.type === second.type &&
    first.mediaDurationSeconds === second.mediaDurationSeconds &&
    first.senderName === second.senderName
  );
}

/**
 * O polling traz a original editada/apagada, mas nao as respostas que a citam
 * (o `updatedAt` delas nao muda). Atualiza essas citacoes localmente. Devolve
 * a MESMA lista (e os mesmos objetos) quando nada muda, para nao repintar os
 * baloes memoizados.
 */
export function syncReplyQuotes(
  messages: ChatMessageResponse[],
  changed: ChatMessageResponse[]
): ChatMessageResponse[] {
  if (changed.length === 0) {
    return messages;
  }

  const changedById = new Map(changed.map((message) => [message.id, message]));
  let touched = false;

  const next = messages.map((message) => {
    const original = message.replyTo ? changedById.get(message.replyTo.id) : undefined;
    if (!original || !message.replyTo) {
      return message;
    }

    const quote = buildReplyQuote(original);
    if (sameQuote(quote, message.replyTo)) {
      return message;
    }

    touched = true;
    return { ...message, replyTo: quote };
  });

  return touched ? next : messages;
}

/** Quem escreveu a mensagem citada, do ponto de vista de quem le. */
export function replyQuoteAuthor(quote: ChatMessageReplyResponse, otherName: string): string {
  return quote.fromMe ? "Você" : otherName;
}

/** Linha visual da citacao: icone (midia/apagada) + texto curto. */
export function describeReplyQuote(quote: ChatMessageReplyResponse): {
  icon: keyof typeof Ionicons.glyphMap | null;
  text: string;
} {
  if (quote.deleted) {
    return { icon: "ban-outline", text: "Mensagem apagada" };
  }

  switch (quote.type) {
    case "IMAGE": {
      // Descricao de acessibilidade nao e legenda: na citacao fica so "Foto".
      const caption =
        quote.preview && !quote.preview.startsWith(IMAGE_DESCRIPTION_PREFIX) ? quote.preview : null;
      return { icon: "image-outline", text: caption ?? "Foto" };
    }
    case "AUDIO":
      return {
        icon: "mic-outline",
        text: quote.mediaDurationSeconds
          ? `Áudio (${formatAudioClock(quote.mediaDurationSeconds)})`
          : "Áudio",
      };
    case "VIDEO":
      return { icon: "videocam-outline", text: "Vídeo" };
    default:
      return { icon: null, text: quote.preview ?? "" };
  }
}

/**
 * Frase da citacao para o leitor de tela e o TTS:
 * "Em resposta à sua mensagem: bora no cinema?" /
 * "Em resposta à mensagem de Ana: Mensagem de áudio de 12 segundos".
 */
export function describeReplyForSpeech(
  quote: ChatMessageReplyResponse,
  otherName?: string | null
): string {
  const whose = quote.fromMe
    ? "à sua mensagem"
    : `à mensagem de ${otherName?.trim() || quote.senderName?.trim() || "outra pessoa"}`;

  let content: string;
  if (quote.deleted) {
    content = "mensagem apagada";
  } else if (quote.type === "AUDIO") {
    content = describeAudioMessage(quote.mediaDurationSeconds);
  } else if (quote.type === "IMAGE") {
    content = quote.preview ? `Imagem. ${quote.preview}` : "Imagem";
  } else {
    content = describeReplyQuote(quote).text;
  }

  return `Em resposta ${whose}: ${content}`;
}
