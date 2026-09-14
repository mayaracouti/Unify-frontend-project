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
  userProfileId: string;
  /** Id do `User` autor (alvo de denúncia). */
  userId: string;
  name: string;
  avatarUrl: string | null;
}

export interface UserPostResponse {
  id: string;
  author: UserPostAuthorResponse;
  body: string;
  mediaUrl: string | null;
  createdAt: string;
}

export interface UserFeedPageResponse {
  posts: UserPostResponse[];
  page: number;
  size: number;
  hasNext: boolean;
}
