/**
 * Leitura sob demanda ("Ouvir mensagem/publicacao"): pedido explicito da
 * pessoa — vale com a leitura por voz desligada, le o texto inteiro em
 * partes e para o audio que estiver tocando.
 */
jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([])),
}));

jest.mock("../tts-storage", () => ({
  DEFAULT_TTS_PREFERENCE: { enabled: false, onboardingCompleted: true },
  getStoredTtsPreference: jest.fn(() =>
    Promise.resolve({ enabled: false, onboardingCompleted: true })
  ),
  saveStoredTtsPreference: jest.fn(() => Promise.resolve()),
}));

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("tts-service speakOnDemand()", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("quebra texto longo em partes sem cortar palavras", () => {
    const { splitSpeechChunks } = require("../tts-service");
    const sentence = "Uma frase de exemplo para a leitura. ";
    const chunks: string[] = splitSpeechChunks(sentence.repeat(30), 120);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 120)).toBe(true);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(sentence.repeat(30).trim());
  });

  it("fala com a leitura por voz desligada, para outros áudios e libera a chave no fim", async () => {
    const RN = require("react-native");
    (RN.AccessibilityInfo.isScreenReaderEnabled as jest.Mock).mockResolvedValue(false);

    const Speech = require("expo-speech");
    const audioFocus = require("../../audio-focus");
    const stopPlayer = jest.fn();
    audioFocus.registerAudioPlayer(stopPlayer);

    const { initializeTtsService, speak, speakOnDemand, getOnDemandSpeechKey } = require("../tts-service");
    await initializeTtsService();
    await flushMicrotasks();

    speak("isto nao sai: leitura por voz desligada");
    await flushMicrotasks();
    expect(Speech.speak).not.toHaveBeenCalled();

    expect(speakOnDemand("post:1", "Publicação de Ana. Bom dia!")).toBe(true);
    expect(getOnDemandSpeechKey()).toBe("post:1");
    expect(stopPlayer).toHaveBeenCalled();
    await flushMicrotasks();

    expect(Speech.speak).toHaveBeenCalledTimes(1);
    const [text, options] = (Speech.speak as jest.Mock).mock.calls[0];
    expect(text).toBe("Publicação de Ana. Bom dia!");

    options.onDone();
    expect(getOnDemandSpeechKey()).toBeNull();
  });

  it("stopOnDemandSpeech interrompe e callbacks antigos não religam a chave", async () => {
    const Speech = require("expo-speech");
    const { speakOnDemand, stopOnDemandSpeech, getOnDemandSpeechKey } = require("../tts-service");

    speakOnDemand("chat-message:1", "Oi");
    await flushMicrotasks();
    const [, firstOptions] = (Speech.speak as jest.Mock).mock.calls[0];

    speakOnDemand("chat-message:2", "Tudo bem?");
    // `onStopped` da leitura anterior chega depois: nao pode apagar a atual.
    firstOptions.onStopped();
    expect(getOnDemandSpeechKey()).toBe("chat-message:2");

    stopOnDemandSpeech();
    expect(getOnDemandSpeechKey()).toBeNull();
    expect(Speech.stop).toHaveBeenCalled();
  });

  it("speak chama onDone na hora quando nada é falado (canal livre)", async () => {
    const { initializeTtsService, speak } = require("../tts-service");
    await initializeTtsService();
    const onDone = jest.fn();

    speak("leitura por voz desligada", { onDone });

    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
