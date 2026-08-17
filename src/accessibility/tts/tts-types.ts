/**
 * Tipos do sistema central de leitura por voz (TTS) do app.
 */

/** Preferencia persistida localmente (sobrevive a reinicios do app). */
export type TtsPreference = {
  /** Leitura por voz ligada? Primeiro launch = `true` (acessibilidade por padrao). */
  enabled: boolean;
  /** O onboarding de acessibilidade do primeiro launch ja foi concluido? */
  onboardingCompleted: boolean;
};

/** Estado em memoria do servico (preferencia + prontidao da hidratacao). */
export type TtsState = TtsPreference & {
  /** `true` depois que a preferencia persistida foi carregada do storage. */
  isReady: boolean;
};

export type TtsSpeakOptions = {
  /**
   * Fala mesmo com a preferencia desligada. Usado apenas para confirmar ao
   * usuario que ele acabou de desligar/ligar o proprio recurso.
   */
  force?: boolean;
  /**
   * Por padrao (`true`) a fala anterior e interrompida para que o toque mais
   * recente tenha prioridade (politica anti-fila para toques rapidos).
   */
  interrupt?: boolean;
};
