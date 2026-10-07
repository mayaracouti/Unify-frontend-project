/**
 * Tipos do sistema central de leitura por voz (TTS) do app.
 */

/** Preferencia persistida localmente (sobrevive a reinicios do app). */
export type TtsPreference = {
  /** Leitura por voz ligada? Primeiro launch = `true` (acessibilidade por padrao). */
  enabled: boolean;
  /** Velocidade local da leitura: 0.75, 1 ou 1.25. */
  rate?: number;
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
   * Fala mesmo com a preferência de leitura automática desligada. Usado em
   * confirmações da preferência e em controles que pedem reprodução de áudio
   * explicitamente. Continua respeitando a prioridade do leitor de tela nativo.
   */
  force?: boolean;
  /**
   * Por padrao (`true`) a fala anterior e interrompida para que o toque mais
   * recente tenha prioridade (politica anti-fila para toques rapidos).
   */
  interrupt?: boolean;
};
