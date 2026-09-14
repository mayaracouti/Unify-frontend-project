import { customApiCall } from "../api/customApi";
import type {
  FollowActionResponse,
  FollowPageResponse,
  FollowStatsResponse,
} from "../types/social";

function encodePathSegment(value: string) {
  return encodeURIComponent(value.trim());
}

export const followService = {
  follow(userProfileId: string) {
    return customApiCall.post<FollowActionResponse>(
      `/users/${encodePathSegment(userProfileId)}/follow`,
      undefined,
      { requiresAuth: true }
    );
  },

  unfollow(userProfileId: string) {
    return customApiCall.delete<FollowActionResponse>(
      `/users/${encodePathSegment(userProfileId)}/follow`,
      { requiresAuth: true }
    );
  },

  getFollowStats(userProfileId: string) {
    return customApiCall.get<FollowStatsResponse>(
      `/users/${encodePathSegment(userProfileId)}/follow-stats`,
      undefined,
      { requiresAuth: true }
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
};
