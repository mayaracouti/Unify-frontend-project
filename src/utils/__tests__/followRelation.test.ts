import {
  applyFollowResponse,
  describeFollowButton,
  followOutcomeAnnouncement,
  followStateFromStats,
  predictFollowState,
  resolveFollowRelation,
  type FollowState,
} from "../followRelation";

const baseState: FollowState = {
  following: false,
  followRequested: false,
  followApprovalRequired: false,
  followersCount: 10,
  followingCount: 3,
};

describe("resolveFollowRelation", () => {
  it("distingue nao segue, solicitado e seguindo", () => {
    expect(resolveFollowRelation({ following: false })).toBe("NONE");
    expect(resolveFollowRelation({ following: false, followRequested: null })).toBe("NONE");
    expect(resolveFollowRelation({ following: false, followRequested: true })).toBe("REQUESTED");
    expect(resolveFollowRelation({ following: true, followRequested: false })).toBe("FOLLOWING");
  });

  it("seguindo vence um pedido pendente", () => {
    expect(resolveFollowRelation({ following: true, followRequested: true })).toBe("FOLLOWING");
  });
});

describe("describeFollowButton", () => {
  it("mostra Seguir quando o alvo nao aprova seguidores", () => {
    const button = describeFollowButton(
      { following: false, followRequested: false, followApprovalRequired: false },
      "Ana"
    );

    expect(button.relation).toBe("NONE");
    expect(button.text).toBe("Seguir");
    expect(button.accessibilityLabel).toBe("Seguir Ana");
    expect(button.selected).toBe(false);
  });

  it("mostra Pedir para seguir quando o alvo aprova seguidores", () => {
    const button = describeFollowButton(
      { following: false, followRequested: false, followApprovalRequired: true },
      "Ana"
    );

    expect(button.text).toBe("Pedir para seguir");
    expect(button.accessibilityLabel).toBe("Pedir para seguir Ana");
    expect(button.accessibilityHint).toContain("aceitar");
  });

  it("mostra Solicitado com pedido pendente e explica que tocar cancela", () => {
    const button = describeFollowButton(
      { following: false, followRequested: true, followApprovalRequired: true },
      "Ana"
    );

    expect(button.relation).toBe("REQUESTED");
    expect(button.text).toBe("Solicitado");
    expect(button.accessibilityLabel).toContain("Solicitado");
    expect(button.accessibilityLabel).toContain("Ana");
    expect(button.accessibilityHint).toContain("cancelar");
    expect(button.speechAction).toBe("Cancelar pedido para seguir");
    expect(button.selected).toBe(true);
  });

  it("mostra Seguindo independente da aprovacao", () => {
    const button = describeFollowButton(
      { following: true, followRequested: false, followApprovalRequired: true },
      "Ana"
    );

    expect(button.relation).toBe("FOLLOWING");
    expect(button.text).toBe("Seguindo");
    expect(button.accessibilityLabel).toContain("Seguindo");
    expect(button.speechAction).toBe("Deixar de seguir");
  });

  it("usa nome generico quando vem vazio", () => {
    expect(describeFollowButton({ following: false }, "  ").accessibilityLabel).toBe(
      "Seguir esta pessoa"
    );
  });
});

describe("followStateFromStats", () => {
  it("converte o follow-stats e ignora pedido quando ja segue", () => {
    expect(
      followStateFromStats({
        userProfileId: "p1",
        followersCount: 5,
        followingCount: 2,
        followedByCurrentUser: true,
        followRequestedByCurrentUser: true,
        followApprovalRequired: true,
        pendingFollowRequestsCount: null,
      })
    ).toEqual({
      following: true,
      followRequested: false,
      followApprovalRequired: true,
      followersCount: 5,
      followingCount: 2,
    });
  });

  it("tolera backend antigo sem os campos novos", () => {
    const state = followStateFromStats({
      userProfileId: "p1",
      followersCount: 1,
      followingCount: 0,
      followedByCurrentUser: false,
    } as never);

    expect(state.followRequested).toBe(false);
    expect(state.followApprovalRequired).toBe(false);
  });
});

describe("predictFollowState", () => {
  it("seguir direto soma um seguidor", () => {
    expect(predictFollowState(baseState)).toMatchObject({
      following: true,
      followRequested: false,
      followersCount: 11,
    });
  });

  it("seguir quem aprova vira solicitado sem mudar o contador", () => {
    expect(predictFollowState({ ...baseState, followApprovalRequired: true })).toMatchObject({
      following: false,
      followRequested: true,
      followersCount: 10,
    });
  });

  it("cancelar pedido volta a nao seguir", () => {
    expect(
      predictFollowState({ ...baseState, followApprovalRequired: true, followRequested: true })
    ).toMatchObject({ following: false, followRequested: false, followersCount: 10 });
  });

  it("deixar de seguir tira um seguidor, sem ficar negativo", () => {
    expect(predictFollowState({ ...baseState, following: true })).toMatchObject({
      following: false,
      followersCount: 9,
    });
    expect(
      predictFollowState({ ...baseState, following: true, followersCount: 0 }).followersCount
    ).toBe(0);
  });
});

describe("applyFollowResponse", () => {
  it("a resposta do POST decide: pedido pendente nao vira seguindo", () => {
    const state = applyFollowResponse(predictFollowState(baseState), {
      following: false,
      followRequested: true,
      followersCount: 10,
    });

    expect(state.following).toBe(false);
    expect(state.followRequested).toBe(true);
    expect(state.followersCount).toBe(10);
  });

  it("seguindo zera o pedido", () => {
    const state = applyFollowResponse(
      { ...baseState, followRequested: true },
      { following: true, followRequested: true, followersCount: 11 }
    );

    expect(state).toMatchObject({ following: true, followRequested: false, followersCount: 11 });
  });
});

describe("followOutcomeAnnouncement", () => {
  it("anuncia seguir, pedido enviado, pedido cancelado e deixar de seguir", () => {
    expect(
      followOutcomeAnnouncement("NONE", { following: true, followRequested: false }, "Ana")
    ).toBe("Agora você segue Ana.");
    expect(
      followOutcomeAnnouncement("NONE", { following: false, followRequested: true }, "Ana")
    ).toBe("Pedido para seguir enviado a Ana.");
    expect(
      followOutcomeAnnouncement("REQUESTED", { following: false, followRequested: false }, "Ana")
    ).toBe("Pedido cancelado.");
    expect(
      followOutcomeAnnouncement("FOLLOWING", { following: false, followRequested: false }, "Ana")
    ).toBe("Você deixou de seguir Ana.");
  });
});
