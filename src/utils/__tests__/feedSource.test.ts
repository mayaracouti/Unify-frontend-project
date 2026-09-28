import {
  describeFeedSuggestion,
  feedSourceAfterAction,
  feedSourceAfterFollow,
} from "../feedSource";

const author = { userProfileId: "p1", userId: "u1", name: "Ana Ribeiro", avatarUrl: null };
const community = { id: "c1", name: "Games Acessíveis", iconUrl: null };

describe("describeFeedSuggestion", () => {
  it("não gera selo para posts de quem sigo, das minhas comunidades ou fora do feed", () => {
    expect(describeFeedSuggestion({ feedSource: "FOLLOWING", author, community: null })).toBeNull();
    expect(
      describeFeedSuggestion({ feedSource: "MEMBER_COMMUNITY", author, community })
    ).toBeNull();
    expect(describeFeedSuggestion({ feedSource: null, author, community: null })).toBeNull();
    expect(describeFeedSuggestion({ author, community: null })).toBeNull();
    expect(describeFeedSuggestion(null)).toBeNull();
  });

  it("perfil sugerido vira ação de seguir com o nome da pessoa", () => {
    const suggestion = describeFeedSuggestion({
      feedSource: "SUGGESTED_PROFILE",
      author,
      community: null,
    });

    expect(suggestion?.action).toBe("follow");
    expect(suggestion?.actionLabel).toBe("Seguir");
    expect(suggestion?.reason).toContain("Ana Ribeiro");
    expect(suggestion?.actionHint).toContain("Ana Ribeiro");
  });

  it("comunidade sugerida vira ação de entrar com o nome da comunidade", () => {
    const suggestion = describeFeedSuggestion({
      feedSource: "SUGGESTED_COMMUNITY",
      author,
      community,
    });

    expect(suggestion?.action).toBe("join");
    expect(suggestion?.actionLabel).toBe("Entrar");
    expect(suggestion?.reason).toContain("Games Acessíveis");
    expect(suggestion?.label).toBe("Comunidade sugerida");
  });

  it("usa um nome genérico quando o backend não manda nome", () => {
    const suggestion = describeFeedSuggestion({
      feedSource: "SUGGESTED_PROFILE",
      author: { ...author, name: "  " },
      community: null,
    });

    expect(suggestion?.reason).toBe("esta pessoa tem interesses parecidos com os seus");
  });
});

describe("feedSourceAfterAction", () => {
  it("seguir vira FOLLOWING e entrar vira MEMBER_COMMUNITY", () => {
    expect(feedSourceAfterAction("follow")).toBe("FOLLOWING");
    expect(feedSourceAfterAction("join")).toBe("MEMBER_COMMUNITY");
  });
});

describe("seguir com aprovação nas sugestões", () => {
  it("pedido pendente vira Solicitado e continua sugestão", () => {
    const suggestion = describeFeedSuggestion(
      { feedSource: "SUGGESTED_PROFILE", author, community: null },
      { followRequested: true }
    );

    expect(suggestion?.source).toBe("SUGGESTED_PROFILE");
    expect(suggestion?.followRequested).toBe(true);
    expect(suggestion?.actionLabel).toBe("Solicitado");
    expect(suggestion?.actionHint).toContain("cancelar");
  });

  it("sem pedido o botão continua Seguir", () => {
    const suggestion = describeFeedSuggestion({
      feedSource: "SUGGESTED_PROFILE",
      author,
      community: null,
    });

    expect(suggestion?.followRequested).toBe(false);
  });

  it("só vira FOLLOWING quando o backend confirma que passou a seguir", () => {
    expect(feedSourceAfterFollow({ following: true, followRequested: false })).toBe("FOLLOWING");
    expect(feedSourceAfterFollow({ following: false, followRequested: true })).toBe(
      "SUGGESTED_PROFILE"
    );
  });
});
