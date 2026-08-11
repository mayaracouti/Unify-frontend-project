import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";

import { speak } from "../../src/accessibility/screen-reader";
import { GlobalBottomNav } from "../../src/components/navigation/global-bottom-nav";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import { useAccessibility } from "../../src/context/AccessibilityContext";
import { useAccessibleFontSize } from "../../src/hooks/use-accessible-font-size";
import type {
  FontScaleOption,
  UserAccessibilitySettingsUpsertRequest,
} from "../../src/types/accessibility";
import { formatApiErrorMessage } from "../../src/utils/auth";

const FONT_SCALE_OPTIONS: { value: FontScaleOption; label: string }[] = [
  { value: "SMALL", label: "Pequena" },
  { value: "MEDIUM", label: "Média" },
  { value: "LARGE", label: "Grande" },
  { value: "EXTRA_LARGE", label: "Extra" },
];

export default function AccessibilitySettings() {
  const { settings, isLoading, updateSettings } = useAccessibility();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState(0);

  // Preview em tempo real da escala escolhida.
  const previewFontSize = useAccessibleFontSize(16);
  const highContrast = settings.highContrast;

  // `accessibilityLiveRegion` e Android-only: no iOS os anuncios precisam
  // ser disparados manualmente quando a mensagem muda.
  useEffect(() => {
    if (error) {
      AccessibilityInfo.announceForAccessibility(error);
      // `announceForAccessibility` so produz som com o leitor DO SISTEMA ativo.
      // `speak` cobre o leitor in-app (e nao duplica: ele se cala quando o
      // leitor do sistema esta ligado).
      speak(error);
    }
  }, [error]);

  useEffect(() => {
    if (savedAt) {
      AccessibilityInfo.announceForAccessibility(
        "Preferências de acessibilidade salvas."
      );
      speak("Preferências de acessibilidade salvas.");
    }
  }, [savedAt]);

  async function persist(patch: Partial<UserAccessibilitySettingsUpsertRequest>) {
    try {
      setSaving(true);
      setError("");
      await updateSettings(patch);
      setSavedAt(Date.now());
    } catch (nextError) {
      setError(
        formatApiErrorMessage(
          nextError,
          "Erro ao salvar preferências de acessibilidade."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedLabel =
    FONT_SCALE_OPTIONS.find((option) => option.value === settings.fontScale)
      ?.label ?? "Média";

  const cardClassName = `mb-4 rounded-md border p-4 ${
    highContrast
      ? "border-hc-border bg-hc-surface"
      : "border-[#5A5A61] bg-[#19191C]"
  }`;
  const titleClassName = `text-[17px] font-extrabold ${
    highContrast ? "text-hc-text" : "text-white"
  }`;
  const captionClassName = `text-[12px] font-semibold ${
    highContrast ? "text-hc-text" : "text-[#A9A9B2]"
  }`;

  return (
    <View className={highContrast ? "flex-1 bg-hc-bg" : "flex-1 bg-[#151515]"}>
      <SafeAreaView className="flex-1">
        <GlobalTopNav />

        <ScrollView
          className="flex-1"
          contentContainerClassName="mx-auto w-full max-w-[720px] px-6 pb-10 pt-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-4 flex-row items-center">
            <Ionicons
              name="accessibility-outline"
              size={22}
              color={highContrast ? "#FFD400" : "#D6C5FF"}
            />
            <Text
              className={`ml-3 text-[24px] font-black ${
                highContrast ? "text-hc-text" : "text-white"
              }`}
              accessibilityRole="header"
            >
              Configurações de acessibilidade
            </Text>
          </View>

          <Text
            className={`mb-6 text-[14px] font-semibold leading-6 ${
              highContrast ? "text-hc-text" : "text-[#B9BAC4]"
            }`}
          >
            Ajuste o tamanho do texto, o contraste das cores, a otimização para
            leitores de tela e a redução de animações. As alterações são salvas
            automaticamente.
          </Text>

          {/* Estado de salvamento anunciado ao leitor de tela. */}
          <View accessibilityLiveRegion="polite" className="mb-4">
            {saving ? (
              <Text
                className={`text-[13px] font-bold ${
                  highContrast ? "text-hc-accent" : "text-[#F2F500]"
                }`}
              >
                Salvando...
              </Text>
            ) : isLoading ? (
              <Text className={captionClassName}>Carregando preferências...</Text>
            ) : null}
          </View>

          {error ? (
            <Text
              className="mb-4 text-[13px] font-semibold text-danger"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {error}
            </Text>
          ) : null}

          <View className={cardClassName}>
            <View className="mb-4 flex-row items-center justify-between">
              <Text className={titleClassName} accessibilityRole="header">
                Tamanho da fonte
              </Text>
              <Text
                className={`text-[11px] font-extrabold ${
                  highContrast ? "text-hc-accent" : "text-[#F2F500]"
                }`}
              >
                {settings.fontScale === "MEDIUM" ? "Padrão" : selectedLabel}
              </Text>
            </View>

            <View
              className="mb-4 flex-row flex-wrap gap-3"
              accessibilityRole="radiogroup"
              accessibilityLabel="Tamanho da fonte"
              accessibilityHint="Escolha uma das quatro opções de tamanho de texto"
            >
              {FONT_SCALE_OPTIONS.map((option) => {
                const selected = settings.fontScale === option.value;

                return (
                  <Pressable
                    key={option.value}
                    className={`min-h-[48px] items-center justify-center rounded-full border-2 px-5 py-3 ${
                      selected
                        ? highContrast
                          ? "border-hc-accent bg-hc-accent"
                          : "border-[#EAEA00] bg-[#EAEA00]"
                        : highContrast
                          ? "border-hc-border bg-transparent"
                          : "border-[#494455] bg-transparent"
                    }`}
                    disabled={saving}
                    onPress={() => void persist({ fontScale: option.value })}
                    accessibilityRole="radio"
                    accessibilityLabel={`Tamanho de fonte ${option.label}`}
                    accessibilityHint="Ajusta o tamanho do texto em todo o aplicativo"
                    accessibilityState={{ selected, disabled: saving }}
                  >
                    <Text
                      className={`text-[15px] font-bold ${
                        selected
                          ? "text-[#323200]"
                          : highContrast
                            ? "text-hc-text"
                            : "text-[#E5E2E1]"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text
              className={`font-semibold leading-6 ${
                highContrast ? "text-hc-text" : "text-[#D7D7DE]"
              }`}
              style={{ fontSize: previewFontSize }}
              accessibilityLabel={`Texto de exemplo no tamanho ${selectedLabel}`}
            >
              Texto de exemplo: assim o app vai aparecer para você.
            </Text>
          </View>

          <View className={`${cardClassName} flex-row items-center justify-between`}>
            <View className="flex-1 pr-4">
              <Text className={`mb-1 ${titleClassName}`}>Alto contraste</Text>
              <Text className={captionClassName}>
                Texto e bordas mais nítidos
              </Text>
            </View>
            <Switch
              value={settings.highContrast}
              disabled={saving}
              onValueChange={(value) => void persist({ highContrast: value })}
              trackColor={{ false: "#5F6068", true: "#F2F500" }}
              thumbColor="#FFFFFF"
              accessibilityRole="switch"
              accessibilityLabel="Alto contraste"
              accessibilityHint="Aumenta o contraste entre texto, bordas e fundo"
              accessibilityState={{
                checked: settings.highContrast,
                disabled: saving,
              }}
            />
          </View>

          <View className={`${cardClassName} flex-row items-center justify-between`}>
            <View className="flex-1 pr-4">
              <Text className={`mb-1 ${titleClassName}`}>Leitor de tela</Text>
              <Text className={captionClassName}>
                Otimizar telas para leitores de tela
              </Text>
            </View>
            <Switch
              value={settings.screenReaderOptimized}
              disabled={saving}
              onValueChange={(value) => {
                // `force`: o singleton global so recebe o novo valor no proximo
                // efeito do provider, mas o usuario precisa ouvir a confirmacao
                // no instante em que liga (ou desliga) o recurso.
                speak(
                  value ? "Leitor de tela ativado." : "Leitor de tela desativado.",
                  { force: true }
                );
                void persist({ screenReaderOptimized: value });
              }}
              trackColor={{ false: "#5F6068", true: "#F2F500" }}
              thumbColor="#FFFFFF"
              accessibilityRole="switch"
              accessibilityLabel="Otimizar para leitor de tela"
              accessibilityHint="Simplifica a leitura das telas por leitores de tela"
              accessibilityState={{
                checked: settings.screenReaderOptimized,
                disabled: saving,
              }}
            />
          </View>

          <View className={`${cardClassName} flex-row items-center justify-between`}>
            <View className="flex-1 pr-4">
              <Text className={`mb-1 ${titleClassName}`}>Reduzir movimento</Text>
              <Text className={captionClassName}>
                Menos animações e transições
              </Text>
            </View>
            <Switch
              value={settings.reduceMotion}
              disabled={saving}
              onValueChange={(value) => void persist({ reduceMotion: value })}
              trackColor={{ false: "#5F6068", true: "#F2F500" }}
              thumbColor="#FFFFFF"
              accessibilityRole="switch"
              accessibilityLabel="Reduzir movimento"
              accessibilityHint="Diminui animações e transições dentro do aplicativo"
              accessibilityState={{
                checked: settings.reduceMotion,
                disabled: saving,
              }}
            />
          </View>
        </ScrollView>

        <GlobalBottomNav />
      </SafeAreaView>
    </View>
  );
}
