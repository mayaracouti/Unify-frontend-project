/**
 * Testes do servico central de TTS (`speak()`), focados nas duas guardas
 * criticas de acessibilidade:
 *  - mudo quando o leitor de tela NATIVO (TalkBack/VoiceOver) esta ativo;
 *  - supressao de fala duplicada dentro da janela curta.
 */

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([])),
}));

jest.mock("../tts-storage", () => ({
  DEFAULT_TTS_PREFERENCE: { enabled: true, onboardingCompleted: true },
  getStoredTtsPreference: jest.fn(() =>
    Promise.resolve({ enabled: true, onboardingCompleted: true })
  ),
  saveStoredTtsPreference: jest.fn(() => Promise.resolve()),
}));

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("tts-service speak()", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("fica mudo quando o leitor de tela nativo esta ativo", async () => {
    const RN = require("react-native");
    (RN.AccessibilityInfo.isScreenReaderEnabled as jest.Mock).mockResolvedValue(
      true
    );

    const Speech = require("expo-speech");
    const { initializeTtsService, speak } = require("../tts-service");

    await initializeTtsService();
    await flushMicrotasks();

    speak("Ola, isso nao deveria ser falado");
    await flushMicrotasks();

    expect(Speech.speak).not.toHaveBeenCalled();
  });

  it("suprime duplicata do mesmo texto dentro da janela de supressao", async () => {
    const RN = require("react-native");
    (RN.AccessibilityInfo.isScreenReaderEnabled as jest.Mock).mockResolvedValue(
      false
    );

    const Speech = require("expo-speech");
    const { initializeTtsService, speak } = require("../tts-service");

    await initializeTtsService();
    await flushMicrotasks();

    speak("Mensagem repetida");
    await flushMicrotasks();

    speak("Mensagem repetida");
    await flushMicrotasks();

    expect(Speech.speak).toHaveBeenCalledTimes(1);
  });

  it("fala normalmente quando o leitor nativo esta desligado e o texto e novo", async () => {
    const RN = require("react-native");
    (RN.AccessibilityInfo.isScreenReaderEnabled as jest.Mock).mockResolvedValue(
      false
    );

    const Speech = require("expo-speech");
    const { initializeTtsService, speak } = require("../tts-service");

    await initializeTtsService();
    await flushMicrotasks();

    speak("Primeira mensagem");
    await flushMicrotasks();
    speak("Segunda mensagem, diferente da primeira");
    await flushMicrotasks();

    expect(Speech.speak).toHaveBeenCalledTimes(2);
  });
});
