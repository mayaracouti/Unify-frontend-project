/**
 * Persistencia local da preferencia de leitura por voz (TTS).
 *
 * A preferencia e local-first: precisa existir ANTES do login (o onboarding de
 * acessibilidade roda no primeiro launch, sem usuario autenticado) e nao pode
 * ser apagada no logout. Usa o mesmo mecanismo dos demais storages do app
 * (SecureStore no nativo, localStorage no web).
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { TtsPreference } from "./tts-types";

const TTS_PREFERENCE_KEY = "unify.accessibility.tts";

/** Primeiro launch: leitura por voz LIGADA por padrao, onboarding pendente. */
export const DEFAULT_TTS_PREFERENCE: TtsPreference = {
  enabled: true,
  onboardingCompleted: false,
};

const webStorageFallback = (() => {
  if (Platform.OS !== "web") {
    return null;
  }

  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
})();

export async function getStoredTtsPreference(): Promise<TtsPreference | null> {
  try {
    const raw = webStorageFallback
      ? webStorageFallback.getItem(TTS_PREFERENCE_KEY)
      : await SecureStore.getItemAsync(TTS_PREFERENCE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<TtsPreference>;

    return {
      enabled:
        typeof parsed.enabled === "boolean"
          ? parsed.enabled
          : DEFAULT_TTS_PREFERENCE.enabled,
      onboardingCompleted: parsed.onboardingCompleted === true,
    };
  } catch {
    // Storage corrompido/indisponivel nao pode derrubar o app: cai no default.
    return null;
  }
}

export async function saveStoredTtsPreference(
  preference: TtsPreference
): Promise<void> {
  try {
    const raw = JSON.stringify(preference);

    if (webStorageFallback) {
      webStorageFallback.setItem(TTS_PREFERENCE_KEY, raw);
      return;
    }

    await SecureStore.setItemAsync(TTS_PREFERENCE_KEY, raw);
  } catch {
    // Falha de persistencia nao interrompe a acao do usuario.
  }
}
