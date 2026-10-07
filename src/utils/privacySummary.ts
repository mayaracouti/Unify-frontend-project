import type { UserPrivacySettingsResponse, UserPrivacySettingsUpdateRequest } from "../types/privacy";

/** Usa somente opções que o backend atual já aplica. */
export const RESERVED_PRIVACY_SETTINGS: UserPrivacySettingsUpdateRequest = {
  discoverable: false,
  feedVisibility: "FOLLOWERS_ONLY",
  showAge: false,
  showDistance: false,
  followApprovalRequired: true,
  profileFieldVisibility: {
    DISABILITIES: "HIDDEN",
    ACCESSIBILITY_NEEDS: "HIDDEN",
    AUTONOMY_LEVEL: "HIDDEN",
  },
};

export function personalFeedAudience(settings: UserPrivacySettingsResponse): string {
  return settings.followApprovalRequired || settings.feedVisibility === "FOLLOWERS_ONLY"
    ? "Suas publicações pessoais são visíveis apenas para seguidores."
    : "Suas publicações pessoais são visíveis para todos no aplicativo e podem aparecer como sugestões.";
}

export function privacySummary(settings: UserPrivacySettingsResponse): string[] {
  return [
    personalFeedAudience(settings),
    settings.discoverable
      ? "Seu perfil aparece na descoberta de Encontros."
      : "Seu perfil está fora da descoberta de Encontros. Matches e conversas existentes continuam.",
    `Sua idade está ${settings.showAge ? "visível" : "oculta"} e sua distância está ${settings.showDistance ? "visível" : "oculta"}.`,
    settings.followApprovalRequired
      ? "Novos seguidores precisam da sua aprovação."
      : "Novos seguidores não precisam da sua aprovação.",
  ];
}
