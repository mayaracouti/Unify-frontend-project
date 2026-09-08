import { customApiCall } from "../api/customApi";
import { runtimeConfig } from "../config/runtime";
import type {
  ChatMediaUpload,
  ChatMessageCreateRequest,
  ChatMessagePageResponse,
  ChatMessageResponse,
  ChatReadResponse,
  ConversationListResponse,
  ConversationResponse,
} from "../types/chat";

const CHATS_ENDPOINT = "/chats";

/** Upload de midia em rede movel precisa de folga sobre os 20s padrao do cliente. */
const MEDIA_UPLOAD_TIMEOUT_MS = 60000;

function resolveChatAssetUrl(relativeUrl?: string | null) {
  if (!relativeUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(relativeUrl)) {
    return relativeUrl;
  }

  const normalizedBaseUrl = runtimeConfig.apiBaseUrl.endsWith("/")
    ? runtimeConfig.apiBaseUrl.slice(0, -1)
    : runtimeConfig.apiBaseUrl;

  const normalizedPath = relativeUrl.startsWith("/") ? relativeUrl : `/${relativeUrl}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value.trim());
}

export const chatService = {
  listConversations() {
    return customApiCall.get<ConversationListResponse>(CHATS_ENDPOINT, undefined, {
      requiresAuth: true,
    });
  },

  /** Versao silenciosa usada pelo polling: nunca dispara toast global de erro. */
  pollConversations() {
    return customApiCall.get<ConversationListResponse>(CHATS_ENDPOINT, undefined, {
      requiresAuth: true,
      suppressErrorToast: true,
    });
  },

  // `customApiCall.post` nao aceita `params` (o tipo `RequestOptions` os remove),
  // entao a query vai na string da URL — mesmo padrao de
  // `communityService.joinCommunity`.
  openConversation(matchId: string) {
    return customApiCall.post<ConversationResponse>(
      `${CHATS_ENDPOINT}?matchId=${encodePathSegment(matchId)}`,
      undefined,
      { requiresAuth: true }
    );
  },

  getMessages(conversationId: string, params?: { page?: number; size?: number }) {
    return customApiCall.get<ChatMessagePageResponse>(
      `${CHATS_ENDPOINT}/${encodePathSegment(conversationId)}/messages`,
      { page: params?.page ?? 0, size: params?.size ?? 30 },
      { requiresAuth: true }
    );
  },

  /** Polling incremental: `since` e sempre o `serverTime` da resposta anterior. */
  getMessagesSince(conversationId: string, since: string) {
    return customApiCall.get<ChatMessagePageResponse>(
      `${CHATS_ENDPOINT}/${encodePathSegment(conversationId)}/messages`,
      { since },
      { requiresAuth: true, suppressErrorToast: true }
    );
  },

  sendTextMessage(conversationId: string, body: string) {
    return customApiCall.post<ChatMessageResponse, ChatMessageCreateRequest>(
      `${CHATS_ENDPOINT}/${encodePathSegment(conversationId)}/messages`,
      { body },
      { requiresAuth: true }
    );
  },

  sendMediaMessage(conversationId: string, media: ChatMediaUpload) {
    const formData = new FormData();

    formData.append("type", media.type);
    // React Native aceita este formato de arquivo em FormData. O interceptor de
    // request nao injeta `Content-Type` quando o body e FormData, entao o fetch
    // monta o boundary do multipart sozinho (mesmo caminho de
    // `communityService.createCommunity`).
    formData.append("file", {
      uri: media.uri,
      name: media.name,
      type: media.mimeType,
    } as unknown as Blob);

    if (media.caption?.trim()) {
      formData.append("caption", media.caption.trim());
    }

    if (typeof media.durationSeconds === "number") {
      formData.append("durationSeconds", String(Math.round(media.durationSeconds)));
    }

    return customApiCall.post<ChatMessageResponse, FormData>(
      `${CHATS_ENDPOINT}/${encodePathSegment(conversationId)}/messages/media`,
      formData,
      { requiresAuth: true, timeoutMs: MEDIA_UPLOAD_TIMEOUT_MS }
    );
  },

  markAsRead(conversationId: string) {
    return customApiCall.put<ChatReadResponse>(
      `${CHATS_ENDPOINT}/${encodePathSegment(conversationId)}/read`,
      undefined,
      { requiresAuth: true, suppressErrorToast: true }
    );
  },

  /** So o remetente edita, e so mensagens de texto. Devolve a mensagem com `editedAt`. */
  editMessage(conversationId: string, messageId: string, body: string) {
    return customApiCall.put<ChatMessageResponse, ChatMessageCreateRequest>(
      `${CHATS_ENDPOINT}/${encodePathSegment(conversationId)}/messages/${encodePathSegment(messageId)}`,
      { body },
      { requiresAuth: true, suppressErrorToast: true }
    );
  },

  /**
   * Exclusao logica: a mensagem continua no historico com `deletedAt` e sem
   * conteudo ("Mensagem apagada" para os dois lados).
   */
  deleteMessage(conversationId: string, messageId: string) {
    return customApiCall.delete<ChatMessageResponse>(
      `${CHATS_ENDPOINT}/${encodePathSegment(conversationId)}/messages/${encodePathSegment(messageId)}`,
      { requiresAuth: true, suppressErrorToast: true }
    );
  },

  resolveAssetUrl: resolveChatAssetUrl,
};
