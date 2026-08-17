/**
 * Builders semanticos de fala: transformam objetos de dominio (vindos do
 * backend em runtime) em frases naturais pt-BR para o TTS.
 *
 * Regras:
 * - Sempre usar o dado de runtime (nunca duplicar conteudo em string fixa).
 * - Campos ausentes sao simplesmente omitidos.
 * - IDs tecnicos, URLs, tokens e campos sensiveis (e-mail, telefone) NUNCA
 *   entram na fala.
 * - O resultado pode ser `null` quando nao ha nada significativo a dizer —
 *   `speak()` aceita `null` e ignora.
 */
import type {
  CommunityCategoryResponse,
  CommunityCommentResponse,
  CommunityMemberResponse,
  CommunityPostResponse,
  CommunityRole,
  CommunitySummaryResponse,
} from "../../types/community";
import type { MutualMatchSummaryResponse } from "../../types/match";
import type { LookupOptionResponse, UserPublicProfileResponse } from "../../types/profile";

/** Junta partes nao vazias em uma frase unica. */
export function joinSpeechParts(
  parts: (string | null | undefined)[],
  separator = ". "
): string | null {
  const meaningful = parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0);

  return meaningful.length > 0 ? meaningful.join(separator) : null;
}

/** Trunca texto corrido (bio, post) para manter a fala concisa. */
function toConcise(text: string | null | undefined, maxLength = 160): string | null {
  const trimmed = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";

  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const cut = trimmed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");

  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}

function formatAge(age: number | null | undefined): string | null {
  return typeof age === "number" && Number.isFinite(age) && age > 0
    ? `${age} anos`
    : null;
}

// ---------------------------------------------------------------------------
// Perfis / matches
// ---------------------------------------------------------------------------

/** Card de descoberta de match e perfis publicos: nome, idade e bio curta. */
export function buildPublicProfileSpeech(
  profile: Pick<UserPublicProfileResponse, "name" | "age" | "bio"> | null | undefined
): string | null {
  if (!profile) {
    return null;
  }

  return joinSpeechParts([
    joinSpeechParts([profile.name ?? null, formatAge(profile.age)], ", "),
    toConcise(profile.bio),
  ]);
}

/** Item da lista de matches mutuos. */
export function buildMutualMatchSpeech(
  match: Pick<MutualMatchSummaryResponse, "fullName" | "age"> | null | undefined
): string | null {
  if (!match) {
    return null;
  }

  return joinSpeechParts([match.fullName ?? null, formatAge(match.age)], ", ");
}

// ---------------------------------------------------------------------------
// Comunidades
// ---------------------------------------------------------------------------

function formatMemberCountSpeech(memberCount?: number | null): string | null {
  if (typeof memberCount !== "number" || !Number.isFinite(memberCount)) {
    return null;
  }

  return memberCount === 1 ? "1 membro" : `${memberCount} membros`;
}

/** Card de comunidade: nome, descricao, categoria, membros e participacao. */
export function buildCommunitySpeech(
  community: CommunitySummaryResponse | null | undefined
): string | null {
  if (!community) {
    return null;
  }

  return joinSpeechParts([
    community.name,
    toConcise(community.description),
    community.category?.description ?? null,
    formatMemberCountSpeech(community.memberCount),
    community.isMember === true ? "Você participa" : null,
  ]);
}

/** Publicacao do feed: autor, corpo e contadores. */
export function buildCommunityPostSpeech(
  post: CommunityPostResponse | null | undefined
): string | null {
  if (!post) {
    return null;
  }

  const likes =
    typeof post.likesCount === "number"
      ? post.likesCount === 1
        ? "1 curtida"
        : `${post.likesCount} curtidas`
      : null;
  const comments =
    typeof post.commentsCount === "number"
      ? post.commentsCount === 1
        ? "1 comentário"
        : `${post.commentsCount} comentários`
      : null;

  return joinSpeechParts([
    post.author?.name ? `Publicação de ${post.author.name}` : "Publicação",
    toConcise(post.body, 200),
    joinSpeechParts([likes, comments], ", "),
  ]);
}

/** Comentario: autor + corpo. */
export function buildCommunityCommentSpeech(
  comment: CommunityCommentResponse | null | undefined
): string | null {
  if (!comment) {
    return null;
  }

  return joinSpeechParts([
    comment.author?.name ? `Comentário de ${comment.author.name}` : "Comentário",
    toConcise(comment.body, 200),
  ]);
}

export function traduzirRoleParaFala(
  role: CommunityRole | null | undefined,
  isOwner?: boolean | null
): string | null {
  if (isOwner) {
    return "Criador da comunidade";
  }

  switch (role) {
    case "ADMIN":
      return "Administrador";
    case "MODERATOR":
      return "Moderador";
    case "MEMBER":
      return "Membro";
    default:
      return null;
  }
}

/** Membro na lista de gerenciamento: nome + papel. */
export function buildCommunityMemberSpeech(
  member: CommunityMemberResponse | null | undefined
): string | null {
  if (!member) {
    return null;
  }

  return joinSpeechParts(
    [
      member.name,
      traduzirRoleParaFala(member.role, member.isOwner ?? member.owner),
    ],
    ", "
  );
}

/** Chip/opcao de categoria de comunidade. */
export function buildCategorySpeech(
  category: CommunityCategoryResponse | null | undefined
): string | null {
  return category?.description?.trim() || null;
}

// ---------------------------------------------------------------------------
// Controles genericos (selecoes, switches, acoes)
// ---------------------------------------------------------------------------

/** Opcao de lookup (genero, interesse, etc.) selecionada/removida. */
export function buildOptionToggleSpeech(
  option: Pick<LookupOptionResponse, "description"> | string | null | undefined,
  selected: boolean
): string | null {
  const label =
    typeof option === "string" ? option : option?.description ?? null;

  if (!label || !label.trim()) {
    return null;
  }

  return `${label.trim()}, ${selected ? "selecionado" : "removido"}`;
}

/** Switch/checkbox: "Rotulo, ativado" / "Rotulo, desativado". */
export function buildSwitchSpeech(
  label: string | null | undefined,
  enabled: boolean
): string | null {
  const trimmed = label?.trim();

  if (!trimmed) {
    return null;
  }

  return `${trimmed}, ${enabled ? "ativado" : "desativado"}`;
}

/**
 * Acao sobre uma entidade dinamica: "Excluir" + "Maria" = "Excluir Maria".
 * Sem alvo significativo, fala apenas a acao.
 */
export function buildActionSpeech(
  action: string,
  target?: string | null
): string | null {
  const trimmedAction = action.trim();

  if (!trimmedAction) {
    return null;
  }

  const trimmedTarget = target?.trim();

  return trimmedTarget ? `${trimmedAction} ${trimmedTarget}` : trimmedAction;
}
