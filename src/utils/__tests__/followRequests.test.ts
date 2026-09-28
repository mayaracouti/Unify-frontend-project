import type { FollowRequestResponse } from "../../types/social";
import {
  followRequestRowLabel,
  followRequestsAccessLabel,
  followRequestsTabAccessibilityLabel,
  mergeFollowRequestPage,
  parseFollowRequestsTab,
  removeFollowRequest,
  restoreFollowRequest,
  shouldShowFollowRequestsShortcut,
} from "../followRequests";

function request(id: string, name = `Pessoa ${id}`): FollowRequestResponse {
  return {
    id,
    userProfileId: `perfil-${id}`,
    userId: `user-${id}`,
    name,
    avatarUrl: null,
    createdAt: "2026-09-28T10:00:00Z",
  };
}

describe("parseFollowRequestsTab", () => {
  it("abre Recebidos por padrao e Enviados so com tab=sent", () => {
    expect(parseFollowRequestsTab(undefined)).toBe("received");
    expect(parseFollowRequestsTab("qualquer")).toBe("received");
    expect(parseFollowRequestsTab("sent")).toBe("sent");
    expect(parseFollowRequestsTab(["sent"])).toBe("sent");
  });
});

describe("followRequestsTabAccessibilityLabel", () => {
  it("inclui a contagem quando conhecida", () => {
    expect(followRequestsTabAccessibilityLabel("Recebidos", null)).toBe("Recebidos");
    expect(followRequestsTabAccessibilityLabel("Recebidos", 0)).toBe("Recebidos, nenhum pedido");
    expect(followRequestsTabAccessibilityLabel("Recebidos", 1)).toBe("Recebidos, 1 pedido");
    expect(followRequestsTabAccessibilityLabel("Enviados", 3)).toBe("Enviados, 3 pedidos");
  });
});

describe("followRequestRowLabel", () => {
  const now = Date.parse("2026-09-28T12:00:00Z");

  it("descreve quem pediu (recebidos) e para quem pedi (enviados)", () => {
    expect(followRequestRowLabel(request("1", "Ana"), "received", now)).toBe(
      "Ana pediu para seguir você, há 2 h"
    );
    expect(followRequestRowLabel(request("1", "Ana"), "sent", now)).toBe(
      "Você pediu para seguir Ana, há 2 h"
    );
  });

  it("omite a data invalida", () => {
    expect(
      followRequestRowLabel({ name: "Ana", createdAt: "invalida" }, "received", now)
    ).toBe("Ana pediu para seguir você");
  });
});

describe("mergeFollowRequestPage", () => {
  it("anexa sem repetir ids", () => {
    const merged = mergeFollowRequestPage([request("1"), request("2")], [request("2"), request("3")]);
    expect(merged.map((item) => item.id)).toEqual(["1", "2", "3"]);
  });
});

describe("removeFollowRequest / restoreFollowRequest", () => {
  it("remove e devolve na mesma posicao (rollback)", () => {
    const items = [request("1"), request("2"), request("3")];
    const result = removeFollowRequest(items, "2");

    expect(result.items.map((item) => item.id)).toEqual(["1", "3"]);
    expect(result.index).toBe(1);
    expect(result.removed?.id).toBe("2");

    const restored = restoreFollowRequest(result.items, result.removed!, result.index);
    expect(restored.map((item) => item.id)).toEqual(["1", "2", "3"]);
  });

  it("ignora id desconhecido e nao duplica no rollback", () => {
    const items = [request("1")];

    expect(removeFollowRequest(items, "x")).toEqual({ items, removed: null, index: -1 });
    expect(restoreFollowRequest(items, request("1"), 0)).toHaveLength(1);
  });

  it("rollback com lista encolhida vai para o fim", () => {
    expect(restoreFollowRequest([request("1")], request("9"), 5).map((item) => item.id)).toEqual([
      "1",
      "9",
    ]);
  });
});

describe("followRequestsAccessLabel", () => {
  it("poe a contagem no rotulo (o badge e decorativo)", () => {
    expect(followRequestsAccessLabel(3)).toBe("Pedidos para seguir, 3 aguardando");
    expect(followRequestsAccessLabel(150)).toBe("Pedidos para seguir, 150 aguardando");
  });

  it("zero vira 'nenhum aguardando'", () => {
    expect(followRequestsAccessLabel(0)).toBe("Pedidos para seguir, nenhum aguardando");
  });

  it("sem contagem (carregando ou falhou) fica so o destino", () => {
    expect(followRequestsAccessLabel(null)).toBe("Pedidos para seguir");
    expect(followRequestsAccessLabel(undefined)).toBe("Pedidos para seguir");
  });
});

describe("shouldShowFollowRequestsShortcut", () => {
  it("aparece com a conta privada ligada, mesmo sem pendentes", () => {
    expect(
      shouldShowFollowRequestsShortcut({ followApprovalRequired: true, pendingFollowRequestsCount: 0 })
    ).toBe(true);
  });

  it("aparece com pendentes mesmo com a conta publica", () => {
    expect(
      shouldShowFollowRequestsShortcut({ followApprovalRequired: false, pendingFollowRequestsCount: 2 })
    ).toBe(true);
  });

  it("some com a conta publica e sem pendentes (ou sem stats)", () => {
    expect(
      shouldShowFollowRequestsShortcut({ followApprovalRequired: false, pendingFollowRequestsCount: null })
    ).toBe(false);
    expect(shouldShowFollowRequestsShortcut(null)).toBe(false);
  });
});
