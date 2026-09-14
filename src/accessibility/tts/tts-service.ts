/**
 * Servico central de leitura por voz (TTS) — fonte unica de verdade.
 *
 * Toda fala do app passa por aqui. Responsabilidades:
 *
 * 1. Estado ligado/desligado, hidratado do storage local (primeiro launch =
 *    LIGADO por padrao) e persistido a cada mudanca.
 * 2. Politica de fila: toque novo interrompe a fala anterior (`Speech.stop()`
 *    antes de `Speech.speak()`), para que toques rapidos nunca acumulem uma
 *    fila de falas atrasadas.
 * 3. Normalizacao/sanitizacao do texto (vazio, "null", URLs, JSON cru, textos
 *    longos demais) — ver `normalizeSpeechText`.
 * 4. Supressao de fala duplicada: o mesmo texto pedido de novo dentro de uma
 *    janela curta e ignorado (ex.: toque na aba + anuncio de rota).
 * 5. Idioma/voz: pt-BR, com descoberta de voz compativel por plataforma.
 * 6. Guarda do leitor de tela DO SISTEMA (TalkBack/VoiceOver): quando ativo,
 *    quem narra e o sistema — falar aqui duplicaria tudo.
 * 7. Erros de fala nunca quebram a acao de negocio: tudo e engolido.
 */
import * as Speech from "expo-speech";
import { AccessibilityInfo, Platform } from "react-native";

import {
  DEFAULT_TTS_PREFERENCE,
  getStoredTtsPreference,
  saveStoredTtsPreference,
} from "./tts-storage";
import type { TtsSpeakOptions, TtsState } from "./tts-types";

const SPEECH_LANGUAGE = "pt-BR";
const SPEECH_RATE = 1;
const SPEECH_PITCH = 1;

/** Limite conservador para nao estourar `Speech.maxSpeechInputLength`. */
const MAX_SPEECH_LENGTH = 400;

/** Janela em que repetir exatamente o mesmo texto e considerado duplicata. */
const DUPLICATE_SUPPRESSION_MS = 1200;

// ---------------------------------------------------------------------------
// Estado + assinantes
// ---------------------------------------------------------------------------

let state: TtsState = { ...DEFAULT_TTS_PREFERENCE, isReady: false };

const listeners = new Set<() => void>();

function setState(next: Partial<TtsState>): void {
  const merged: TtsState = { ...state, ...next };

  if (
    merged.enabled === state.enabled &&
    merged.onboardingCompleted === state.onboardingCompleted &&
    merged.isReady === state.isReady
  ) {
    return;
  }

  state = merged;

  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Um assinante quebrado nao impede os demais.
    }
  });
}

export function getTtsState(): TtsState {
  return state;
}

