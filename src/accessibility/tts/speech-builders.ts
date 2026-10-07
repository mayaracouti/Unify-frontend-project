import { postSpeechParts } from "../../community/post-content";
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
import type { ChatMessageResponse, ConversationSummaryResponse } from "../../types/chat";
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
import type { UserPostCommentResponse, UserPostResponse } from "../../types/social";
import type { ProfileField } from "../../types/privacy";
import {
  LOCKED_PROFILE_NOTICE,
  LOCKED_PROFILE_PARTIAL_NOTICE,
  presentationAudioNotice,
} from "../../utils/accessibilityAnnouncements";
import { describeAudioMessage, formatTimeForSpeech } from "../../utils/chatFormatting";
import { chatImageCaptionLabel } from "../../utils/chatImageDescription";
import { describeFeedSuggestion } from "../../utils/feedSource";
import { getHiddenFields, profileFieldLabel } from "../../utils/profileFieldVisibility";

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

function formatDistance(distanceKm: number | null | undefined): string | null {
  return typeof distanceKm === "number" && Number.isFinite(distanceKm) && distanceKm >= 0
    ? `a ${Math.round(distanceKm)} quilômetros`
    : null;
}

/** Frase final quando o dono escondeu alguma parte do perfil do visitante. */
export const PRIVATE_PROFILE_FIELDS_NOTICE = "Algumas informações deste perfil são privadas.";

export { LOCKED_PROFILE_NOTICE, LOCKED_PROFILE_PARTIAL_NOTICE };

/** Dados de match que um perfil travado ainda pode mostrar (match mutuo). */
type MatchDataKey =
  | "gender"
  | "pronouns"
  | "disabilities"
  | "accessibilityNeeds"
  | "autonomyLevel"
  | "communicationForms"
  | "lifestyleTypes"
  | "loveLanguages"
  | "energyLevel"
  | "interestTypes";

const MATCH_DATA_FIELDS: readonly { key: MatchDataKey; field: ProfileField }[] = [
  { key: "gender", field: "GENDER" },
  { key: "pronouns", field: "PRONOUNS" },
  { key: "disabilities", field: "DISABILITIES" },
  { key: "accessibilityNeeds", field: "ACCESSIBILITY_NEEDS" },
  { key: "autonomyLevel", field: "AUTONOMY_LEVEL" },
  { key: "communicationForms", field: "COMMUNICATION_FORMS" },
  { key: "lifestyleTypes", field: "LIFESTYLE_TYPES" },
  { key: "loveLanguages", field: "LOVE_LANGUAGES" },
  { key: "energyLevel", field: "ENERGY_LEVEL" },
  { key: "interestTypes", field: "INTEREST_TYPES" },
];

export type VisibleProfilePartsInput = Partial<
  Pick<UserPublicProfileResponse, MatchDataKey | "age" | "distanceKm">
> & {
  hiddenFields?: UserPublicProfileResponse["hiddenFields"] | null;
};

/**
 * Partes que um perfil travado ainda mostra, ja em frases: "28 anos, a 5
 * quilômetros", "Gênero: Mulher", "Interesses: Música, Trilhas"... Partes em
 * `hiddenFields` e valores vazios saem. Visitante comum (tudo escondido) = `[]`.
 */
export function buildVisibleProfilePartsSpeech(
  profile: VisibleProfilePartsInput | null | undefined
): string[] {
  if (!profile) {
    return [];
  }

  const hiddenFields = getHiddenFields(profile);
  const sentences: string[] = [];
  const basics = joinSpeechParts(
    [formatAge(profile.age), formatDistance(profile.distanceKm)],
    ", "
  );

  if (basics) {
    sentences.push(basics);
  }

  for (const { key, field } of MATCH_DATA_FIELDS) {
    if (hiddenFields.includes(field)) {
      continue;
    }

    const value = profile[key];
    const items = (Array.isArray(value) ? value : value ? [value] : [])
      .map((item) => item?.description?.trim() ?? "")
      .filter((description) => description.length > 0);

    if (items.length > 0) {
      sentences.push(`${profileFieldLabel(field)}: ${items.join(", ")}`);
    }
  }

  return sentences;
}

