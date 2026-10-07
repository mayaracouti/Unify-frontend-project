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

describe("tts-service speakSequence()", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("interrompe a fala corrente uma vez e enfileira cada parte em ordem", async () => {
    const RN = require("react-native");
    (RN.AccessibilityInfo.isScreenReaderEnabled as jest.Mock).mockResolvedValue(false);

    const Speech = require("expo-speech");
    const { initializeTtsService, speakSequence } = require("../tts-service");

    await initializeTtsService();
    await flushMicrotasks();

    speakSequence(["Conversas", null, "  ", "2 conversas com mensagens não lidas", "Marina: oi"]);
    await flushMicrotasks();

    expect(Speech.stop).toHaveBeenCalledTimes(1);
    expect((Speech.speak as jest.Mock).mock.calls.map((call) => call[0])).toEqual([
      "Conversas",
      "2 conversas com mensagens não lidas",
      "Marina: oi",
    ]);
  });

  it("fica mudo com o leitor de tela nativo ativo", async () => {
    const RN = require("react-native");
    (RN.AccessibilityInfo.isScreenReaderEnabled as jest.Mock).mockResolvedValue(true);

    const Speech = require("expo-speech");
    const { initializeTtsService, speakSequence } = require("../tts-service");

    await initializeTtsService();
    await flushMicrotasks();

    speakSequence(["Conversas", "Marina: oi"]);
    await flushMicrotasks();

    expect(Speech.speak).not.toHaveBeenCalled();
  });

  it("suprime a mesma sequencia repetida dentro da janela", async () => {
    const RN = require("react-native");
    (RN.AccessibilityInfo.isScreenReaderEnabled as jest.Mock).mockResolvedValue(false);

    const Speech = require("expo-speech");
    const { initializeTtsService, speakSequence } = require("../tts-service");

    await initializeTtsService();
    await flushMicrotasks();

    speakSequence(["Conversas", "Marina: oi"]);
    await flushMicrotasks();
    speakSequence(["Conversas", "Marina: oi"]);
    await flushMicrotasks();

    expect(Speech.speak).toHaveBeenCalledTimes(2);
  });
});

describe("controles da leitura por voz", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("persiste a velocidade e a mantém ao desligar ou concluir o onboarding", async () => {
    const RN = require("react-native");
    RN.AccessibilityInfo.isScreenReaderEnabled.mockResolvedValue(false);
    const Speech = require("expo-speech");
    const storage = require("../tts-storage");
    const service = require("../tts-service");
    await service.initializeTtsService();
    service.setTtsRate(0.75);
    service.speak("Leitura lenta");
    await flushMicrotasks();
    expect(Speech.speak).toHaveBeenCalledWith("Leitura lenta", expect.objectContaining({ rate: 0.75 }));
    service.setTtsEnabled(false);
    expect(storage.saveStoredTtsPreference).toHaveBeenLastCalledWith(expect.objectContaining({ rate: 0.75, enabled: false }));
    service.completeTtsOnboarding(true);
    expect(storage.saveStoredTtsPreference).toHaveBeenLastCalledWith(expect.objectContaining({ rate: 0.75, enabled: true }));
    service.setTtsRate(10);
    expect(service.getTtsState().rate).toBe(0.75);
  });

  it("parar cancela inclusive uma fala que aguarda o motor interromper a anterior", async () => {
    const RN = require("react-native");
    RN.AccessibilityInfo.isScreenReaderEnabled.mockResolvedValue(false);
    const Speech = require("expo-speech");
    const service = require("../tts-service");
    await service.initializeTtsService();
    let release!: () => void;
    Speech.stop.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
    service.speakSequence(["Uma publicação", "Descrição da imagem"]);
    service.stopSpeaking();
    release();
    await flushMicrotasks();
    expect(Speech.speak).not.toHaveBeenCalled();
    service.speak("Uma publicação");
    await flushMicrotasks();
    expect(Speech.speak).toHaveBeenCalledTimes(1);
  });
});
