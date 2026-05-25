export interface CommunitySummaryResponse {
  id: string;
  name: string;
  memberCount?: number | null;
  description?: string | null;
  iconUrl?: string | null;
  isMember?: boolean | null;
}

export interface CommunityPostAuthorResponse {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface CommunityPostResponse {
  id: string;
  author: CommunityPostAuthorResponse;
  publishedAt?: string | null;
  body: string;
  mediaUrl?: string | null;
  likesCount?: number | null;
  commentsCount?: number | null;
  likedByCurrentUser?: boolean | null;
  commentedByCurrentUser?: boolean | null;
}

export interface CommunityFeedResponse {
  community: CommunitySummaryResponse | null;
  posts: CommunityPostResponse[];
}
