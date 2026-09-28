/** Quem pode ver as publicacoes pessoais do perfil (`GET /users/{id}/posts`). */
export type FeedVisibility = "PUBLIC" | "FOLLOWERS_ONLY";

/** Partes do perfil com visibilidade configuravel. */
export type ProfileField =
  | "BIO"
  | "GENDER"
  | "PRONOUNS"
  | "DISABILITIES"
  | "ACCESSIBILITY_NEEDS"
  | "AUTONOMY_LEVEL"
  | "COMMUNICATION_FORMS"
  | "LIFESTYLE_TYPES"
  | "LOVE_LANGUAGES"
  | "ENERGY_LEVEL"
  | "INTEREST_TYPES"
  | "GALLERY"
  | "PRESENTATION_AUDIO";

/**
 * Quem ve uma parte do perfil. O dono sempre ve tudo no proprio perfil.
 * - `PUBLIC`: todo mundo;
 * - `FOLLOWERS_ONLY`: escondido para quem nao me segue;
 * - `FOLLOWING_ONLY`: escondido para quem eu nao sigo;
 * - `HIDDEN`: escondido para todos.
 */
export type ProfileFieldVisibility = "PUBLIC" | "FOLLOWERS_ONLY" | "FOLLOWING_ONLY" | "HIDDEN";

/** Ordem de exibicao (tela de privacidade) com o rotulo pt-BR de cada parte. */
export const PROFILE_FIELD_OPTIONS: readonly { field: ProfileField; label: string }[] = [
  { field: "BIO", label: "Sobre mim" },
  { field: "GENDER", label: "Gênero" },
  { field: "PRONOUNS", label: "Pronomes" },
  { field: "DISABILITIES", label: "Tipo de deficiência" },
  { field: "ACCESSIBILITY_NEEDS", label: "Necessidades de acessibilidade" },
  { field: "AUTONOMY_LEVEL", label: "Nível de autonomia" },
  { field: "COMMUNICATION_FORMS", label: "Formas de comunicação" },
  { field: "LIFESTYLE_TYPES", label: "Estilo de vida" },
  { field: "LOVE_LANGUAGES", label: "Linguagens do amor" },
  { field: "ENERGY_LEVEL", label: "Ritmo de energia" },
  { field: "INTEREST_TYPES", label: "Interesses" },
  { field: "GALLERY", label: "Fotos da galeria" },
  { field: "PRESENTATION_AUDIO", label: "Áudio de apresentação" },
];

/** Os 4 modos, na ordem do mais aberto para o mais fechado. */
export const PROFILE_FIELD_VISIBILITY_OPTIONS: readonly {
  value: ProfileFieldVisibility;
  label: string;
  description: string;
}[] = [
  {
    value: "PUBLIC",
    label: "Todos",
    description: "Qualquer pessoa que abrir seu perfil vê esta parte.",
  },
  {
    value: "FOLLOWERS_ONLY",
    label: "Só quem me segue",
    description: "Só seus seguidores veem esta parte.",
  },
  {
    value: "FOLLOWING_ONLY",
    label: "Só quem eu sigo",
    description: "Só as pessoas que você segue veem esta parte.",
  },
  {
    value: "HIDDEN",
    label: "Ninguém",
    description: "Fica escondida para todo mundo. Você continua vendo no seu perfil.",
  },
];

/**
 * `GET|PUT /users/me/privacy-settings`. Quem nunca configurou recebe os
 * defaults do backend: `true` / `PUBLIC` / `true` / `true`, todas as partes
 * do perfil `PUBLIC` e `followApprovalRequired=false`.
 */
export interface UserPrivacySettingsResponse {
  /** `false` tira o perfil da descoberta do Encontros (matches existentes seguem). */
  discoverable: boolean;
  feedVisibility: FeedVisibility;
  /** `false` faz o perfil publico devolver `distanceKm: null`. */
  showDistance: boolean;
  /** `false` faz o perfil publico devolver `age: null`. */
  showAge: boolean;
  /** Sempre com as 13 chaves de `ProfileField`. */
  profileFieldVisibility: Record<ProfileField, ProfileFieldVisibility>;
  /**
   * `true`: novas pessoas so passam a me seguir depois que eu aceito o pedido.
   * Ao desligar, o backend aceita todos os pedidos pendentes recebidos.
   */
  followApprovalRequired: boolean;
}

/** Corpo parcial do `PUT`: so os campos enviados mudam. */
export interface UserPrivacySettingsUpdateRequest {
  discoverable?: boolean;
  feedVisibility?: FeedVisibility;
  showDistance?: boolean;
  showAge?: boolean;
  /** Tambem parcial: so as partes enviadas mudam (ex.: `{ GENDER: "HIDDEN" }`). */
  profileFieldVisibility?: Partial<Record<ProfileField, ProfileFieldVisibility>>;
  followApprovalRequired?: boolean;
}

/**
 * Pessoa bloqueada pelo usuario autenticado (`GET /users/me/blocks` e resposta
 * de `POST /users/{userProfileId}/block`). Nunca lista quem bloqueou voce.
 */
export interface UserBlockResponse {
  userProfileId: string;
  name: string;
  /** ISO-8601. */
  blockedAt: string;
}
