import { customApiCall } from "../api/customApi";
import type {
  FollowActionResponse,
  FollowPageResponse,
  FollowRequestPageResponse,
  FollowStatsResponse,
} from "../types/social";

function encodePathSegment(value: string) {
  return encodeURIComponent(value.trim());
}

export const followService = {
  /**
   * Segue direto, ou cria um pedido (idempotente) quando o alvo aprova
   * seguidores: o estado vem da resposta (`following` / `followRequested`).
   */
  follow(userProfileId: string) {
    return customApiCall.post<FollowActionResponse>(
      `/users/${encodePathSegment(userProfileId)}/follow`,
      undefined,
      { requiresAuth: true }
    );
  },

  /** Deixa de seguir E cancela o meu pedido pendente para esse perfil (idempotente). */
  unfollow(userProfileId: string) {
    return customApiCall.delete<FollowActionResponse>(
      `/users/${encodePathSegment(userProfileId)}/follow`,
      { requiresAuth: true }
    );
  },

  /** 404 quando ha bloqueio; `silent` evita o toast global (a tela trata). */
  getFollowStats(userProfileId: string, options?: { silent?: boolean }) {
    return customApiCall.get<FollowStatsResponse>(
      `/users/${encodePathSegment(userProfileId)}/follow-stats`,
      undefined,
      { requiresAuth: true, suppressErrorToast: options?.silent ?? false }
    );
  },

  listFollowing(args?: { page?: number; size?: number }) {
    return customApiCall.get<FollowPageResponse>(
      "/users/following",
      { page: args?.page ?? 0, size: args?.size ?? 20 },
      { requiresAuth: true }
    );
  },

  listFollowers(args?: { page?: number; size?: number }) {
    return customApiCall.get<FollowPageResponse>(
      "/users/followers",
      { page: args?.page ?? 0, size: args?.size ?? 20 },
      { requiresAuth: true }
    );
  },

  /**
   * Pedidos RECEBIDOS pendentes (a pessoa de cada item e quem pediu).
   * `silent` evita o toast global (ex.: so para contar os pendentes).
   */
  listFollowRequests(args?: { page?: number; size?: number; silent?: boolean }) {
    return customApiCall.get<FollowRequestPageResponse>(
      "/users/follow-requests",
      { page: args?.page ?? 0, size: args?.size ?? 20 },
      { requiresAuth: true, suppressErrorToast: args?.silent ?? false }
    );
  },

  /** Pedidos que EU enviei e seguem pendentes (a pessoa e quem eu pedi para seguir). */
  listSentFollowRequests(args?: { page?: number; size?: number }) {
    return customApiCall.get<FollowRequestPageResponse>(
      "/users/follow-requests/sent",
      { page: args?.page ?? 0, size: args?.size ?? 20 },
      { requiresAuth: true }
    );
  },

  /** 204: quem pediu passa a me seguir. 404 se o pedido nao existe ou nao e meu. */
  acceptFollowRequest(requestId: string) {
    return customApiCall.post<void>(
      `/users/follow-requests/${encodePathSegment(requestId)}/accept`,
      undefined,
      { requiresAuth: true }
    );
  },

  /** 204: recusa (destinatario) ou cancela (quem pediu). 404 para terceiros. */
  deleteFollowRequest(requestId: string) {
    return customApiCall.delete<void>(
      `/users/follow-requests/${encodePathSegment(requestId)}`,
      { requiresAuth: true }
    );
  },
};
