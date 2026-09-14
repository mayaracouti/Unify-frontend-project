/**
 * Builders de fala do feed unificado (Inicio / Perfil / perfil publico) e o
 * formatador de data relativa dos cards.
 */
import type { UserPostCommentResponse, UserPostResponse } from "../../../types/social";
import { formatRelativePostDate } from "../../../utils/postFormatting";
import { buildFeedPostSpeech, buildUserPostCommentSpeech } from "../speech-builders";

function post(overrides: Partial<UserPostResponse> = {}): UserPostResponse {
  return {
    id: "p1",
    origin: "PERSONAL",
    community: null,
    author: { userProfileId: "up1", userId: "u1", name: "Marina", avatarUrl: null },
    body: "Primeiro dia no novo emprego!",
    mediaUrl: null,
    createdAt: "2026-09-14T10:00:00Z",
    editedAt: null,
    likesCount: 0,
    commentsCount: 0,
    likedByCurrentUser: false,
    commentedByCurrentUser: false,
    ...overrides,
  };
}

describe("buildFeedPostSpeech", () => {
  it("post pessoal: autor, corpo e contadores", () => {
    expect(buildFeedPostSpeech(post({ likesCount: 1, commentsCount: 3 }))).toBe(
      "Publicação de Marina. Primeiro dia no novo emprego!. 1 curtida, 3 comentários"
    );
  });

  it("post de comunidade fala a comunidade de origem e a marca de edicao", () => {
    expect(
      buildFeedPostSpeech(
        post({
          origin: "COMMUNITY",
          community: { id: "c1", name: "Ciclismo", iconUrl: null },
          editedAt: "2026-09-14T11:00:00Z",
        })
      )
    ).toBe(
      "Publicação de Marina na comunidade Ciclismo. Primeiro dia no novo emprego!. 0 curtidas, 0 comentários. Editada"
    );
  });

  it("sugestao do feed do Inicio fala o porque antes do conteudo", () => {
    expect(buildFeedPostSpeech(post({ feedSource: "SUGGESTED_PROFILE" }))).toBe(
      "Sugestão para você, Marina tem interesses parecidos com os seus. Publicação de Marina. Primeiro dia no novo emprego!. 0 curtidas, 0 comentários"
    );
    expect(
      buildFeedPostSpeech(
        post({
          origin: "COMMUNITY",
          feedSource: "SUGGESTED_COMMUNITY",
          community: { id: "c1", name: "Ciclismo", iconUrl: null },
        })
      )
    ).toBe(
      "Comunidade sugerida, Ciclismo é uma comunidade pública que combina com você. Publicação de Marina na comunidade Ciclismo. Primeiro dia no novo emprego!. 0 curtidas, 0 comentários"
    );
  });

  it("post de quem sigo ou da minha comunidade nao ganha prefixo de sugestao", () => {
    expect(buildFeedPostSpeech(post({ feedSource: "FOLLOWING" }))).toBe(
      "Publicação de Marina. Primeiro dia no novo emprego!. 0 curtidas, 0 comentários"
    );
  });

  it("nulo nao fala nada", () => {
    expect(buildFeedPostSpeech(null)).toBeNull();
  });
});

describe("buildUserPostCommentSpeech", () => {
  it("fala autor e corpo", () => {
    const comment: UserPostCommentResponse = {
      id: "c1",
      author: { userProfileId: "up2", userId: "u2", name: "João", avatarUrl: null },
      body: "Parabéns!",
      createdAt: "2026-09-14T10:05:00Z",
      commentedByCurrentUser: false,
    };

    expect(buildUserPostCommentSpeech(comment)).toBe("Comentário de João. Parabéns!");
  });
});

describe("formatRelativePostDate", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");

  it("cobre agora, minutos, horas, ontem e data", () => {
    expect(formatRelativePostDate("2026-09-14T11:59:40Z", now)).toBe("agora mesmo");
    expect(formatRelativePostDate("2026-09-14T11:45:00Z", now)).toBe("há 15 min");
    expect(formatRelativePostDate("2026-09-14T09:00:00Z", now)).toBe("há 3 h");
    expect(formatRelativePostDate("2026-09-13T06:00:00Z", now)).toBe("ontem");
    expect(formatRelativePostDate("2026-09-01T12:00:00Z", now)).toMatch(/^\d{2}\/\d{2}$/);
  });

  it("data invalida vira vazio", () => {
    expect(formatRelativePostDate("nope", now)).toBe("");
  });
});