/**
 * Junta frases com ". ", sem dobrar a pontuacao quando a anterior ja termina
 * em ".", "!", "?" ou "…" (bio digitada pela pessoa).
 */
function joinSentences(parts: (string | null | undefined)[]): string | null {
  const meaningful = parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0);

  if (meaningful.length === 0) {
    return null;
  }

  return meaningful.reduce((speech, part) =>
    /[.!?…]$/.test(speech) ? `${speech} ${part}` : `${speech}. ${part}`
  );
}

/**
 * Card de descoberta de match e perfis publicos: nome, idade, distancia, bio
 * curta e, se houver, o aviso do audio de apresentacao.
 *
 * Idade e distancia nulas (ocultadas pelo dono via privacidade, ou sem
 * localizacao) sao omitidas — nunca "0 anos". Partes em `hiddenFields` (bio,
 * audio...) nunca entram na fala, mesmo que algum valor venha preenchido; com
 * alguma parte escondida, fecha com "Algumas informações deste perfil são
 * privadas."
 *
 * Perfil travado (`locked`, conta privada que nao sigo): nome, "Conta
 * privada. Siga para ver o perfil completo." e as partes que ainda aparecem
 * (match mutuo: dados de match nao escondidos, idade/distancia). Sem nenhuma
 * parte visivel: nome e "Conta privada. Siga para ver o perfil.". Bio e audio
 * nunca entram. `visibleParts` permite passar as frases prontas (Encontros,
 * que guarda o perfil em outro formato).
 */
export function buildPublicProfileSpeech(
  profile:
    | (Pick<UserPublicProfileResponse, "name" | "age" | "bio"> & {
        distanceKm?: number | null;
        presentationAudio?: UserPublicProfileResponse["presentationAudio"];
        hiddenFields?: UserPublicProfileResponse["hiddenFields"] | null;
        locked?: boolean | null;
        visibleParts?: readonly string[] | null;
      } & Partial<Pick<UserPublicProfileResponse, MatchDataKey>>)
    | null
    | undefined
): string | null {
  if (!profile) {
    return null;
  }

  if (profile.locked) {
    const visibleParts = profile.visibleParts ?? buildVisibleProfilePartsSpeech(profile);

    return visibleParts.length > 0
      ? joinSentences([profile.name ?? null, LOCKED_PROFILE_PARTIAL_NOTICE, ...visibleParts])
      : joinSentences([profile.name ?? null, LOCKED_PROFILE_NOTICE]);
  }

  const hiddenFields = getHiddenFields(profile);
  const bio = hiddenFields.includes("BIO") ? null : profile.bio;
  const audioSeconds = hiddenFields.includes("PRESENTATION_AUDIO")
    ? null
    : profile.presentationAudio?.durationSeconds;

  return joinSentences([
    joinSpeechParts(
      [profile.name ?? null, formatAge(profile.age), formatDistance(profile.distanceKm)],
      ", "
    ),
    toConcise(bio),
    // Sem o ponto final do aviso: mantem a fala existente (o TTS ignora).
    presentationAudioNotice(audioSeconds)?.replace(/\.$/, "") ?? null,
    hiddenFields.length > 0 ? PRIVATE_PROFILE_FIELDS_NOTICE : null,
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
    ...postSpeechParts({ ...post, hasImage: Boolean(post.mediaData), origin: "COMMUNITY" }),
    joinSpeechParts([likes, comments], ", "),
  ]);
}

function formatLikesSpeech(likesCount: number | null | undefined): string | null {
  if (typeof likesCount !== "number") {
    return null;
  }

  return likesCount === 1 ? "1 curtida" : `${likesCount} curtidas`;
}

function formatCommentsSpeech(commentsCount: number | null | undefined): string | null {
  if (typeof commentsCount !== "number") {
    return null;
  }

  return commentsCount === 1 ? "1 comentário" : `${commentsCount} comentários`;
}

