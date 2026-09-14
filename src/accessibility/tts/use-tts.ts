/**
 * Hook de acesso ao servico central de TTS.
 *
 * O servico e um singleton (assim `speak` funciona ate fora de componentes,
 * ex.: toasts globais); este hook expoe o estado de forma reativa via
 * `useSyncExternalStore` para os componentes que precisam re-renderizar
 * quando a preferencia muda (switch de configuracoes, gate de onboarding).
 */
import { useMemo, useSyncExternalStore } from "react";

import {
  completeTtsOnboarding,
  getTtsState,
  setTtsEnabled,
  speak,
  speakSequence,
  stopSpeaking,
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
