/**
 * Ponto unico de deep link das notificacoes (lista in-app e toque no push).
 */
import { feedService } from "../../services/feedService";
import { showGlobalToast } from "../globalToast";
import {
  openNotificationTarget,
  parsePushData,
  resolveNotificationTarget,
} from "../notificationNavigation";

jest.mock("../../services/feedService", () => ({
  feedService: { getPost: jest.fn() },
}));

jest.mock("../globalToast", () => ({
  showGlobalToast: jest.fn(),
}));

const getPost = feedService.getPost as jest.Mock;

describe("resolveNotificationTarget", () => {
  it("match mútuo abre a lista de matches", () => {
    expect(resolveNotificationTarget({ type: "NEW_MATCH", referenceId: "m1" })).toEqual({
      kind: "route",
      href: "/matches/mutual",
    });
  });

  it("mensagem abre a conversa com nome e perfil de quem mandou", () => {
    expect(
      resolveNotificationTarget({
        type: "NEW_MESSAGE",
        referenceId: "c1",
        contextId: "p9",
        actorName: "Ana",
      })
    ).toEqual({
      kind: "route",
      href: {
        pathname: "/chats/[conversationId]",
        params: { conversationId: "c1", name: "Ana", otherUserProfileId: "p9" },
      },
    });
  });

  it("seguidor e pedido aceito abrem o perfil público; pedido abre a caixa de pedidos", () => {
    expect(resolveNotificationTarget({ type: "NEW_FOLLOWER", referenceId: "p1" })).toEqual({
      kind: "route",
      href: { pathname: "/users/[userProfileId]", params: { userProfileId: "p1" } },
    });
    expect(
      resolveNotificationTarget({ type: "FOLLOW_REQUEST_ACCEPTED", referenceId: "p2", actorName: "Beto" })
    ).toEqual({
      kind: "route",
      href: { pathname: "/users/[userProfileId]", params: { userProfileId: "p2", name: "Beto" } },
    });
    expect(resolveNotificationTarget({ type: "FOLLOW_REQUEST", referenceId: "p3" })).toEqual({
      kind: "route",
      href: "/profile/follow-requests",
    });
  });

  it("curtida e comentário precisam buscar o post (origem pessoal x comunidade)", () => {
    expect(resolveNotificationTarget({ type: "POST_LIKED", referenceId: "post1" })).toEqual({
      kind: "post",
      postId: "post1",
    });
    expect(resolveNotificationTarget({ type: "POST_COMMENTED", referenceId: "post2" })).toEqual({
      kind: "post",
      postId: "post2",
    });
  });

  it("denúncia, tipo desconhecido ou referência ausente não navegam", () => {
    expect(resolveNotificationTarget({ type: "REPORT_UPDATE", referenceId: "r1" })).toEqual({ kind: "none" });
    expect(resolveNotificationTarget({ type: "XYZ", referenceId: "r1" })).toEqual({ kind: "none" });
    expect(resolveNotificationTarget({ type: "NEW_FOLLOWER", referenceId: "  " })).toEqual({ kind: "none" });
  });
});

describe("openNotificationTarget", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("post de comunidade abre os comentários da comunidade", async () => {
    getPost.mockResolvedValue({
      id: "post1",
      origin: "COMMUNITY",
      community: { id: "c1", name: "Xadrez", iconUrl: null },
      author: { userId: "u1", userProfileId: "p1", name: "Ana", avatarUrl: null },
      body: "Encontro sábado",
      createdAt: new Date().toISOString(),
    });
    const router = { push: jest.fn() };

    const result = await openNotificationTarget(router, { type: "POST_LIKED", referenceId: "post1" });

    expect(result).toBe("opened");
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/community/comments",
        params: expect.objectContaining({ communityId: "c1", postId: "post1", postBody: "Encontro sábado" }),
      })
    );
  });

  it("post que sumiu vira aviso de conteúdo indisponível, sem navegar", async () => {
    getPost.mockRejectedValue(new Error("404"));
    const router = { push: jest.fn() };

    const result = await openNotificationTarget(router, { type: "POST_COMMENTED", referenceId: "gone" });

    expect(result).toBe("unavailable");
    expect(router.push).not.toHaveBeenCalled();
    expect(showGlobalToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Esta publicação não está mais disponível." })
    );
  });
});

describe("parsePushData", () => {
  it("aceita só notificações da Unify e normaliza os campos", () => {
    expect(
      parsePushData({ type: "NEW_FOLLOWER", referenceId: "p1", notificationId: "n1", extra: 1 })
    ).toEqual({ type: "NEW_FOLLOWER", referenceId: "p1", contextId: null, notificationId: "n1" });
    expect(parsePushData({ type: "OUTRA_COISA" })).toBeNull();
    expect(parsePushData(null)).toBeNull();
  });
});