export function subscribeToTtsState(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// Leitor de tela do sistema (TalkBack/VoiceOver)
// ---------------------------------------------------------------------------

let systemScreenReaderEnabled = false;
let systemScreenReaderTrackingStarted = false;

function ensureSystemScreenReaderTracking(): void {
  if (systemScreenReaderTrackingStarted) {
    return;
  }

  systemScreenReaderTrackingStarted = true;

  // A guarda vale apenas para TalkBack/VoiceOver nativos. No web o
  // react-native-web resolve `isScreenReaderEnabled()` SEMPRE como `true`
  // (nao ha como detectar leitor de tela no navegador), o que silenciaria
  // toda a fala do app.
  if (Platform.OS === "web") {
    systemScreenReaderEnabled = false;
    return;
  }

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

/** `true` quando a narracao in-app deve assumir o papel de leitor de tela. */
export function isTtsActive(): boolean {
  return state.enabled && !isSystemScreenReaderEnabled();
}

// ---------------------------------------------------------------------------
// Inicializacao + persistencia da preferencia
// ---------------------------------------------------------------------------

let initializationStarted = false;

/**
 * Hidrata a preferencia persistida. Idempotente; chamada pelo `TtsProvider`
 * na raiz do app, ANTES do gate de onboarding decidir qualquer coisa.
 */
export async function initializeTtsService(): Promise<void> {
  if (initializationStarted) {
    return;
  }

  initializationStarted = true;
  ensureSystemScreenReaderTracking();

  const stored = await getStoredTtsPreference();

  if (stored) {
    setState({ ...stored, isReady: true });
    return;
  }

  // Primeiro launch: LIGADO por padrao e onboarding pendente. Persiste ja o
  // default para que um crash antes do onboarding nao mude o comportamento.
  setState({ ...DEFAULT_TTS_PREFERENCE, isReady: true });
  await saveStoredTtsPreference(DEFAULT_TTS_PREFERENCE);
}

/** Liga/desliga a leitura por voz, com efeito imediato e persistido. */
export function setTtsEnabled(enabled: boolean): void {
  if (!enabled) {
    stopSpeaking();
  }

  setState({ enabled });
  void saveStoredTtsPreference({
    enabled,
    onboardingCompleted: state.onboardingCompleted,
  });
}

/** Conclui o onboarding do primeiro launch com a escolha do usuario. */
export function completeTtsOnboarding(enabled: boolean): void {
  if (!enabled) {
    stopSpeaking();
  }

  setState({ enabled, onboardingCompleted: true });
  void saveStoredTtsPreference({ enabled, onboardingCompleted: true });
}

// ---------------------------------------------------------------------------
// Normalizacao de texto
// ---------------------------------------------------------------------------

const MEANINGLESS_VALUES = new Set([
  "",
  "null",
  "undefined",
  "nan",
  "[object object]",
]);

const URL_PATTERN = /https?:\/\/\S+|www\.\S+/gi;

/**
 * Sanitiza o texto antes de falar. Retorna `null` quando nao ha conteudo
 * significativo (nunca falamos vazio, "null", JSON cru, URL, etc.).
 */
export function normalizeSpeechText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  let text = value
    .replace(URL_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();

  if (MEANINGLESS_VALUES.has(text.toLowerCase())) {
    return null;
  }

  // JSON cru nunca deve ser falado.
  if (/^[[{]/.test(text)) {
    return null;
  }

  if (text.length > MAX_SPEECH_LENGTH) {
    const cut = text.slice(0, MAX_SPEECH_LENGTH);
    const lastSpace = cut.lastIndexOf(" ");
    text = `${cut.slice(0, lastSpace > 0 ? lastSpace : MAX_SPEECH_LENGTH)}…`;
  }

  return text;
}

// ---------------------------------------------------------------------------
// Selecao de voz pt-BR
// ---------------------------------------------------------------------------

let voiceLookupStarted = false;
let preferredVoiceIdentifier: string | undefined;

function ensurePreferredVoiceLookup(): void {
  if (voiceLookupStarted) {
    return;
  }

  voiceLookupStarted = true;

  void Speech.getAvailableVoicesAsync()
    .then((voices) => {
      // Identificadores de voz variam por plataforma (Android x iOS): a
      // escolha e feita pela tag de idioma, com fallback para "pt" generico.
      const exact = voices.find((voice) =>
        voice.language?.toLowerCase().startsWith("pt-br")
      );
      const anyPortuguese = voices.find((voice) =>
        voice.language?.toLowerCase().startsWith("pt")
      );

      preferredVoiceIdentifier = (exact ?? anyPortuguese)?.identifier;
    })
    .catch(() => {
      // Sem lista de vozes, o motor decide a partir do `language`.
      preferredVoiceIdentifier = undefined;
    });
}

// ---------------------------------------------------------------------------
// Fala
// ---------------------------------------------------------------------------

let lastSpokenText = "";
let lastSpokenAt = 0;

/** Entrega uma frase ja normalizada ao motor de fala (enfileira, nao interrompe). */
function speakUtterance(message: string): void {
  try {
    Speech.speak(message, {
      language: SPEECH_LANGUAGE,
      voice: preferredVoiceIdentifier,
      rate: SPEECH_RATE,
      pitch: SPEECH_PITCH,
    });
  } catch {
    // Falha do motor de fala nunca propaga para a acao de negocio.
  }
}

/**
 * Guardas comuns a `speak` e `speakSequence`: leitor nativo, preferencia e
 * duplicata imediata. Devolve `false` quando nada deve ser falado.
 */
function shouldSpeak(dedupeKey: string, options: TtsSpeakOptions): boolean {
  if (isSystemScreenReaderEnabled()) {
    return false;
  }

  if (options.force !== true && !state.enabled) {
    return false;
  }

  const now = Date.now();

  // Duplicata imediata (ex.: toque na aba + anuncio da mesma rota).
  if (dedupeKey === lastSpokenText && now - lastSpokenAt < DUPLICATE_SUPPRESSION_MS) {
    return false;
  }

  lastSpokenText = dedupeKey;
  lastSpokenAt = now;

  ensurePreferredVoiceLookup();

  return true;
}

/**
 * Fala `text` respeitando a preferencia do usuario e a politica de fila.
 * Aceita `null`/`undefined` para permitir `speak(builder(data))` direto,
 * mesmo quando o builder decide que nao ha nada significativo a dizer.
 */
export function speak(
  text: string | null | undefined,
  options: TtsSpeakOptions = {}
): void {
  try {
    const message = normalizeSpeechText(text ?? null);

    if (!message || !shouldSpeak(message, options)) {
      return;
    }

    if (options.interrupt === false) {
      speakUtterance(message);
      return;
    }

    // Politica anti-fila: interrompe a fala corrente antes de falar a nova.
    void Speech.stop()
      .catch(() => undefined)
      .then(() => speakUtterance(message));
  } catch {
    // Nenhum erro de acessibilidade pode quebrar o app.
  }
}

/**
 * Fala uma SEQUENCIA de frases como um unico bloco (ex.: entrada na lista de
 * conversas: nome da tela, total pendente e uma frase por conversa).
 *
 * Cada parte vira uma utterance propria: assim a leitura nao esbarra no
 * limite de `MAX_SPEECH_LENGTH` de uma frase unica e o motor faz a pausa
 * natural entre elas. As partes sao enfileiradas no motor (Android
 * `QUEUE_ADD`, iOS/web enfileiram por padrao); qualquer `speak()` posterior
 * interrompe o bloco inteiro, mantendo a politica "toque novo vence".
 *
 * A supressao de duplicata considera a sequencia completa.
 */
export function speakSequence(
  parts: (string | null | undefined)[],
  options: TtsSpeakOptions = {}
): void {
  try {
    const messages = parts
      .map((part) => normalizeSpeechText(part ?? null))
      .filter((part): part is string => Boolean(part));

    if (messages.length === 0 || !shouldSpeak(messages.join("\n"), options)) {
      return;
    }

    const speakAll = () => {
      messages.forEach(speakUtterance);
    };

    if (options.interrupt === false) {
      speakAll();
      return;
    }

    // `Speech.stop()` tambem esvazia a fila: por isso todas as partes entram
    // so DEPOIS do stop resolver, senao a primeira seria cortada pelas demais.
    void Speech.stop()
      .catch(() => undefined)
      .then(speakAll);
  } catch {
    // Nenhum erro de acessibilidade pode quebrar o app.
  }
}

export function stopSpeaking(): void {
  void Speech.stop().catch(() => undefined);
}
