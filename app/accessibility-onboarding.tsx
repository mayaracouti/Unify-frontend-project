/**
 * Onboarding de acessibilidade do PRIMEIRO launch.
 *
 * Mostrado uma unica vez, antes de qualquer outra tela (ver `NavigationGuard`
 * em `_layout.tsx`). A leitura por voz chega aqui LIGADA por padrao: a propria
 * tela se apresenta em voz alta e o usuario escolhe manter ou desativar. A
 * escolha e persistida localmente e pode ser alterada depois em
 * Configurações de acessibilidade.
 */
import { useEffect, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTTS } from "../src/accessibility/tts";

const INTRO_SPEECH =
  "Bem-vindo à Unify. Este aplicativo pode ler conteúdos e ações em voz alta " +
  "para ajudar na navegação e acessibilidade. A leitura por voz está ativada " +
  "por padrão. Toque em Continuar com leitura por voz para manter, ou em " +
  "Desativar leitura por voz para desligar. Você pode alterar essa " +
  "configuração depois nas configurações de acessibilidade.";

export default function AccessibilityOnboarding() {
  const router = useRouter();
  const { isReady, speak, completeOnboarding } = useTTS();
  const introSpokenRef = useRef(false);

  useEffect(() => {
    if (!isReady || introSpokenRef.current) {
      return;
    }

    introSpokenRef.current = true;
    speak(INTRO_SPEECH);
  }, [isReady, speak]);

  function handleKeepEnabled() {
    completeOnboarding(true);
    speak("Leitura por voz ativada.");
    router.replace("/");
  }

  function handleDisable() {
    completeOnboarding(false);
    // `force`: confirma em voz alta a propria acao de desligar (depois de
    // `completeOnboarding`, que interrompe a fala corrente).
    speak("Leitura por voz desativada.", { force: true });
    router.replace("/");
  }

  return (
    <View className="flex-1 bg-[#151515]">
      <SafeAreaView className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerClassName="mx-auto w-full max-w-[720px] flex-grow justify-center px-6 py-10"
        >
          <View className="mb-6 h-16 w-16 items-center justify-center self-center rounded-full bg-[#241A3C]">
            <Ionicons name="volume-high-outline" size={32} color="#A270FF" />
          </View>

          <Text
            className="mb-2 text-center text-[26px] font-black text-white"
            accessibilityRole="header"
          >
            Leitura por voz
          </Text>

          <Text className="mb-6 text-center text-[15px] font-semibold leading-6 text-[#B9BAC4]">
            Este aplicativo pode ler conteúdos e ações em voz alta para ajudar
            na navegação e acessibilidade.
          </Text>

          <View className="mb-6 rounded-md border border-[#5A5A61] bg-[#19191C] p-4">
            <View className="mb-3 flex-row items-center">
              <Ionicons name="checkmark-circle" size={20} color="#F2F500" />
              <Text className="ml-2 flex-1 text-[14px] font-bold text-white">
                O recurso de leitura por voz está ativado por padrão.
              </Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="settings-outline" size={20} color="#CDBDFF" />
              <Text className="ml-2 flex-1 text-[14px] font-semibold text-[#B9BAC4]">
                Você pode alterar essa configuração depois nas configurações de
                acessibilidade.
              </Text>
            </View>
          </View>

          <Pressable
            className="mb-3 items-center justify-center rounded-md bg-[#F2F500] py-4"
            onPress={handleKeepEnabled}
            accessibilityRole="button"
            accessibilityLabel="Continuar com leitura por voz"
            accessibilityHint="Mantém a leitura em voz alta ativada e abre o aplicativo"
          >
            <Text className="text-[15px] font-extrabold text-[#191919]">
              Continuar com leitura por voz
            </Text>
          </Pressable>

          <Pressable
            className="items-center justify-center rounded-md border-2 border-[#494455] py-4"
            onPress={handleDisable}
            accessibilityRole="button"
            accessibilityLabel="Desativar leitura por voz"
            accessibilityHint="Desliga a leitura em voz alta e abre o aplicativo"
          >
            <Text className="text-[15px] font-extrabold text-white">
              Desativar leitura por voz
            </Text>
          </Pressable>

          <Text className="mt-6 text-center text-[12px] font-semibold text-[#9C9DA6]">
            Recomendado: manter ativado para ouvir nomes, perfis, comunidades e
            ações enquanto navega.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