/**
 * Publicacao do feed unificado (Inicio, Perfil, perfil publico): autor,
 * comunidade de origem quando houver, corpo, contadores e marca de edicao.
 */
export function buildFeedPostSpeech(
  post: UserPostResponse | null | undefined
): string | null {
  if (!post) {
    return null;
  }

  const authorName = post.author?.name?.trim() || null;
  const communityName = post.community?.name?.trim() || null;
  const heading = authorName
    ? communityName
      ? `Publicação de ${authorName} na comunidade ${communityName}`
      : `Publicação de ${authorName}`
    : "Publicação";
  // Sugestao do feed do Inicio: diz o porque antes do conteudo.
  const suggestion = describeFeedSuggestion(post);

  return joinSpeechParts([
    suggestion ? `${suggestion.label}, ${suggestion.reason}` : null,
    heading,
    toConcise(post.body, 200),
    joinSpeechParts([formatLikesSpeech(post.likesCount), formatCommentsSpeech(post.commentsCount)], ", "),
    post.editedAt ? "Editada" : null,
  ]);
}

/** Comentario de post pessoal: autor + corpo. */
export function buildUserPostCommentSpeech(
  comment: UserPostCommentResponse | null | undefined
): string | null {
  if (!comment) {
    return null;
  }

  return joinSpeechParts([
    comment.author?.name ? `Comentário de ${comment.author.name}` : "Comentário",
    toConcise(comment.body, 200),
  ]);
}

