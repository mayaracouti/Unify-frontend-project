import type { PageResponse } from "./pagination";

export type CommunityRole = "ADMIN" | "MEMBER" | "MODERATOR";

export type CommunityPrivacy = "PUBLIC" | "PRIVATE";

export interface CommunityUserSummaryResponse {
  id?: string | null;
  userProfileId?: string | null;
  name: string;
  avatarData?: string | null;
}

export interface CommunityCategoryResponse {
  id: number;
  description: string;
  ionicIcon?: string | null;
}

export interface CommunitySummaryResponse {
  id: string;
  name: string;
  memberCount?: number | null;
  description?: string | null;
  iconData?: string | null;
  isMember?: boolean | null;
  owner?: CommunityUserSummaryResponse | null;
  currentUserRole?: CommunityRole | null;
  isOwner?: boolean | null;
  category?: CommunityCategoryResponse | null;
  privacy?: CommunityPrivacy | null;
  hasPendingRequest?: boolean | null;
}

export interface CommunityUpdateRequestFields {
  name: string;
  description?: string | null;
  categoryId?: number | null;
  privacy?: CommunityPrivacy | null;
}

export interface CommunityDirectoryResponse {
  communities: CommunitySummaryResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

export interface CommunityMembershipResponse {
  communityId: string;
  isMember: boolean;
  memberCount: number;
  role?: CommunityRole | null;
  isOwner?: boolean | null;
  pendingRequest?: boolean | null;
}

export interface CommunityPostAuthorResponse extends CommunityUserSummaryResponse {}

export interface CommunityPostResponse {
  id: string;
  author: CommunityPostAuthorResponse;
  publishedAt?: string | null;
  body: string;
  mediaData?: string | null;
  likesCount?: number | null;
  commentsCount?: number | null;
  likedByCurrentUser?: boolean | null;
  commentedByCurrentUser?: boolean | null;
}

export interface CommunityLikeResponse {
  postId: string;
  likesCount?: number | null;
  likedByCurrentUser?: boolean | null;
}

export interface CommunityMemberRoleUpdateRequest {
  role: CommunityRole;
}

export interface CommunityMemberRoleResponse {
  communityId: string;
  user: CommunityUserSummaryResponse;
  role: CommunityRole;
  owner: boolean;
}

export interface CommunityMemberResponse {
  id?: string | null;
  userProfileId?: string | null;
  name: string;
  avatarData?: string | null;
  role?: CommunityRole | null;
  isOwner?: boolean | null;
  owner?: boolean | null;
  joinedAt?: string | null;
}

export type CommunityMembersResponse = PageResponse<CommunityMemberResponse>;

export interface CommunityCommentResponse {
  id: string;
  author: CommunityPostAuthorResponse;
  publishedAt?: string | null;
  body: string;
  commentedByCurrentUser?: boolean | null;
}

export type CommunityCommentsResponse = PageResponse<CommunityCommentResponse>;

export interface CommunityCreateCommentRequest {
  body: string;
}

export interface CommunityFeedResponse {
  community: CommunitySummaryResponse | null;
  posts: PageResponse<CommunityPostResponse>;
}

export interface CommunityJoinRequestResponse {
  id: string;
  userProfileId?: string | null;
  name?: string | null;
  avatarData?: string | null;
  requestedAt?: string | null;
}

export type CommunityJoinRequestsResponse = PageResponse<CommunityJoinRequestResponse>;

export interface CommunityForYouPostResponse {
  communityId: string;
  communityName: string;
  communityIconData?: string | null;
  post: CommunityPostResponse;
}

export type CommunityForYouFeedResponse = PageResponse<CommunityForYouPostResponse>;
