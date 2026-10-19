import { customApiCall } from "../api/customApi";
import type {
  MatchCreateRequest,
  MatchDiscoveryRequest,
  MatchResponse,
  MutualMatchPageResponse,
  MutualMatchResponse,
  MutualMatchSummaryResponse,
} from "../types/match";

const MATCHES_ENDPOINT = "/users/me/matches";

function encodePathSegment(value: string) {
  return encodeURIComponent(value.trim());
}

export const matchService = {
  getDiscoveryFeed(payload: MatchDiscoveryRequest = {}) {
    return customApiCall.post<string[], MatchDiscoveryRequest>(
      `${MATCHES_ENDPOINT}/discovery`,
      payload,
      { requiresAuth: true }
    );
  },

  createOrAnswerMatch(payload: MatchCreateRequest) {
    return customApiCall.post<MatchResponse, MatchCreateRequest>(
      MATCHES_ENDPOINT,
      payload,
      { requiresAuth: true }
    );
  },

  getMutualMatches() {
    return customApiCall.get<MutualMatchResponse[]>(
      `${MATCHES_ENDPOINT}/mutual`,
      undefined,
      { requiresAuth: true }
    );
  },

  getPagedMutualMatches(params?: { page?: number; size?: number }) {
    return customApiCall.get<MutualMatchPageResponse>(
      `${MATCHES_ENDPOINT}/mutual/paged`,
      params,
      { requiresAuth: true }
    );
  },

  /**
   * Fila da tela "Deu match" (mais antigo primeiro). Consultada em segundo
   * plano, entao nunca gera toast.
   */
  getUnseenMutualMatches() {
    return customApiCall.get<MutualMatchSummaryResponse[]>(
      `${MATCHES_ENDPOINT}/mutual/unseen`,
      undefined,
      { requiresAuth: true, suppressErrorToast: true }
    );
  },

  /** A tela "Deu match" deste par foi exibida: some da fila de vez. */
  markMutualMatchSeen(matchId: string) {
    return customApiCall.put<void>(
      `${MATCHES_ENDPOINT}/mutual/${encodePathSegment(matchId)}/seen`,
      undefined,
      { requiresAuth: true, suppressErrorToast: true }
    );
  },
};
