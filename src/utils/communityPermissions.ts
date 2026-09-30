import type { CommunitySummaryResponse, CommunityUserSummaryResponse } from "../types/community";

export function communityRole(community?: CommunitySummaryResponse | null) {
  return community?.isOwner ? "ADMIN" : community?.currentUserRole ?? null;
}

export function canParticipate(community?: CommunitySummaryResponse | null) {
  return Boolean(community?.isMember || community?.isOwner || community?.currentUserRole);
}

export function canModerate(community?: CommunitySummaryResponse | null) {
  const role = communityRole(community);
  return role === "ADMIN" || role === "MODERATOR";
}

export function isCommunityAuthor(
  author: CommunityUserSummaryResponse,
  userId?: string | null,
  userProfileId?: string | null
) {
  return Boolean(
    (userId && author.id?.trim() === userId) ||
    (userProfileId && author.userProfileId?.trim() === userProfileId)
  );
}
