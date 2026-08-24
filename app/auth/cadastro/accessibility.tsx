import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import { useAccessibility } from "../../../src/context/AccessibilityContext";
import type { FontScaleOption } from "../../../src/types/accessibility";
import { formatApiErrorMessage } from "../../../src/utils/auth";
import {
  buildOptionToggleSpeech,
  buildSwitchSpeech,
  speak,
  useTTS,
} from "../../../src/accessibility/tts";

const FONT_SCALE_OPTIONS: Array<{
  value: FontScaleOption;
  label: string;
  previewSize: number;
}> = [
  { value: "SMALL", label: "Pequena", previewSize: 12 },
  { value: "MEDIUM", label: "Média", previewSize: 14 },
  { value: "LARGE", label: "Grande", previewSize: 17 },
  { value: "EXTRA_LARGE", label: "Extra", previewSize: 20 },
];

export default function CadastroAccessibility() {
  const router = useRouter();
  const { settings, updateSettings } = useAccessibility();
  const { enabled: ttsEnabled, setEnabled: setTtsEnabled } = useTTS();

  const [fontScale, setFontScale] = useState<FontScaleOption>(settings.fontScale);
  const [highContrast, setHighContrast] = useState(settings.highContrast);
  const [reduceMotion, setReduceMotion] = useState(settings.reduceMotion);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // `accessibilityLiveRegion` e Android-only: no iOS o anuncio do erro
  // precisa ser disparado manualmente quando a mensagem muda.
  useEffect(() => {
    if (error) {
      AccessibilityInfo.announceForAccessibility(error);
      speak(error);
    }
  }, [error]);

  const selectedOption =
    FONT_SCALE_OPTIONS.find((option) => option.value === fontScale) ??
    FONT_SCALE_OPTIONS[1];

  async function handleSavePreferences() {
    try {
      speak("Salvar e continuar");
      setLoading(true);
      setError("");

      await updateSettings({
        fontScale,
        highContrast,
        reduceMotion,
      });

      router.replace("/onboarding/profile");
    } catch (nextError) {
      setError(
        formatApiErrorMessage(
          nextError,
          "Erro ao salvar preferências de acessibilidade."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className={highContrast ? "flex-1 bg-hc-bg" : "flex-1 bg-[#202225]"}>
      <SafeAreaView className="flex-1">
        <View
          className={`border-b px-5 py-5 ${
            highContrast
              ? "border-hc-border bg-hc-bg"
              : "border-white/30 bg-[#070B1D]"
          }`}
        >
          <View className="flex-row items-center">
            <Pressable
              className="mr-5 h-12 w-12 items-center justify-center rounded-full bg-white/8"
              onPress={() => {
                speak("Voltar");
                router.back();
              }}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              accessibilityHint="Retorna para a tela anterior"
            >
              <Text
                className={`text-[40px] font-bold leading-[42px] ${
                  highContrast ? "text-hc-text" : "text-white"
                }`}
              >
                ‹
              </Text>
            </Pressable>
            <Text
              className={`text-[17px] font-bold ${
                highContrast ? "text-hc-text" : "text-white"
              }`}
              accessibilityRole="header"
            >
              Unify
            </Text>
          </View>
        </View>

        <ScrollView
          className={highContrast ? "flex-1 bg-hc-bg" : "flex-1 bg-[#111111]"}
          contentContainerClassName="px-5 pb-8 pt-6"
          keyboardShouldPersistTaps="handled"
        >
          <Text
            className={`mb-3 text-[27px] font-extrabold leading-8 ${
              highContrast ? "text-hc-text" : "text-white"
            }`}
            accessibilityRole="header"
          >
            Personalize sua Experiência
          </Text>

          <Text
            className={`mb-4 text-[14px] font-semibold leading-6 ${
              highContrast ? "text-hc-text" : "text-[#B9BAC4]"
            }`}
          >
            Configure o Unify para melhor atender às suas necessidades. Você pode
            alterar isso mais tarde nas configurações do seu perfil.
          </Text>

          <Text
            className={`mb-6 text-[13px] font-semibold leading-5 ${
              highContrast ? "text-hc-text" : "text-[#9C9DA6]"
            }`}
          >
            Estas preferências ajustam o tamanho do texto, o contraste das cores,
            a leitura por voz e a redução de animações dentro do aplicativo.
          </Text>

          <Text
            className={`mb-3 text-[12px] font-extrabold uppercase tracking-[2px] ${
              highContrast ? "text-hc-accent" : "text-[#DCD5FF]"
            }`}
            accessibilityRole="header"
          >
            Ajustes
          </Text>

          <View
            className={`mb-4 rounded-md border p-4 ${
              highContrast
                ? "border-hc-border bg-hc-surface"
                : "border-[#5A5A61] bg-[#19191C]"
            }`}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <Text
                className={`text-[18px] font-extrabold ${
                  highContrast ? "text-hc-text" : "text-white"
                }`}
                accessibilityRole="header"
              >
                Tamanho da Fonte
              </Text>
              <Text
                className={`text-[11px] font-extrabold ${
                  highContrast ? "text-hc-accent" : "text-[#F2F500]"
                }`}
              >
                {fontScale === "MEDIUM" ? "Padrão" : selectedOption.label}
              </Text>
            </View>

            <View
              className="mb-4 flex-row items-center"
              accessibilityRole="radiogroup"
              accessibilityLabel="Tamanho da fonte"
            >
              <Text
                className={`mr-3 text-[12px] font-bold ${
                  highContrast ? "text-hc-text" : "text-[#999AA3]"
                }`}
                importantForAccessibility="no"
              >
                A
              </Text>
              <View className="relative h-8 flex-1 justify-center">
                <View
                  className={`absolute left-0 right-0 h-2 rounded-full ${
                    highContrast ? "bg-hc-border" : "bg-[#3B3B40]"
                  }`}
                />
                <View className="flex-row items-center justify-between">
                  {FONT_SCALE_OPTIONS.map((option) => {
                    const selected = fontScale === option.value;

                    return (
                      <Pressable
                        key={option.value}
                        className="h-8 w-8 items-center justify-center"
                        onPress={() => {
                          speak(
                            buildOptionToggleSpeech(
                              `Tamanho de fonte ${option.label}`,
                              true
                            )
                          );
                          setFontScale(option.value);
                        }}
                        accessibilityRole="radio"
                        accessibilityLabel={`Tamanho de fonte ${option.label}`}
                        accessibilityHint="Ajusta o tamanho do texto em todo o aplicativo"
                        accessibilityState={{ selected }}
                      >
                        <View
                          className={`rounded-full ${
                            selected
                              ? highContrast
                                ? "h-6 w-6 bg-hc-accent"
                                : "h-6 w-6 bg-[#F2F500]"
                              : "h-3 w-3 bg-[#686A72]"
                          }`}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Text
                className={`ml-3 text-[18px] font-bold ${
                  highContrast ? "text-hc-text" : "text-[#999AA3]"
                }`}
                importantForAccessibility="no"
              >
                A
              </Text>
            </View>

            <View className="mb-4 flex-row justify-between">
              {FONT_SCALE_OPTIONS.map((option) => {
                const selected = fontScale === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                          speak(
                            buildOptionToggleSpeech(
                              `Tamanho de fonte ${option.label}`,
                              true
                            )
                          );
                          setFontScale(option.value);
                        }}
                    accessibilityRole="radio"
                    accessibilityLabel={`Tamanho de fonte ${option.label}`}
                    accessibilityHint="Ajusta o tamanho do texto em todo o aplicativo"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        selected
                          ? highContrast
                            ? "text-hc-accent"
                            : "text-[#F2F500]"
                          : highContrast
                            ? "text-hc-text"
                            : "text-[#909099]"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text
              className={`font-semibold leading-5 ${
                highContrast ? "text-hc-text" : "text-[#D7D7DE]"
              }`}
              style={{ fontSize: selectedOption.previewSize }}
              accessibilityLabel={`Texto de exemplo no tamanho ${selectedOption.label}`}
            >
              Texto de exemplo
            </Text>
          </View>

          <View
            className={`mb-4 flex-row items-center justify-between rounded-md border p-4 ${
              highContrast
                ? "border-hc-border bg-hc-surface"
                : "border-[#5A5A61] bg-[#19191C]"
            }`}
          >
            <View className="flex-1 pr-4">
              <Text
                className={`mb-1 text-[17px] font-extrabold ${
                  highContrast ? "text-hc-text" : "text-white"
                }`}
              >
                Leitura por Voz
              </Text>
              <Text
                className={`text-[12px] font-semibold ${
                  highContrast ? "text-hc-text" : "text-[#A9A9B2]"
                }`}
              >
                Ler em voz alta conteúdos e ações ao tocar
              </Text>
            </View>
            <Switch
              value={ttsEnabled}
              onValueChange={(value) => {
                // Efeito imediato e persistido localmente (nao depende do
                // submit deste formulario nem de estar autenticado).
                setTtsEnabled(value);
                speak(buildSwitchSpeech("Leitura por voz", value), {
                  force: true,
                });
              }}
              trackColor={{ false: "#5F6068", true: "#F2F500" }}
              thumbColor="#FFFFFF"
              accessibilityRole="switch"
              accessibilityLabel="Leitura por voz"
              accessibilityHint="Lê em voz alta conteúdos e ações conforme você navega"
              accessibilityState={{ checked: ttsEnabled }}
            />
          </View>

          <View
            className={`mb-4 flex-row items-center justify-between rounded-md border p-4 ${
              highContrast
                ? "border-hc-border bg-hc-surface"
                : "border-[#5A5A61] bg-[#19191C]"
            }`}
          >
            <View className="flex-1 pr-4">
              <Text
                className={`mb-1 text-[17px] font-extrabold ${
                  highContrast ? "text-hc-text" : "text-white"
                }`}
              >
                Alto Contraste
              </Text>
              <Text
                className={`text-[12px] font-semibold ${
                  highContrast ? "text-hc-text" : "text-[#A9A9B2]"
                }`}
              >
                Texto e bordas mais nítidos
              </Text>
            </View>
            <Switch
              value={highContrast}
              onValueChange={(value) => {
                speak(buildSwitchSpeech("Alto contraste", value));
                setHighContrast(value);
              }}
              trackColor={{ false: "#5F6068", true: "#F2F500" }}
              thumbColor="#FFFFFF"
              accessibilityRole="switch"
              accessibilityLabel="Alto contraste"
              accessibilityHint="Aumenta o contraste entre texto, bordas e fundo"
              accessibilityState={{ checked: highContrast }}
            />
          </View>

          <View
            className={`mb-5 flex-row items-center justify-between rounded-md border p-4 ${
              highContrast
                ? "border-hc-border bg-hc-surface"
                : "border-[#5A5A61] bg-[#19191C]"
            }`}
          >
            <View className="flex-1 pr-4">
              <Text
                className={`mb-1 text-[17px] font-extrabold ${
                  highContrast ? "text-hc-text" : "text-white"
                }`}
              >
                Reduzir movimento
              </Text>
              <Text
                className={`text-[12px] font-semibold ${
                  highContrast ? "text-hc-text" : "text-[#A9A9B2]"
                }`}
              >
                Menos animações e transições
              </Text>
            </View>
            <Switch
              value={reduceMotion}
              onValueChange={(value) => {
                speak(buildSwitchSpeech("Reduzir movimento", value));
                setReduceMotion(value);
              }}
              trackColor={{ false: "#5F6068", true: "#F2F500" }}
              thumbColor="#FFFFFF"
              accessibilityRole="switch"
              accessibilityLabel="Reduzir movimento"
              accessibilityHint="Diminui animações e transições dentro do aplicativo"
              accessibilityState={{ checked: reduceMotion }}
            />
          </View>

          <LinearGradient
            colors={highContrast ? ["#000000", "#101010"] : ["#8752FF", "#5328AA"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 6, marginBottom: 20, padding: 20 }}
          >
            <Text
              className={`mb-2 text-[13px] font-bold leading-5 ${
                highContrast ? "text-hc-text" : "text-white"
              }`}
            >
              Feito para Autonomia
            </Text>
            <Text
              className={`text-[13px] font-semibold leading-5 ${
                highContrast ? "text-hc-text" : "text-white/90"
              }`}
            >
              O Unify se adapta a você, garantindo que cada conexão seja
              significativa e acessível.
            </Text>
          </LinearGradient>

          {error ? (
            <Text
              className="mb-4 text-center text-[13px] font-semibold text-danger"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {error}
            </Text>
          ) : null}

          <Pressable
            className={`items-center justify-center rounded-md py-4 ${
              loading ? "bg-[#BFC200]" : highContrast ? "bg-hc-accent" : "bg-[#F2F500]"
            }`}
            disabled={loading}
            onPress={handleSavePreferences}
            accessibilityRole="button"
            accessibilityLabel="Salvar e continuar"
            accessibilityHint="Salva suas preferências de acessibilidade e segue para o cadastro do perfil"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            <Text className="text-[15px] font-extrabold text-[#191919]">
              {loading ? "Salvando..." : "Salvar e Continuar  ›"}
            </Text>
          </Pressable>

          <Text
            className={`mt-3 text-center text-[9px] font-bold uppercase tracking-[1px] ${
              highContrast ? "text-hc-text" : "text-[#B9BAC4]"
            }`}
          >
            Passo 1 de 1: Configuração do Perfil
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
