import { customApiCall } from "../api/customApi";
import { runtimeConfig } from "../config/runtime";
import type {
  CommunityDirectoryResponse,
  CommunityCommentResponse,
  CommunityCommentsResponse,
  CommunityCreateCommentRequest,
  CommunityFeedResponse,
  CommunityLikeResponse,
  CommunityMembersResponse,
  CommunityMemberRoleResponse,
  CommunityMemberRoleUpdateRequest,
  CommunityMembershipResponse,
  CommunityPostResponse,
  CommunitySummaryResponse,
} from "../types/community";

const COMMUNITIES_ENDPOINT = "/communities";
const COMMUNITY_FEED_ENDPOINT = "/communities/feed";
const COMMUNITY_MEMBERSHIP_ENDPOINT = "/communities/membership";
const COMMUNITY_POSTS_ENDPOINT = "/communities/posts";

function resolveCommunityAssetUrl(relativeUrl?: string | null) {
  if (!relativeUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(relativeUrl)) {
    return relativeUrl;
  }

  const normalizedBaseUrl = runtimeConfig.apiBaseUrl.endsWith("/")
    ? runtimeConfig.apiBaseUrl.slice(0, -1)
    : runtimeConfig.apiBaseUrl;

  const normalizedPath = relativeUrl.startsWith("/")
    ? relativeUrl
    : `/${relativeUrl}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value.trim());
}

function appendQueryParams(
  path: string,
  queryParams: Record<string, string | number | null | undefined>
) {
  const searchParams = new URLSearchParams();

  Object.entries(queryParams).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    const normalizedValue = typeof value === "string" ? value.trim() : String(value);

    if (!normalizedValue) {
      return;
    }

    searchParams.set(key, normalizedValue);
  });

  const queryString = searchParams.toString();

  return queryString ? `${path}?${queryString}` : path;
}

export const communityService = {
  listCommunities(args?: { page?: number; size?: number }) {
    return customApiCall.get<CommunityDirectoryResponse>(COMMUNITIES_ENDPOINT, {
      page: args?.page ?? 0,
      size: args?.size ?? 20,
    }, {
      requiresAuth: true,
    });
  },

  searchCommunities(query: string, args?: { page?: number; size?: number }) {
    return customApiCall.get<CommunityDirectoryResponse>(`${COMMUNITIES_ENDPOINT}/search`, {
      query,
      page: args?.page ?? 0,
      size: args?.size ?? 20,
    }, {
      requiresAuth: true,
    });
  },

  createCommunity(formData: FormData) {
    return customApiCall.post<CommunitySummaryResponse, FormData>(
      COMMUNITIES_ENDPOINT,
      formData,
      { requiresAuth: true }
    );
  },

  deleteCommunity(communityId: string) {
    return customApiCall.delete<void>(
      `${COMMUNITIES_ENDPOINT}/${encodePathSegment(communityId)}`,
      { requiresAuth: true }
    );
  },

  getFeed(communityId?: string | null) {
    return customApiCall.get<CommunityFeedResponse>(
      COMMUNITY_FEED_ENDPOINT,
      communityId ? { communityId } : undefined,
      { requiresAuth: true }
    );
  },

  joinCommunity(communityId: string) {
    return customApiCall.post<CommunityMembershipResponse>(
      appendQueryParams(COMMUNITY_MEMBERSHIP_ENDPOINT, { communityId }),
      undefined,
      { requiresAuth: true }
    );
  },

  leaveCommunity(communityId: string) {
    return customApiCall.delete<CommunityMembershipResponse>(
      appendQueryParams(COMMUNITY_MEMBERSHIP_ENDPOINT, { communityId }),
      { requiresAuth: true }
    );
  },

  getMembers(communityId: string) {
    return customApiCall.get<CommunityMembersResponse>(
      `${COMMUNITIES_ENDPOINT}/${encodePathSegment(communityId)}/members`,
      undefined,
      { requiresAuth: true }
    );
  },

  updateMemberRole(
    communityId: string,
    userProfileId: string,
    payload: CommunityMemberRoleUpdateRequest
  ) {
    return customApiCall.put<
      CommunityMemberRoleResponse,
      CommunityMemberRoleUpdateRequest
    >(
      `${COMMUNITIES_ENDPOINT}/${encodePathSegment(communityId)}/members/${encodePathSegment(userProfileId)}/role`,
      payload,
      { requiresAuth: true }
    );
  },

  createPost(communityId: string, formData: FormData) {
    return customApiCall.post<CommunityPostResponse, FormData>(
      appendQueryParams(COMMUNITY_POSTS_ENDPOINT, { communityId }),
      formData,
      { requiresAuth: true }
    );
  },

  deletePost(postId: string) {
    return customApiCall.delete<void>(
      `${COMMUNITY_POSTS_ENDPOINT}/${encodePathSegment(postId)}`,
      { requiresAuth: true }
    );
  },

  likePost(postId: string) {
    return customApiCall.post<CommunityLikeResponse>(
      `${COMMUNITY_POSTS_ENDPOINT}/${encodePathSegment(postId)}/likes`,
      undefined,
      { requiresAuth: true }
    );
  },

  unlikePost(postId: string) {
    return customApiCall.delete<CommunityLikeResponse>(
      `${COMMUNITY_POSTS_ENDPOINT}/${encodePathSegment(postId)}/likes`,
      { requiresAuth: true }
    );
  },

  removeLike(postId: string, userId: string) {
    return customApiCall.delete<CommunityLikeResponse>(
      `${COMMUNITY_POSTS_ENDPOINT}/${encodePathSegment(postId)}/likes/${encodePathSegment(userId)}`,
      { requiresAuth: true }
    );
  },

  getComments(postId: string) {
    return customApiCall.get<CommunityCommentsResponse>(
      `${COMMUNITY_POSTS_ENDPOINT}/${encodePathSegment(postId)}/comments`,
      undefined,
      { requiresAuth: true }
    );
  },

  createComment(postId: string, payload: CommunityCreateCommentRequest) {
    return customApiCall.post<CommunityCommentResponse, CommunityCreateCommentRequest>(
      `${COMMUNITY_POSTS_ENDPOINT}/${encodePathSegment(postId)}/comments`,
      payload,
      { requiresAuth: true }
    );
  },

  deleteComment(postId: string, commentId: string) {
    return customApiCall.delete<void>(
      `${COMMUNITY_POSTS_ENDPOINT}/${encodePathSegment(postId)}/comments/${encodePathSegment(commentId)}`,
      { requiresAuth: true }
    );
  },

  resolveAssetUrl: resolveCommunityAssetUrl,
};
