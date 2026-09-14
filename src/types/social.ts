export type PostOrigin = "PERSONAL" | "COMMUNITY";

/**
 * Por que um post entrou no feed ranqueado da aba Início (`GET /users/feed`).
 * `SUGGESTED_*` são descobertas: perfil que eu não sigo com interesses
 * parecidos, ou comunidade PÚBLICA em que não sou membro. Nulo fora do feed.
 */
export type FeedSource =
  | "FOLLOWING"
  | "MEMBER_COMMUNITY"
  | "SUGGESTED_PROFILE"
  | "SUGGESTED_COMMUNITY";

export interface FollowActionResponse {
  targetUserProfileId: string;
  following: boolean;
  followersCount: number;
  followingCount: number;
}

export interface FollowStatsResponse {
  userProfileId: string;
  followersCount: number;
  followingCount: number;
  followedByCurrentUser: boolean;
}

export interface FollowedProfileSummaryResponse {
  userProfileId: string;
  /** Id do `User` dono do perfil (usado para denúncia, que é por usuário). */
  userId: string;
  name: string;
  avatarUrl: string | null;
  followedByCurrentUser: boolean;
}

export interface FollowPageResponse {
  profiles: FollowedProfileSummaryResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

export interface UserPostAuthorResponse {
  userProfileId: string | null;
  /** Id do `User` autor (alvo de denúncia). */
  userId: string;
  name: string;
  avatarUrl: string | null;
}

/** Comunidade de origem de um post do feed (nula em posts pessoais). */
export interface UserPostCommunityResponse {
  id: string;
  name: string;
  iconUrl: string | null;
}

/**
 * Publicação do feed unificado (`GET /users/feed`) e das listas por perfil.
 * Posts pessoais e de comunidade vivem na mesma tabela (`posts`, coluna
 * `origin`); `community` só vem preenchida quando `origin === "COMMUNITY"`.
 */
export interface UserPostResponse {
  id: string;
  origin: PostOrigin;
  community: UserPostCommunityResponse | null;
  author: UserPostAuthorResponse;
  body: string;
  mediaUrl: string | null;
  createdAt: string;
  /** Preenchido quando o autor alterou o texto depois de publicar. */
  editedAt: string | null;
  likesCount: number;
  commentsCount: number;
  likedByCurrentUser: boolean;
  commentedByCurrentUser: boolean;
  /** Só no feed da aba Início; nulo nas listas por perfil. */
  feedSource?: FeedSource | null;
}

export interface UserFeedPageResponse {
  posts: UserPostResponse[];
  page: number;
  size: number;
  hasNext: boolean;
}

export interface UserPostUpdateRequest {
  body: string;
}

export interface UserPostLikeResponse {
  postId: string;
  likesCount: number;
  likedByCurrentUser: boolean;
}

export interface UserPostCommentResponse {
  id: string;
  author: UserPostAuthorResponse;
  body: string;
  createdAt: string;
  /** Comentário escrito pelo usuário autenticado. */
  commentedByCurrentUser: boolean;
}

export interface UserPostCommentPageResponse {
  comments: UserPostCommentResponse[];
  page: number;
  size: number;
  totalElements: number;
  hasNext: boolean;
}

export interface UserPostCommentCreateRequest {
  body: string;
}
