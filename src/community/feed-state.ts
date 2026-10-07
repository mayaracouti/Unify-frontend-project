import { communityService } from "../services/communityService";
import type { CommunityFeedResponse, CommunityMemberResponse, CommunityPostResponse, CommunitySummaryResponse, CommunityMembershipResponse, CommunityLikeResponse } from "../types/community";
export type NormalizedCommunityFeed = {
  community: CommunitySummaryResponse | null;
  posts: CommunityPostResponse[];
  // TODO: paginação incremental — expor `postsHasNext`/`postsPage` quando o feed
  // ganhar scroll infinito; hoje carregamos apenas a primeira página (size padrão).
  postsHasNext: boolean;
};

export function normalizeFeedResponse(response: CommunityFeedResponse): NormalizedCommunityFeed {
  return {
    community: response.community ?? null,
    posts: Array.isArray(response.posts?.content) ? response.posts.content : [],
    postsHasNext: response.posts?.hasNext ?? false,
  };
}

export function collectCommunityAssetUrls(feed: NormalizedCommunityFeed) {
  const communityIconUrl = communityService.resolveAssetUrl(feed.community?.iconData);
  const ownerAvatarUrl = communityService.resolveAssetUrl(feed.community?.owner?.avatarData);
  const postAssetUrls = feed.posts.flatMap((post) => {
    const authorAvatarUrl = communityService.resolveAssetUrl(post.author.avatarData);
    const mediaUrl = communityService.resolveAssetUrl(post.mediaData);

    return [authorAvatarUrl, mediaUrl].filter(
      (value): value is string => typeof value === "string" && value.length > 0
    );
  });

  return [communityIconUrl, ownerAvatarUrl, ...postAssetUrls].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
}

export function collectMemberAssetUrls(members: CommunityMemberResponse[]) {
  return members
    .map((member) => communityService.resolveAssetUrl(member.avatarData))
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

export function applyMembershipUpdate(
  currentFeed: NormalizedCommunityFeed | null,
  membership: CommunityMembershipResponse
) {
  if (!currentFeed?.community) {
    return currentFeed;
  }

  return {
    ...currentFeed,
    community: {
      ...currentFeed.community,
      isMember: membership.isMember,
      memberCount: membership.memberCount,
      currentUserRole: membership.role ?? null,
      isOwner: membership.isOwner ?? false,
      hasPendingRequest: membership.pendingRequest ?? false,
    },
  };
}

export function applyLikeUpdate(currentFeed: NormalizedCommunityFeed | null, like: CommunityLikeResponse) {
  if (!currentFeed) {
    return currentFeed;
  }

  return {
    ...currentFeed,
    posts: currentFeed.posts.map((post) =>
      post.id === like.postId
        ? {
            ...post,
            likedByCurrentUser: like.likedByCurrentUser,
            likesCount: like.likesCount,
          }
        : post
    ),
  };
}

export function removePost(currentFeed: NormalizedCommunityFeed | null, postId: string) {
  if (!currentFeed) {
    return currentFeed;
  }

  return {
    ...currentFeed,
    posts: currentFeed.posts.filter((post) => post.id !== postId),
  };
}

