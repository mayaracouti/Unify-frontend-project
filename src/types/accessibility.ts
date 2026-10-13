export type FontScaleOption = "SMALL" | "MEDIUM" | "LARGE" | "EXTRA_LARGE";

export interface UserAccessibilitySettingsResponse {
  fontScale: FontScaleOption;
  fontScaleMultiplier: number;
  highContrast: boolean;
  reduceMotion: boolean;
  /**
   * Opt-in (padrao desligado): no Encontros, tocar o audio de apresentacao
   * sozinho DEPOIS da leitura do perfil. Nunca com TalkBack/VoiceOver ligado.
   * Pode faltar em cache gravado por versao anterior do app (= desligado).
   */
  autoplayPresentationAudio?: boolean;
}

export interface UserAccessibilitySettingsUpsertRequest {
  fontScale: FontScaleOption;
  highContrast: boolean;
  reduceMotion: boolean;
  autoplayPresentationAudio: boolean;
}
