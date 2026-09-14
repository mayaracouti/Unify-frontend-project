import { customApiCall } from "../api/customApi";
import { runtimeConfig } from "../config/runtime";
import type { UserFeedPageResponse, UserPostResponse } from "../types/social";

/**
 * Mesmo contrato de `communityService.resolveAssetUrl`/`chatService.resolveAssetUrl`:
 * o backend devolve caminhos relativos autenticados; aqui viram URL absoluta.
 */
function resolveFeedAssetUrl(relativeUrl?: string | null) {
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

export const feedService = {
  getFeed(args?: { page?: number; size?: number }) {
    return customApiCall.get<UserFeedPageResponse>(
      "/users/feed",
      { page: args?.page ?? 0, size: args?.size ?? 10 },
      { requiresAuth: true }
    );
  },

  getProfilePosts(userProfileId: string, args?: { page?: number; size?: number }) {
    return customApiCall.get<UserFeedPageResponse>(
      `/users/${encodeURIComponent(userProfileId.trim())}/posts`,
      { page: args?.page ?? 0, size: args?.size ?? 10 },
      { requiresAuth: true }
    );
  },

  createPost(formData: FormData) {
    return customApiCall.post<UserPostResponse, FormData>("/users/posts", formData, {
      requiresAuth: true,
    });
  },

  deletePost(postId: string) {
    return customApiCall.delete<void>(`/users/posts/${encodeURIComponent(postId)}`, {
      requiresAuth: true,
    });
  },

  resolveAssetUrl: resolveFeedAssetUrl,
};
