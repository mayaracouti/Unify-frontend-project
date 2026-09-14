import { customApiCall } from "../api/customApi";
import { runtimeConfig } from "../config/runtime";
import type {
  UserFeedPageResponse,
  UserPostCommentCreateRequest,
  UserPostCommentPageResponse,
  UserPostCommentResponse,
  UserPostLikeResponse,
  UserPostResponse,
  UserPostUpdateRequest,
} from "../types/social";

const USER_POSTS_ENDPOINT = "/users/posts";

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

function encodePathSegment(value: string) {
  return encodeURIComponent(value.trim());
}

/**
 * Feed pessoal e publicações pessoais (`origin = PERSONAL`).
 *
 * `GET /users/feed` é o feed da aba Início: posts pessoais de quem eu sigo +
 * posts das comunidades das quais sou membro. Meus próprios posts pessoais NÃO
 * entram aqui — eles aparecem só na aba Perfil (`getProfilePosts`).
 *
 * Curtida/comentário/edição/exclusão desta service valem para posts PESSOAIS.
 * Para posts de comunidade (mesmo quando vindos do feed unificado) as ações
 * continuam em `communityService` (`/communities/posts/...`).
 */
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
      `/users/${encodePathSegment(userProfileId)}/posts`,
      { page: args?.page ?? 0, size: args?.size ?? 10 },
      { requiresAuth: true }
    );
  },

  createPost(formData: FormData) {
    return customApiCall.post<UserPostResponse, FormData>(USER_POSTS_ENDPOINT, formData, {
      requiresAuth: true,
    });
  },

  /** Só o autor edita, e só o texto (a imagem não muda). Devolve o post com `editedAt`. */
  updatePost(postId: string, body: string) {
    return customApiCall.put<UserPostResponse, UserPostUpdateRequest>(
      `${USER_POSTS_ENDPOINT}/${encodePathSegment(postId)}`,
      { body },
      { requiresAuth: true }
    );
  },

  deletePost(postId: string) {
    return customApiCall.delete<void>(`${USER_POSTS_ENDPOINT}/${encodePathSegment(postId)}`, {
      requiresAuth: true,
    });
  },

  likePost(postId: string) {
    return customApiCall.post<UserPostLikeResponse>(
      `${USER_POSTS_ENDPOINT}/${encodePathSegment(postId)}/likes`,
      undefined,
      { requiresAuth: true }
    );
  },

  unlikePost(postId: string) {
    return customApiCall.delete<UserPostLikeResponse>(
      `${USER_POSTS_ENDPOINT}/${encodePathSegment(postId)}/likes`,
      { requiresAuth: true }
    );
  },

  getComments(postId: string, args?: { page?: number; size?: number }) {
    return customApiCall.get<UserPostCommentPageResponse>(
      `${USER_POSTS_ENDPOINT}/${encodePathSegment(postId)}/comments`,
      { page: args?.page ?? 0, size: args?.size ?? 20 },
      { requiresAuth: true }
    );
  },

  createComment(postId: string, body: string) {
    return customApiCall.post<UserPostCommentResponse, UserPostCommentCreateRequest>(
      `${USER_POSTS_ENDPOINT}/${encodePathSegment(postId)}/comments`,
      { body },
      { requiresAuth: true }
    );
  },

  deleteComment(postId: string, commentId: string) {
    return customApiCall.delete<void>(
      `${USER_POSTS_ENDPOINT}/${encodePathSegment(postId)}/comments/${encodePathSegment(commentId)}`,
      { requiresAuth: true }
    );
  },

  resolveAssetUrl: resolveFeedAssetUrl,
};
