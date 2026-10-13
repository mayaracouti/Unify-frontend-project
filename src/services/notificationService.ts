import { customApiCall } from "../api/customApi";
import type {
  MarkAllReadResponse,
  NotificationPageResponse,
  NotificationResponse,
  PushTokenRegisterRequest,
  PushTokenResponse,
  UnreadCountResponse,
} from "../types/notification";

const NOTIFICATIONS_ENDPOINT = "/notifications";

function encodePathSegment(value: string) {
  return encodeURIComponent(value.trim());
}

export const notificationService = {
  getPage(args?: { page?: number; size?: number }) {
    return customApiCall.get<NotificationPageResponse>(
      NOTIFICATIONS_ENDPOINT,
      { page: args?.page ?? 0, size: args?.size ?? 20 },
      { requiresAuth: true }
    );
  },

  /** Badge do sino: silencioso (informacao secundaria nunca gera toast). */
  getUnreadCount() {
    return customApiCall.get<UnreadCountResponse>(
      `${NOTIFICATIONS_ENDPOINT}/unread-count`,
      undefined,
      { requiresAuth: true, suppressErrorToast: true }
    );
  },

  /** 404 quando a notificacao nao e minha (ou sumiu): quem chama decide o aviso. */
  markAsRead(notificationId: string) {
    return customApiCall.put<NotificationResponse>(
      `${NOTIFICATIONS_ENDPOINT}/${encodePathSegment(notificationId)}/read`,
      undefined,
      { requiresAuth: true, suppressErrorToast: true }
    );
  },

  markAllAsRead() {
    return customApiCall.put<MarkAllReadResponse>(
      `${NOTIFICATIONS_ENDPOINT}/read-all`,
      undefined,
      { requiresAuth: true }
    );
  },

  /** Idempotente: o mesmo token so troca de dono no backend. */
  registerPushToken(payload: PushTokenRegisterRequest) {
    return customApiCall.post<PushTokenResponse, PushTokenRegisterRequest>(
      `${NOTIFICATIONS_ENDPOINT}/push-tokens`,
      payload,
      { requiresAuth: true, suppressErrorToast: true }
    );
  },

  /** Pelo `id` devolvido no registro: o token nunca vai na URL. */
  removePushToken(pushTokenId: string) {
    return customApiCall.delete<void>(
      `${NOTIFICATIONS_ENDPOINT}/push-tokens/${encodePathSegment(pushTokenId)}`,
      { requiresAuth: true, suppressErrorToast: true }
    );
  },
};
