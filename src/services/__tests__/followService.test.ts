// `jest.mock` e icado pelo babel-jest para antes destes imports.
import { customApiCall } from "../../api/customApi";
import { followService } from "../followService";

jest.mock("../../api/customApi", () => ({
  customApiCall: {
    get: jest.fn(async () => ({})),
    post: jest.fn(async () => ({})),
    put: jest.fn(async () => ({})),
    delete: jest.fn(async () => undefined),
  },
}));

const mockedApi = customApiCall as jest.Mocked<typeof customApiCall>;

describe("followService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("segue (ou pede para seguir) e deixa de seguir / cancela o pedido pelo id do perfil", async () => {
    await followService.follow(" perfil-1 ");
    await followService.unfollow("perfil-1");

    expect(mockedApi.post).toHaveBeenCalledWith("/users/perfil-1/follow", undefined, {
      requiresAuth: true,
    });
    expect(mockedApi.delete).toHaveBeenCalledWith("/users/perfil-1/follow", {
      requiresAuth: true,
    });
  });

  it("le as estatisticas de follow, com opcao silenciosa", async () => {
    await followService.getFollowStats("perfil-1");
    await followService.getFollowStats("perfil-1", { silent: true });

    expect(mockedApi.get).toHaveBeenNthCalledWith(1, "/users/perfil-1/follow-stats", undefined, {
      requiresAuth: true,
      suppressErrorToast: false,
    });
    expect(mockedApi.get).toHaveBeenNthCalledWith(2, "/users/perfil-1/follow-stats", undefined, {
      requiresAuth: true,
      suppressErrorToast: true,
    });
  });

  it("lista pedidos recebidos paginados (padrao 0/20, silencioso opcional)", async () => {
    await followService.listFollowRequests();
    await followService.listFollowRequests({ page: 2, size: 1, silent: true });

    expect(mockedApi.get).toHaveBeenNthCalledWith(
      1,
      "/users/follow-requests",
      { page: 0, size: 20 },
      { requiresAuth: true, suppressErrorToast: false }
    );
    expect(mockedApi.get).toHaveBeenNthCalledWith(
      2,
      "/users/follow-requests",
      { page: 2, size: 1 },
      { requiresAuth: true, suppressErrorToast: true }
    );
  });

  it("lista pedidos enviados paginados", async () => {
    await followService.listSentFollowRequests({ page: 1 });

    expect(mockedApi.get).toHaveBeenCalledWith(
      "/users/follow-requests/sent",
      { page: 1, size: 20 },
      { requiresAuth: true }
    );
  });

  it("aceita com POST e recusa/cancela com DELETE pelo id do pedido", async () => {
    await followService.acceptFollowRequest("pedido 1");
    await followService.deleteFollowRequest("pedido-2");

    expect(mockedApi.post).toHaveBeenCalledWith(
      "/users/follow-requests/pedido%201/accept",
      undefined,
      { requiresAuth: true }
    );
    expect(mockedApi.delete).toHaveBeenCalledWith("/users/follow-requests/pedido-2", {
      requiresAuth: true,
    });
  });
});
