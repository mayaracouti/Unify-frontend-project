import { customApiCall } from "../../api/customApi";
import { communityService } from "../communityService";

jest.mock("../../api/customApi", () => ({ customApiCall: {
  get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(),
} }));
const api = customApiCall as jest.Mocked<typeof customApiCall>;
const post = { id: "post-1", author: { id: "user-1", name: "Ana" }, body: "Olá" };

beforeEach(() => jest.resetAllMocks());

it("normaliza o feed legado sem esconder publicações", async () => {
  api.get.mockResolvedValue({ community: { id: "c1" }, posts: [post] });
  expect((await communityService.getFeed("c1")).posts.content).toEqual([post]);
  expect(api.get).toHaveBeenCalledWith("/communities/feed", { communityId: "c1", page: 0, size: 20 }, { requiresAuth: true });
});

it("normaliza páginas Spring e preserva o cursor de paginação", async () => {
  api.get.mockResolvedValue({ content: [post], number: 2, size: 10, totalElements: 40, totalPages: 4, last: false });
  const page = await communityService.getComments(" post/1 ", { page: 2, size: 10 });
  expect(page).toMatchObject({ content: [post], page: 2, hasNext: true });
  expect(api.get).toHaveBeenCalledWith("/communities/posts/post%2F1/comments", { page: 2, size: 10 }, { requiresAuth: true });
});

it("aceita membros e comentários nos envelopes do contrato anterior", async () => {
  api.get.mockResolvedValueOnce({ members: [{ userProfileId: "p1", name: "Ana" }] });
  expect((await communityService.getMembers("c1")).content).toHaveLength(1);
  api.get.mockResolvedValueOnce({ comments: [post] });
  expect((await communityService.getComments("post-1")).content).toEqual([post]);
});

it("mantém filtros e metadados nas listas de comunidades", async () => {
  api.get.mockResolvedValue({ communities: [{ id: "c1" }], page: 1, size: 10, totalPages: 3, totalElements: 21, hasNext: true });
  const result = await communityService.searchCommunities("jogos", { page: 1, size: 10, categoryId: 3 });
  expect(result.communities).toEqual([{ id: "c1" }]);
  expect(result.hasNext).toBe(true);
  expect(api.get).toHaveBeenCalledWith("/communities/search", { query: "jogos", page: 1, size: 10, categoryId: 3 }, { requiresAuth: true });
});

it("não transforma resposta inválida em uma lista vazia de sucesso", async () => {
  api.get.mockResolvedValue({ unexpected: [] });
  await expect(communityService.getComments("p1")).rejects.toThrow("formato inválido");
});

it("envia multipart intacto para criar e atualizar sem forçar Content-Type", async () => {
  const form = new FormData(); form.append("name", "Comunidade");
  await communityService.createCommunity(form);
  await communityService.updateCommunity("c/1", form);
  await communityService.createPost("c/1", form);
  expect(api.post).toHaveBeenCalledWith("/communities", form, { requiresAuth: true });
  expect(api.put).toHaveBeenCalledWith("/communities/c%2F1", form, { requiresAuth: true });
  expect(api.post).toHaveBeenCalledWith("/communities/posts?communityId=c%2F1", form, { requiresAuth: true });
});

it("consulta contexto canônico e envia edição/exclusão de comentários", async () => {
  api.get.mockResolvedValue({ community: { id: "c1" }, post });
  expect((await communityService.getPost("post-1")).post).toEqual(post);
  await communityService.createComment("p1", { body: "Olá" });
  await communityService.updateComment("p1", "comment/1", { body: "Editado" });
  await communityService.deleteComment("p1", "comment/1");
  expect(api.get).toHaveBeenCalledWith("/communities/posts/post-1", undefined, { requiresAuth: true });
  expect(api.post).toHaveBeenCalledWith("/communities/posts/p1/comments", { body: "Olá" }, { requiresAuth: true });
  expect(api.put).toHaveBeenCalledWith("/communities/posts/p1/comments/comment%2F1", { body: "Editado" }, { requiresAuth: true });
  expect(api.delete).toHaveBeenCalledWith("/communities/posts/p1/comments/comment%2F1", { requiresAuth: true });
});

it("conecta participação, cancelamento, aprovação e recusa com autenticação", async () => {
  await communityService.joinCommunity("c/1");
  await communityService.leaveCommunity("c/1");
  await communityService.approveJoinRequest("c/1", "r/1");
  await communityService.declineJoinRequest("c/1", "r/1");
  expect(api.post).toHaveBeenCalledWith("/communities/membership?communityId=c%2F1", undefined, { requiresAuth: true });
  expect(api.delete).toHaveBeenCalledWith("/communities/membership?communityId=c%2F1", { requiresAuth: true });
  expect(api.post).toHaveBeenCalledWith("/communities/c%2F1/join-requests/r%2F1/approve", undefined, { requiresAuth: true });
  expect(api.delete).toHaveBeenCalledWith("/communities/c%2F1/join-requests/r%2F1", { requiresAuth: true });
});
