import type { FeedSource, FollowActionResponse, UserPostResponse } from "../types/social";

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
  /**
   * Perfil sugerido com pedido para seguir PENDENTE (a pessoa aprova
   * seguidores): o botao vira "Solicitado" e tocar cancela o pedido. O post
   * continua sugestao — um pedido nunca vira `FOLLOWING`.
   */
  followRequested: boolean;
};

function displayName(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function describeFeedSuggestion(
  post: Pick<UserPostResponse, "feedSource" | "author" | "community"> | null | undefined,
  options?: { followRequested?: boolean }
): FeedSuggestion | null {
  if (!post?.feedSource) {
    return null;
  }

  if (post.feedSource === "SUGGESTED_PROFILE") {
    const name = displayName(post.author?.name, "esta pessoa");

    if (options?.followRequested) {
      return {
        source: "SUGGESTED_PROFILE",
        label: "Sugestão para você",
        reason: `${name} tem interesses parecidos com os seus`,
        action: "follow",
        actionLabel: "Solicitado",
        actionHint: `Pedido para seguir ${name} pendente. Toque para cancelar o pedido. Pede confirmação antes`,
        followRequested: true,
      };
    }

    return {
      source: "SUGGESTED_PROFILE",
      label: "Sugestão para você",
      reason: `${name} tem interesses parecidos com os seus`,
      action: "follow",
      actionLabel: "Seguir",
      actionHint: `Passa a seguir ${name}, ou envia um pedido se a pessoa aprovar seguidores. As publicações dela aparecem no seu feed`,
      followRequested: false,
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
      followRequested: false,
    };
  }

  return null;
}

/** Fonte que o post passa a ter depois da ação rápida dar certo. */
export function feedSourceAfterAction(action: FeedSuggestionAction): FeedSource {
  return action === "follow" ? "FOLLOWING" : "MEMBER_COMMUNITY";
}

/**
 * Fonte do post depois de tocar em "Seguir" numa sugestao: so vira
 * `FOLLOWING` quando o backend confirma que passei a seguir. Pedido pendente
 * (`followRequested`) continua `SUGGESTED_PROFILE`.
 */
export function feedSourceAfterFollow(
  response: Pick<FollowActionResponse, "following" | "followRequested">
): FeedSource {
  return response.following ? "FOLLOWING" : "SUGGESTED_PROFILE";
}
