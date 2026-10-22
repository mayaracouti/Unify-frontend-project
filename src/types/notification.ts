import type { PageResponse } from "./pagination";

/**
 * Espelha `NotificationType` do backend. O significado de `referenceId` e
 * `contextId` por tipo (contrato do deep link) esta documentado em
 * `src/utils/notificationNavigation.ts`.
 */
export type NotificationType =
  | "NEW_MATCH"
  | "NEW_MESSAGE"
  | "NEW_FOLLOWER"
  | "FOLLOW_REQUEST"
  | "FOLLOW_REQUEST_ACCEPTED"
  | "POST_LIKED"
  | "POST_COMMENTED"
  | "COMMUNITY_POST"
  | "REPORT_UPDATE"
  | "POST_REMOVED";

export interface NotificationActor {
  userId: string;
  userProfileId: string | null;
  name: string;
  /** Caminho autenticado relativo; nulo quando a pessoa nao tem foto. */
  avatarUrl: string | null;
}

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  referenceId: string | null;
  contextId: string | null;
  title: string;
  body: string;
  /** Mensagens nao lidas da mesma conversa agrupadas nesta notificacao. */
  eventCount: number;
  read: boolean;
  createdAt: string;
  actor: NotificationActor | null;
}

export type NotificationPageResponse = PageResponse<NotificationResponse>;

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface MarkAllReadResponse {
  updatedCount: number;
}

export type PushPlatform = "ANDROID" | "IOS";

export interface PushTokenRegisterRequest {
  /** Token NATIVO do FCM (`getDevicePushTokenAsync`), nao ExpoPushToken. */
  token: string;
  platform: PushPlatform;
}

export interface PushTokenResponse {
  id: string;
  platform: PushPlatform;
  updatedAt: string;
}

/**
 * O que chega em `content.data` de um push (o backend manda tudo como texto).
 * Tambem e o formato minimo que a navegacao precisa — a lista in-app monta o
 * mesmo objeto a partir de `NotificationResponse`.
 */
export interface NotificationTargetData {
  type?: string | null;
  referenceId?: string | null;
  contextId?: string | null;
  notificationId?: string | null;
  /** So da lista in-app: nome para o cabecalho do chat/perfil. */
  actorName?: string | null;
}
