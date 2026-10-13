/**
 * Hook de acesso ao servico central de TTS.
 *
 * O servico e um singleton (assim `speak` funciona ate fora de componentes,
 * ex.: toasts globais); este hook expoe o estado de forma reativa via
 * `useSyncExternalStore` para os componentes que precisam re-renderizar
 * quando a preferencia muda (switch de configuracoes, gate de onboarding).
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";

import {
  completeTtsOnboarding,
  getOnDemandSpeechKey,
  getTtsState,
  setTtsEnabled,
  speak,
  speakOnDemand,
  speakSequence,
  stopOnDemandSpeech,
  stopSpeaking,
  subscribeToOnDemandSpeech,
  subscribeToTtsState,
} from "./tts-service";
import type { TtsSpeakOptions, TtsState } from "./tts-types";

export type UseTtsResult = TtsState & {
  speak: (text: string | null | undefined, options?: TtsSpeakOptions) => void;
  speakSequence: (parts: (string | null | undefined)[], options?: TtsSpeakOptions) => void;
  stop: () => void;
  setEnabled: (enabled: boolean) => void;
  completeOnboarding: (enabled: boolean) => void;
};

export function useTTS(): UseTtsResult {
  const state = useSyncExternalStore(
    subscribeToTtsState,
    getTtsState,
    getTtsState
  );

  return useMemo(
    () => ({
      ...state,
      speak,
      speakSequence,
      stop: stopSpeaking,
      setEnabled: setTtsEnabled,
      completeOnboarding: completeTtsOnboarding,
    }),
    [state]
  );
}

/**
 * Botao "Ouvir" de um item (mensagem, publicacao): `speaking` enquanto ESTE
 * item esta sendo lido e `toggle` le/para. A troca de rota para a leitura
 * (ScreenReaderAnnouncer), entao nada fica falando em outra tela.
 */
export function useOnDemandSpeech(key: string) {
  const activeKey = useSyncExternalStore(
    subscribeToOnDemandSpeech,
    getOnDemandSpeechKey,
    getOnDemandSpeechKey
  );

  const toggle = useCallback(
    (text: string | null | undefined) => {
      if (getOnDemandSpeechKey() === key) {
        stopOnDemandSpeech();
        return false;
      }

      return speakOnDemand(key, text);
    },
    [key]
  );

  return { speaking: activeKey === key, toggle };
}
