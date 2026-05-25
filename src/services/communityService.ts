import { customApiCall } from "../api/customApi";
import type { CommunityFeedResponse } from "../types/community";

const COMMUNITY_FEED_ENDPOINT = "/communities/feed";

export const communityService = {
  getFeed() {
    return customApiCall.get<CommunityFeedResponse>(
      COMMUNITY_FEED_ENDPOINT,
      undefined,
      { requiresAuth: true }
    );
  },
};
