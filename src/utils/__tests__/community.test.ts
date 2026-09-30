import { canModerate, canParticipate, isCommunityAuthor } from "../communityPermissions";
import { mergeCommunityItems, normalizeCommunityPage } from "../communityPagination";

it("não confunde ID de User com ID de UserProfile", () => {
  const author = { id: "user-1", userProfileId: "profile-1", name: "Ana" };
  expect(isCommunityAuthor(author, "user-1", null)).toBe(true);
  expect(isCommunityAuthor(author, null, "profile-1")).toBe(true);
  expect(isCommunityAuthor(author, "profile-1", "user-1")).toBe(false);
});

it("respeita visitantes, membros, moderadores e proprietário", () => {
  const community = { id: "c1", name: "Comunidade" };
  expect(canParticipate(community)).toBe(false);
  expect(canModerate({ ...community, isMember: true })).toBe(false);
  expect(canModerate({ ...community, currentUserRole: "MODERATOR" })).toBe(true);
  expect(canModerate({ ...community, isOwner: true })).toBe(true);
  expect(canParticipate({ ...community, hasPendingRequest: true })).toBe(false);
});

it("deduplica páginas sobrepostas e atualiza o conteúdo existente", () => {
  expect(mergeCommunityItems([{ id: "1", body: "antigo" }], [{ id: "1", body: "novo" }, { id: "2", body: "outro" }], item => item.id))
    .toEqual([{ id: "1", body: "novo" }, { id: "2", body: "outro" }]);
});

it("não pagina novamente um array legado mesmo com mais de 20 itens", () => {
  expect(normalizeCommunityPage(Array.from({ length: 30 }, (_, id) => ({ id })), "posts").hasNext).toBe(false);
});

it("respeita a última página e rejeita envelopes ausentes", () => {
  expect(normalizeCommunityPage({ content: [], number: 3, last: true }, "posts").hasNext).toBe(false);
  expect(() => normalizeCommunityPage(null, "posts")).toThrow();
});
