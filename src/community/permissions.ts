import type { CommunityMemberResponse, CommunityPostResponse, CommunityRole, CommunitySummaryResponse, CommunityUserSummaryResponse } from "../types/community";
export function canModerateRole(role?: CommunityRole | null) { return role === "ADMIN" || role === "MODERATOR"; }
export function getEffectiveCommunityRole(
  community?: CommunitySummaryResponse | null
): CommunityRole | null {
  if (!community) {
    return null;
  }

  if (community.currentUserRole) {
    return community.currentUserRole;
  }

  return community.isOwner ? "ADMIN" : null;
}

export function canParticipateInCommunity(community?: CommunitySummaryResponse | null) {
  if (!community) {
    return false;
  }

  return Boolean(community.isMember || community.isOwner || community.currentUserRole);
}

export function resolveCommunityActorId(actor?: CommunityUserSummaryResponse | null) {
  return [actor?.userProfileId, actor?.id]
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value));
}

export function resolveCommunityMemberTargetId(member: CommunityMemberResponse) {
  return [member.userProfileId, member.id]
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value));
}

export function isCommunityMemberOwner(
  member: CommunityMemberResponse,
  community?: CommunitySummaryResponse | null
) {
  if (member.isOwner || member.owner) {
    return true;
  }

  const ownerId = resolveCommunityActorId(community?.owner);
  const memberTargetId = resolveCommunityMemberTargetId(member);

  return Boolean(ownerId && memberTargetId && ownerId === memberTargetId);
}


export interface CommunityViewer { userId?: string | null; userProfileId?: string | null; }
export function canEditCommunityPost(post: CommunityPostResponse, viewer: CommunityViewer): boolean {
  const actorId = resolveCommunityActorId(post.author);
  return Boolean((post.author.id?.trim() && viewer.userId && post.author.id.trim() === viewer.userId)
    || (actorId && (actorId === viewer.userProfileId || actorId === viewer.userId)));
}
export function canDeleteCommunityPost(post: CommunityPostResponse, viewer: CommunityViewer, community?: CommunitySummaryResponse | null): boolean {
  if (!community) return false;
  // Keep the existing deletion fallback: elevated role or resolved author id.
  const actorId = resolveCommunityActorId(post.author);
  return canModerateRole(getEffectiveCommunityRole(community)) || Boolean(actorId && (actorId === viewer.userId || actorId === viewer.userProfileId));
}
export function canReportCommunityPost(post: CommunityPostResponse, viewer: CommunityViewer): boolean {
  return !canEditCommunityPost(post, viewer) && Boolean(post.author.id?.trim() || resolveCommunityActorId(post.author));
}
