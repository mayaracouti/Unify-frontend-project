/**
 * Leitor de tela in-app (TTS).
 *
 * A preferencia `screenReaderOptimized` passa a produzir leitura audivel real
 * via `expo-speech`. Duas guardas evitam ruido:
 *
 * 1. So fala quando a preferencia esta ligada (lida do singleton global).
 * 2. Nunca fala quando o leitor de tela DO SISTEMA (TalkBack/VoiceOver) esta
 *    ativo — nesse caso quem narra e o proprio sistema, e o `speak()` duplicaria
 *    tudo que o `AccessibilityInfo.announceForAccessibility` ja anuncia.
 */
import * as Speech from "expo-speech";
import { AccessibilityInfo } from "react-native";

import { getGlobalTextAdjustments } from "./global-text-adjustments";

const SPEECH_LANGUAGE = "pt-BR";

let systemScreenReaderEnabled = false;
let systemScreenReaderTrackingStarted = false;

function ensureSystemScreenReaderTracking(): void {
  if (systemScreenReaderTrackingStarted) {
    return;
  }

  systemScreenReaderTrackingStarted = true;

  void AccessibilityInfo.isScreenReaderEnabled()
    .then((enabled) => {
      systemScreenReaderEnabled = enabled;
    })
    .catch(() => {
      systemScreenReaderEnabled = false;
    });

  AccessibilityInfo.addEventListener("screenReaderChanged", (enabled) => {
    systemScreenReaderEnabled = enabled;
  });
}

export function isSystemScreenReaderEnabled(): boolean {
  ensureSystemScreenReaderTracking();

  return systemScreenReaderEnabled;
}

/** `true` quando a narracao do app deve assumir o papel de leitor de tela. */
export function isInAppScreenReaderEnabled(): boolean {
  return (
    getGlobalTextAdjustments().screenReaderOptimized &&
    !isSystemScreenReaderEnabled()
  );
}

export type SpeakOptions = {
  /**
   * Ignora a checagem da preferencia `screenReaderOptimized` (usado para
   * confirmar ao usuario que ele acabou de ligar/desligar o recurso, antes do
   * singleton global ser atualizado). A guarda do leitor do sistema continua
   * valendo.
   */
  force?: boolean;
};

export function speak(text: string, options: SpeakOptions = {}): void {
  const message = typeof text === "string" ? text.trim() : "";

  if (!message) {
    return;
  }

  if (isSystemScreenReaderEnabled()) {
    return;
  }

  if (options.force !== true && !getGlobalTextAdjustments().screenReaderOptimized) {
    return;
  }

  // Interrompe a fala anterior para que o anuncio mais recente tenha prioridade.
  void Speech.stop()
    .catch(() => undefined)
    .then(() => {
      Speech.speak(message, { language: SPEECH_LANGUAGE });
    });
}

export function stopSpeaking(): void {
  void Speech.stop().catch(() => undefined);
}