/** Comentario: autor, corpo completo e descrição da imagem. */
export function buildCommunityCommentSpeech(
  comment: CommunityCommentResponse | null | undefined
): string | null {
  if (!comment) {
    return null;
  }

  return joinSpeechParts([
    comment.author?.name ? `Comentário de ${comment.author.name}` : "Comentário",
    comment.body,
    comment.mediaData && comment.imageDescription?.trim() ? `Descrição da imagem: ${comment.imageDescription.trim()}` : null,
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
// Chat
// ---------------------------------------------------------------------------

/** Mesmo titulo visual da tela `app/chats/index.tsx`. */
export const CONVERSATIONS_SCREEN_NAME = "Conversas";

/** Limite do texto de cada mensagem lida em voz alta na entrada da conversa. */
const CHAT_MESSAGE_SPEECH_MAX_LENGTH = 300;

function formatUnreadMessagesCount(count: number): string {
  if (count <= 0) {
    return "Nenhuma mensagem não lida";
  }

  return count === 1 ? "1 mensagem não lida" : `${count} mensagens não lidas`;
}

export function conversationPartnerName(
  conversation: Pick<ConversationSummaryResponse, "otherUserName">
): string {
  return conversation.otherUserName?.trim() || "Pessoa sem nome";
}

/** Ultima mensagem da conversa: "Marina: oi" / "Você: Imagem" / "Ainda sem mensagens". */
export function buildConversationLastMessageSpeech(
  conversation: ConversationSummaryResponse
): string {
  const name = conversationPartnerName(conversation);
  const last = conversation.lastMessage;

  if (!last) {
    return `${name}: ainda sem mensagens`;
  }

  const preview = toConcise(last.preview, CHAT_MESSAGE_SPEECH_MAX_LENGTH) ?? "";

  return `${last.fromMe ? "Você" : name}: ${preview}`.trim();
}

/**
 * Sequencia de entrada na lista de conversas, na ordem em que a informacao
 * importa: nome da tela, quantas conversas tem mensagem pendente e, para cada
 * uma delas, o nome da pessoa e a ultima mensagem.
 *
 * Devolve UMA parte por frase para `speakSequence` (fila do motor de fala) —
 * assim a leitura nao estoura o limite de uma utterance e cada conversa sai
 * com a pausa natural entre frases.
 */
export function buildConversationListEntrySpeech(
  conversations: ConversationSummaryResponse[]
): string[] {
  const parts = [CONVERSATIONS_SCREEN_NAME];

  if (conversations.length === 0) {
    parts.push("Você ainda não tem conversas");
    return parts;
  }

  const pending = conversations.filter((conversation) => conversation.unreadCount > 0);

  if (pending.length === 0) {
    parts.push("Nenhuma conversa com mensagem não lida");
    return parts;
  }

  parts.push(
    pending.length === 1
      ? "1 conversa com mensagem não lida"
      : `${pending.length} conversas com mensagens não lidas`
  );

  for (const conversation of pending) {
    // Conversa pendente: quem falou por ultimo e a outra pessoa, entao a
    // frase sai "Nome: mensagem" sem prefixo redundante.
    const name = conversationPartnerName(conversation);
    const preview = conversation.lastMessage
      ? toConcise(conversation.lastMessage.preview, CHAT_MESSAGE_SPEECH_MAX_LENGTH)
      : null;

    parts.push(preview ? `${name}: ${preview}` : name);
  }

  return parts;
}

/**
 * Uma mensagem do chat lida em voz alta: tipo (omitido quando e texto),
 * horario e conteudo. Ex.: "hoje às 14:29. Oi, tudo bem?" ou
 * "Imagem, hoje às 14:30. Legenda: olha isso".
 */
export function buildChatMessageSpeech(
  message: ChatMessageResponse | null | undefined
): string | null {
  if (!message) {
    return null;
  }

  const when = formatTimeForSpeech(message.createdAt);

  if (message.deletedAt) {
    return `Mensagem apagada, ${when}`;
  }

  const caption = message.body
    ? `Legenda: ${toConcise(message.body, CHAT_MESSAGE_SPEECH_MAX_LENGTH)}`
    : null;

  switch (message.type) {
    case "TEXT":
      return joinSpeechParts([when, toConcise(message.body, CHAT_MESSAGE_SPEECH_MAX_LENGTH)]);
    case "IMAGE":
      return joinSpeechParts([`Imagem, ${when}`, chatImageCaptionLabel(message.body)]);
    case "AUDIO":
      return joinSpeechParts([`${describeAudioMessage(message.mediaDurationSeconds)}, ${when}`, caption]);
    case "VIDEO":
      return joinSpeechParts([`Vídeo, ${when}`, caption]);
    default:
      return joinSpeechParts([when, toConcise(message.body, CHAT_MESSAGE_SPEECH_MAX_LENGTH)]);
  }
}

/** Ordena da mais antiga para a mais recente: a leitura segue a conversa. */
function sortChronologically(messages: ChatMessageResponse[]): ChatMessageResponse[] {
  return [...messages].sort(
    (first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime()
  );
}

/**
 * Sequencia de entrada em uma conversa: nome da pessoa, total de mensagens
 * nao lidas e cada uma delas (tipo quando nao e texto, horario e conteudo).
 *
 * `unreadCount` vem do backend e pode ser maior que `unreadMessages` quando a
 * primeira pagina nao alcanca todas as pendentes: fala-se o total real e le-se
 * o que esta carregado.
 */
export function buildConversationEntrySpeech(
  otherName: string,
  unreadMessages: ChatMessageResponse[],
  unreadCount: number
): string[] {
  const total = Math.max(unreadCount, unreadMessages.length);
  const parts = [`Conversa com ${otherName}`, formatUnreadMessagesCount(total)];

  for (const message of sortChronologically(unreadMessages)) {
    parts.push(buildChatMessageSpeech(message) ?? "");
  }

  return parts.filter((part) => part.length > 0);
}

/** Mensagens que chegaram com a conversa aberta: aviso + leitura de cada uma. */
export function buildIncomingMessagesSpeech(
  incoming: ChatMessageResponse[],
  otherName: string
): string[] {
  if (incoming.length === 0) {
    return [];
  }

  const parts = [
    incoming.length === 1
      ? `Nova mensagem de ${otherName}`
      : `${incoming.length} novas mensagens de ${otherName}`,
  ];

  for (const message of sortChronologically(incoming)) {
    parts.push(buildChatMessageSpeech(message) ?? "");
  }

  return parts.filter((part) => part.length > 0);
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
