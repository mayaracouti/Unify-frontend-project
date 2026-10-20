import type { UserProfileImageResponse } from "./profile";

export type ChatMessageType = "TEXT" | "IMAGE" | "AUDIO" | "VIDEO";

export interface ChatMessagePreviewResponse {
  id: string;
  type: ChatMessageType;
  preview: string;
  fromMe: boolean;
  createdAt: string;
}

export interface ConversationSummaryResponse {
  conversationId: string;
  matchId: string | null;
  otherUserId: string | null;
  otherUserProfileId: string | null;
  otherUserName: string | null;
  otherUserPhoto: UserProfileImageResponse | null;
  lastMessage: ChatMessagePreviewResponse | null;
  unreadCount: number;
  lastMessageAt: string | null;
}

export interface ConversationListResponse {
  conversations: ConversationSummaryResponse[];
  totalUnread: number;
  serverTime: string;
}

export interface ConversationResponse {
  conversationId: string;
  matchId: string | null;
  otherUserId: string | null;
  otherUserProfileId: string | null;
  otherUserName: string | null;
  otherUserAge: number | null;
  otherUserPhoto: UserProfileImageResponse | null;
  createdAt: string;
  lastMessageAt: string | null;
}

export interface ChatMessageResponse {
  id: string;
  conversationId: string;
  senderUserProfileId: string | null;
  senderName: string | null;
  fromMe: boolean;
  type: ChatMessageType;
  /** Nulo em mídia sem legenda e em mensagens apagadas. */
  body: string | null;
  /** Nulo em TEXT e em mensagens apagadas. */
  mediaUrl: string | null;
  mediaContentType: string | null;
  mediaSizeBytes: number | null;
  mediaDurationSeconds: number | null;
  createdAt: string;
  /** Destinatario buscou a mensagem (estado "entregue"). Nulo = so enviada. */
  deliveredAt: string | null;
  /** Destinatario abriu a conversa (estado "vista"). */
  readAt: string | null;
  /** Texto alterado pelo remetente depois de enviar. */
  editedAt: string | null;
  /** Exclusao logica: a linha fica no historico como "Mensagem apagada". */
  deletedAt: string | null;
  /** Citacao da mensagem respondida (estilo WhatsApp). Nulo = mensagem solta. */
  replyTo?: ChatMessageReplyResponse | null;
}

/**
 * Citacao montada pelo backend a partir da mensagem original no momento da
 * leitura: edicao e exclusao da original aparecem aqui.
 */
export interface ChatMessageReplyResponse {
  id: string;
  senderUserProfileId: string | null;
  senderName: string | null;
  fromMe: boolean;
  type: ChatMessageType;
  /** Texto ou legenda truncado. Nulo em midia sem legenda e em mensagem apagada. */
  preview: string | null;
  mediaDurationSeconds: number | null;
  deleted: boolean;
}

/** Estado do indicador ao lado do horario nas mensagens enviadas por mim. */
export type ChatDeliveryStatus = "sent" | "delivered" | "read";

export interface ChatMessagePageResponse {
  messages: ChatMessageResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  unreadCount: number;
  serverTime: string;
}

export interface ChatMessageCreateRequest {
  body: string;
  /** Mensagem da mesma conversa que esta responde. */
  replyToMessageId?: string;
}

export interface ChatReadResponse {
  conversationId: string;
  markedCount: number;
  readAt: string;
}

/** Midia pronta para upload, montada pela tela a partir do picker/gravador. */
export interface ChatMediaUpload {
  type: Extract<ChatMessageType, "IMAGE" | "AUDIO">;
  uri: string;
  name: string;
  mimeType: string;
  durationSeconds?: number;
  caption?: string;
  /** Mensagem da mesma conversa que esta midia responde. */
  replyToMessageId?: string;
  /** Arquivo do seletor web; no celular o upload usa uri/name/mimeType. */
  file?: File;
}
