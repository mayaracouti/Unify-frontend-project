import { customApiCall } from "../api/customApi";
import type {
  MatchCreateRequest,
  MatchDiscoveryRequest,
  MatchResponse,
  MutualMatchResponse,
} from "../types/match";

const MATCHES_ENDPOINT = "/users/me/matches";

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
};
