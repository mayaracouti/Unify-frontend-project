import type { FeedSource, UserPostResponse } from "../types/social";

export type FeedSuggestionAction = "follow" | "join";

/**
 * Como apresentar uma SUGESTÃO do feed ranqueado da aba Início.
 *
 * O backend marca cada post com `feedSource`; só as fontes `SUGGESTED_*`
 * viram um selo visível ("Sugestão para você") com uma ação rápida — seguir a
 * pessoa ou entrar na comunidade — para descobrir gente e comunidades sem
 * sair do feed. Posts de quem eu sigo / das minhas comunidades não ganham selo.
 */
export type FeedSuggestion = {
  source: Extract<FeedSource, "SUGGESTED_PROFILE" | "SUGGESTED_COMMUNITY">;
  /** Texto curto do selo acima do post. */
  label: string;
  /** Frase falada/lida junto com o selo, explica o porquê da sugestão. */
  reason: string;
  action: FeedSuggestionAction;
  /** Rótulo do botão de ação rápida. */
  actionLabel: string;
  actionHint: string;
};

function displayName(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function describeFeedSuggestion(
  post: Pick<UserPostResponse, "feedSource" | "author" | "community"> | null | undefined
): FeedSuggestion | null {
  if (!post?.feedSource) {
    return null;
  }

  if (post.feedSource === "SUGGESTED_PROFILE") {
    const name = displayName(post.author?.name, "esta pessoa");
    return {
      source: "SUGGESTED_PROFILE",
      label: "Sugestão para você",
      reason: `${name} tem interesses parecidos com os seus`,
      action: "follow",
      actionLabel: "Seguir",
      actionHint: `Passa a seguir ${name}. As publicações dela aparecem no seu feed`,
    };
  }

  if (post.feedSource === "SUGGESTED_COMMUNITY") {
    const name = displayName(post.community?.name, "esta comunidade");
    return {
      source: "SUGGESTED_COMMUNITY",
      label: "Comunidade sugerida",
      reason: `${name} é uma comunidade pública que combina com você`,
      action: "join",
      actionLabel: "Entrar",
      actionHint: `Entra na comunidade ${name}. É pública, a entrada é imediata`,
    };
  }

  return null;
}

/** Fonte que o post passa a ter depois da ação rápida dar certo. */
export function feedSourceAfterAction(action: FeedSuggestionAction): FeedSource {
  return action === "follow" ? "FOLLOWING" : "MEMBER_COMMUNITY";
}
