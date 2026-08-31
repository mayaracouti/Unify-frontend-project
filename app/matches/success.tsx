import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTTS } from "../../src/accessibility/tts";

import { AuthenticatedRemoteImage } from "../../src/components/profile/authenticated-remote-image";
import { useAccessibility } from "../../src/context/AccessibilityContext";
import { useAppShell } from "../../src/context/AppShellContext";
import { useAuth } from "../../src/context/AuthContext";
import { useRequireCompletedOnboarding } from "../../src/hooks/useRequireCompletedOnboarding";
import { chatService } from "../../src/services/chatService";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../src/utils/auth";
import { showGlobalToast } from "../../src/utils/globalToast";

function MatchPhoto({
  accessibilityLabel,
  borderColor,
  initial,
  photoUrl,
  token,
}: {
  accessibilityLabel: string;
  borderColor: string;
  initial: string;
  photoUrl?: string | null;
  token: string | null;
}) {
  return (
    <View
      className="h-[132px] w-[132px] items-center justify-center overflow-hidden rounded-full border-[4px] bg-[#353534]"
      style={{ borderColor }}
    >
      {photoUrl ? (
        <AuthenticatedRemoteImage
          accessibilityLabel={accessibilityLabel}
          authToken={token}
          className="h-full w-full"
          fallback={
            <LinearGradient
              colors={["#544066", "#27212F"]}
              style={{
                alignItems: "center",
                height: "100%",
                justifyContent: "center",
                width: "100%",
              }}
            >
              <Text className="text-[42px] font-black text-[#E8DEFF]">
                {initial}
              </Text>
            </LinearGradient>
          }
          resizeMode="cover"
          uri={photoUrl}
        />
      ) : (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel}
          className="h-full w-full"
        >
          <LinearGradient
            colors={["#544066", "#27212F"]}
            style={{
              alignItems: "center",
              height: "100%",
              justifyContent: "center",
              width: "100%",
            }}
          >
            <Text className="text-[42px] font-black text-[#E8DEFF]">
              {initial}
            </Text>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

export default function MatchSuccess() {
  useRequireCompletedOnboarding();

  const router = useRouter();
  const { session } = useAuth();
  const { currentUserPhotoUrl } = useAppShell();
  const { settings } = useAccessibility();
  const reduceMotion = settings.reduceMotion;
  const { matchId, name, photo } = useLocalSearchParams<{
    matchId?: string;
    name?: string;
    photo?: string;
  }>();
  const matchedName = typeof name === "string" && name.trim() ? name.trim() : "essa pessoa";
  const matchedInitial = matchedName.charAt(0).toUpperCase();
  const matchedPhoto = typeof photo === "string" && photo.trim() ? photo.trim() : null;
  const authToken = session?.accessToken ?? null;
  const { speak } = useTTS();
  const [openingChat, setOpeningChat] = useState(false);

  // Com reduceMotion o gradiente perde o salto forte de matiz e as fotos
  // param de aparecer rotacionadas.
  const backgroundColors = reduceMotion
    ? (["#3B1E63", "#3B1E63", "#241C46"] as const)
    : (["#C600FF", "#6F1BC2", "#0B075A"] as const);

  // Evento deliberado de acessibilidade: o resultado do match (com o nome
  // vindo do fluxo de descoberta) e anunciado assim que a tela abre.
  useEffect(() => {
    speak(
      `Deu match! Você e ${matchedName} demonstraram interesse mútuo.`
    );
  }, [matchedName, speak]);

  useEffect(() => {
    // Delay curto: o leitor de tela precisa terminar de anunciar a mudanca de
    // tela primeiro.
    const timeoutId = setTimeout(() => {
      announceForAccessibility(accessibilityAnnouncements.newMutualMatch(matchedName));
    }, 600);

    return () => clearTimeout(timeoutId);
  }, [matchedName]);

  async function handleOpenChat() {
    if (openingChat) {
      return;
    }

    if (!matchId) {
      // Sem matchId (ex.: navegacao antiga), leva para a lista de conversas.
      router.replace("/chats");
      return;
    }

    setOpeningChat(true);

    try {
      const conversation = await chatService.openConversation(matchId);

      router.replace({
        pathname: "/chats/[conversationId]",
        params: {
          conversationId: conversation.conversationId,
          name: conversation.otherUserName ?? matchedName,
        },
      });
    } catch (nextError) {
      showGlobalToast({
        title: "Não foi possível abrir a conversa",
        message: formatApiErrorMessage(nextError, "Tente novamente em instantes."),
        variant: "error",
      });
    } finally {
      setOpeningChat(false);
    }
  }

  return (
    <LinearGradient
      colors={backgroundColors}
      locations={[0, 0.46, 1]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.65, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1 px-6">
        <View className="flex-1 items-center justify-center pb-10 pt-5">
          <View
            accessible
            accessibilityRole="text"
            accessibilityLabel="Nova conexão adicionada"
            className="h-[66px] w-[226px] flex-row items-center justify-center rounded-full border-[2px] border-[#CDBDFF] bg-[#353534] px-4"
          >
            <Ionicons
              name="checkmark-circle"
              size={26}
              color="#CDBDFF"
              importantForAccessibility="no"
            />
            <Text className="ml-3 text-[18px] font-black leading-[22px] text-[#E5E2E1]">
              Nova conexão{"\n"}adicionada
            </Text>
          </View>

          <View className="mt-14 h-[166px] w-full max-w-[258px] items-center justify-center">
            <View
              className={
                reduceMotion
                  ? "absolute left-0 top-4"
                  : "absolute left-0 top-4 rotate-[-4deg]"
              }
            >
              <MatchPhoto
                accessibilityLabel="Sua foto de perfil"
                borderColor="#CDBDFF"
                initial="U"
                photoUrl={currentUserPhotoUrl}
                token={authToken}
              />
            </View>
            <View
              className={
                reduceMotion
                  ? "absolute right-0 top-4"
                  : "absolute right-0 top-4 rotate-[3deg]"
              }
            >
              <MatchPhoto
                accessibilityLabel={`Foto de ${matchedName}`}
                borderColor="#00DAF3"
                initial={matchedInitial}
                photoUrl={matchedPhoto}
                token={authToken}
              />
            </View>

            <View
              className="absolute top-[68px] h-[46px] w-[46px] items-center justify-center rounded-full bg-[#EAEA00]"
              importantForAccessibility="no-hide-descendants"
            >
              <Ionicons name="heart" size={22} color="#686800" />
            </View>
          </View>

          <Text
            accessibilityRole="header"
            className="mt-10 text-center text-[34px] font-black text-[#E8DEFF]"
          >
            Deu Match!
          </Text>

          <Text className="mt-4 max-w-[310px] text-center text-[20px] font-bold leading-8 text-[#CAC3D8]">
            Você e {matchedName} demonstraram interesse mútuo. Que tal quebrar o gelo?
          </Text>

          <View className="mb-4 mt-10 w-full max-w-[320px] gap-4">
            <Pressable
              accessible
              className="h-[58px] w-full flex-row items-center justify-center rounded-[14px] border-b-[5px] border-[#494900] bg-[#EAEA00]"
              disabled={openingChat}
              onPress={() => {
                speak(`Iniciar conversa com ${matchedName}`);
                void handleOpenChat();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Iniciar conversa com ${matchedName}`}
              accessibilityHint="Abre a tela de conversa"
              accessibilityState={{ disabled: openingChat, busy: openingChat }}
            >
              {openingChat ? (
                <ActivityIndicator color="#686800" size="small" />
              ) : (
                <>
                  <Ionicons
                    name="chatbox"
                    size={24}
                    color="#686800"
                    importantForAccessibility="no"
                  />
                  <Text className="ml-3 text-[20px] font-black text-[#686800]">
                    Iniciar Conversa
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              accessible
              className="h-[58px] w-full items-center justify-center rounded-[14px] border-[2px] border-[#948EA1] bg-transparent"
              onPress={() => {
                speak("Continuar navegando");
                router.replace("/matches");
              }}
              accessibilityRole="button"
              accessibilityLabel="Continuar navegando"
              accessibilityHint="Volta para a descoberta de perfis"
            >
              <Text className="text-[20px] font-black text-[#E5E2E1]">
                Continuar Navegando
              </Text>
            </Pressable>
          </View>

        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
