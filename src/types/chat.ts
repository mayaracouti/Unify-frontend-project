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
  body: string | null;
  mediaUrl: string | null;
  mediaContentType: string | null;
  mediaSizeBytes: number | null;
  mediaDurationSeconds: number | null;
  createdAt: string;
  readAt: string | null;
}

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
}
