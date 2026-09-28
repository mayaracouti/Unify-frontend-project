/**
 * Helpers puros da visibilidade granular das partes do perfil (semana 04).
 *
 * - Tela de privacidade: rotulos pt-BR, label acessivel de cada linha e
 *   normalizacao do mapa vindo do backend.
 * - Perfil publico / Encontros: `hiddenFields` lido de forma tolerante (backend
 *   antigo sem o campo, `null`, valores repetidos).
 */
import {
  PROFILE_FIELD_OPTIONS,
  PROFILE_FIELD_VISIBILITY_OPTIONS,
  type ProfileField,
  type ProfileFieldVisibility,
  type UserPrivacySettingsResponse,
} from "../types/privacy";

export const DEFAULT_PROFILE_FIELD_VISIBILITY: ProfileFieldVisibility = "PUBLIC";

const KNOWN_FIELDS = new Set<string>(PROFILE_FIELD_OPTIONS.map((option) => option.field));
const KNOWN_VISIBILITIES = new Set<string>(
  PROFILE_FIELD_VISIBILITY_OPTIONS.map((option) => option.value)
);

/** "Sobre mim", "Gênero"... (cai para a propria chave se vier algo novo). */
export function profileFieldLabel(field: ProfileField): string {
  return PROFILE_FIELD_OPTIONS.find((option) => option.field === field)?.label ?? field;
}

/** "Todos", "Só quem me segue", "Só quem eu sigo", "Ninguém". */
export function profileFieldVisibilityLabel(
  visibility: ProfileFieldVisibility | null | undefined
): string {
  const resolved = visibility ?? DEFAULT_PROFILE_FIELD_VISIBILITY;

  return (
    PROFILE_FIELD_VISIBILITY_OPTIONS.find((option) => option.value === resolved)?.label ??
    PROFILE_FIELD_VISIBILITY_OPTIONS[0].label
  );
}

/** Descricao curta do modo (texto de apoio e `accessibilityHint`). */
export function profileFieldVisibilityDescription(
  visibility: ProfileFieldVisibility | null | undefined
): string {
  const resolved = visibility ?? DEFAULT_PROFILE_FIELD_VISIBILITY;

  return (
    PROFILE_FIELD_VISIBILITY_OPTIONS.find((option) => option.value === resolved)?.description ??
    PROFILE_FIELD_VISIBILITY_OPTIONS[0].description
  );
}

/** Label da linha na tela de privacidade: "Gênero: Ninguém. Toque para alterar". */
export function buildProfileFieldRowLabel(
  field: ProfileField,
  visibility: ProfileFieldVisibility | null | undefined
): string {
  return `${profileFieldLabel(field)}: ${profileFieldVisibilityLabel(visibility)}. Toque para alterar`;
}

/**
 * Mapa completo com as 13 chaves: preenche com `PUBLIC` o que faltar (ou vier
 * com valor desconhecido) para a tela nunca quebrar.
 */
export function normalizeProfileFieldVisibility(
  map: Partial<Record<ProfileField, ProfileFieldVisibility>> | null | undefined
): Record<ProfileField, ProfileFieldVisibility> {
  const normalized = {} as Record<ProfileField, ProfileFieldVisibility>;

  for (const { field } of PROFILE_FIELD_OPTIONS) {
    const value = map?.[field];
    normalized[field] =
      typeof value === "string" && KNOWN_VISIBILITIES.has(value)
        ? value
        : DEFAULT_PROFILE_FIELD_VISIBILITY;
  }

  return normalized;
}

/** Garante `profileFieldVisibility` completo na resposta de privacidade. */
export function normalizePrivacySettings(
  settings: UserPrivacySettingsResponse
): UserPrivacySettingsResponse {
  return {
    ...settings,
    profileFieldVisibility: normalizeProfileFieldVisibility(settings.profileFieldVisibility),
    // Backend anterior a "seguir com aprovacao" nao manda o campo.
    followApprovalRequired: settings.followApprovalRequired === true,
  };
}

/** Mapa com todas as partes no mesmo modo ("Aplicar a todas as partes"). */
export function buildUniformProfileFieldVisibility(
  visibility: ProfileFieldVisibility
): Record<ProfileField, ProfileFieldVisibility> {
  const map = {} as Record<ProfileField, ProfileFieldVisibility>;

  for (const { field } of PROFILE_FIELD_OPTIONS) {
    map[field] = visibility;
  }

  return map;
}

/** `hiddenFields` saneado: ausente/nulo vira `[]`, chaves desconhecidas saem. */
export function getHiddenFields(
  profile: { hiddenFields?: readonly ProfileField[] | null } | null | undefined
): ProfileField[] {
  const raw = profile?.hiddenFields;

  if (!Array.isArray(raw)) {
    return [];
  }

  return Array.from(new Set(raw.filter((field) => KNOWN_FIELDS.has(field))));
}

/** `true` quando o visitante NAO pode ver esta parte do perfil. */
export function isProfileFieldHidden(
  profile: { hiddenFields?: readonly ProfileField[] | null } | null | undefined,
  field: ProfileField
): boolean {
  return getHiddenFields(profile).includes(field);
}
