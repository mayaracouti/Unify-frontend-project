import { canDeleteCommunityPost, canEditCommunityPost, canReportCommunityPost, canParticipateInCommunity, isCommunityMemberOwner } from "../permissions";
import type { CommunityPostResponse, CommunityRole } from "../../types/community";
const post: CommunityPostResponse = { id: "p", author: { id: "u", userProfileId: "profile", name: "Ana" }, body: "Texto" };
it.each<CommunityRole>(["ADMIN", "MODERATOR", "MEMBER"])("preserves role %s and author-only editing", (role) => {
  const community = { id: "c", name: "Comunidade", currentUserRole: role };
  expect(canParticipateInCommunity(community)).toBe(true);
  expect(canDeleteCommunityPost(post, { userId: "other" }, community)).toBe(role !== "MEMBER");
  expect(canEditCommunityPost(post, { userId: "other" })).toBe(false);
  expect(canReportCommunityPost(post, { userId: "other" })).toBe(true);
});
it("accepts either author identifier and excludes self-reports", () => {
  expect(canEditCommunityPost(post, { userId: "u" })).toBe(true);
  expect(canEditCommunityPost(post, { userProfileId: "profile" })).toBe(true);
  expect(canReportCommunityPost(post, { userId: "u" })).toBe(false);
  expect(canDeleteCommunityPost(post, { userProfileId: "profile" }, { id: "c", name: "Comunidade" })).toBe(true);
  expect(canParticipateInCommunity({ id: "c", name: "Privada", privacy: "PRIVATE" })).toBe(false);
  expect(isCommunityMemberOwner({ name: "Ana", userProfileId: "profile" }, { id: "c", name: "Comunidade", owner: post.author })).toBe(true);
});
