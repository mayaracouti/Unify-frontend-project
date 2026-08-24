import { useMemo, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { usePathname, useRouter } from "expo-router";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { joinSpeechParts, useTTS } from "../../accessibility/tts";
import { useAppShell } from "../../context/AppShellContext";
import { useAuth } from "../../context/AuthContext";
import { AuthenticatedRemoteImage } from "../profile/authenticated-remote-image";
import { navigationTabs } from "./navigation-tabs";

function getInitials(name: string) {
  return name
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const PROFILE_ROUTE = "/profile";

type GlobalTopNavProps = {
  settingsRoute?: string | null;
  backRoute?: string | null;
  backLabel?: string;
  showMenu?: boolean;
};

export function GlobalTopNav({
  settingsRoute = null,
  backRoute = null,
  backLabel = "Voltar",
  showMenu = true,
}: GlobalTopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { speak } = useTTS();
  const { currentUserName, currentUserPhotoUrl, unseenProfilesCount } = useAppShell();
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = useMemo(() => getInitials(currentUserName || "Perfil"), [currentUserName]);
  const shouldShowMutualMatchesShortcut = pathname === "/matches";
  // O cartao do usuario ja leva ao perfil: manter o item "Perfil" duplicaria a rota no menu.
  const menuTabs = useMemo(
    () => navigationTabs.filter((tab) => tab.route !== PROFILE_ROUTE),
    []
  );

  function handleOpenProfile() {
    speak(joinSpeechParts(["Seu perfil", currentUserName || null]));
    setMenuOpen(false);

    if (pathname !== PROFILE_ROUTE && !pathname.startsWith(`${PROFILE_ROUTE}/`)) {
      router.replace(PROFILE_ROUTE);
    }
  }

  async function handleSignOut() {
    speak("Sair da conta");
    setMenuOpen(false);
    await signOut();
    router.replace("/auth/login");
  }

  return (
    <>
      <View className="h-16 flex-row items-center justify-between border-b border-[#262037] bg-[#090B18] px-6">
        <View className="flex-row items-center">
          {backRoute ? (
            <Pressable
              className="mr-1 h-10 w-10 items-center justify-center rounded-full"
              onPress={() => {
                speak(backLabel);
                // `replace` (e nao `back`): a tela pode ser aberta por deep link,
                // quando nao existe historico para voltar.
                router.replace(backRoute);
              }}
              accessibilityRole="button"
              accessibilityLabel={backLabel}
            >
              <Ionicons name="arrow-back" size={24} color="#A270FF" />
            </Pressable>
          ) : null}

          {showMenu ? (
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full"
              onPress={() => {
                // O nome do usuario e dado de runtime: falar junto situa o menu.
                speak(
                  joinSpeechParts(["Menu aberto", currentUserName || null])
                );
                setMenuOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Abrir menu"
            >
              <Ionicons name="menu-outline" size={24} color="#A270FF" />
            </Pressable>
          ) : backRoute ? null : (
            // Sem menu e sem voltar o lado esquerdo ficaria vazio e o titulo
            // "UNIFY" sairia do centro: o espacador ocupa o lugar do botao.
            <View className="h-10 w-10" />
          )}
        </View>

        <Text className="text-[26px] font-black tracking-[2px] text-[#7C4DFF]">UNIFY</Text>

        {shouldShowMutualMatchesShortcut ? (
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full"
            onPress={() => {
              speak("Abrir lista de matches");
              router.push("/matches/mutual");
            }}
            accessibilityRole="button"
            accessibilityLabel="Abrir lista de matches"
          >
            <Ionicons name="heart-circle-outline" size={30} color="#A270FF" />
          </Pressable>
        ) : settingsRoute ? (
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full"
            onPress={() => {
              speak("Abrir configurações");
              router.push(settingsRoute);
            }}
            accessibilityRole="button"
            accessibilityLabel="Abrir configurações"
          >
            <Ionicons name="settings-outline" size={24} color="#A270FF" />
          </Pressable>
        ) : (
          <View className="h-10 w-10" />
        )}
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={menuOpen}
        onRequestClose={() => setMenuOpen(false)}
      >
        <View className="flex-1 flex-row bg-black/55">
          <View className="w-[84%] max-w-[340px] bg-[#0E0F16] px-6 pb-6 pt-8">
            <View className="flex-row items-center justify-between">
              <Text className="text-[20px] font-black tracking-[1.5px] text-[#7C4DFF]">UNIFY</Text>
              <Pressable
                className="h-10 w-10 items-center justify-center rounded-full bg-[#181A24]"
                onPress={() => {
                  speak("Menu fechado");
                  setMenuOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Fechar menu"
              >
                <Ionicons name="close" size={22} color="#E5E2E1" />
              </Pressable>
            </View>

            <Pressable
              className="mt-8 flex-row items-center rounded-[28px] border border-[#2B2D39] bg-[#151722] p-4"
              onPress={handleOpenProfile}
              accessibilityRole="button"
              accessibilityLabel="Abrir seu perfil"
              accessibilityHint="Abre a tela do seu perfil"
            >
              <View className="h-16 w-16 overflow-hidden rounded-full border-2 border-[#7C4DFF] bg-[#2D2A33]">
                {currentUserPhotoUrl ? (
                  <AuthenticatedRemoteImage
                    uri={currentUserPhotoUrl}
                    authToken={session?.accessToken ?? null}
                    className="h-full w-full"
                    resizeMode="cover"
                    fallback={
                      <View className="flex-1 items-center justify-center bg-[#2D2A33]">
                        <Text className="text-[20px] font-black text-white">{initials || "?"}</Text>
                      </View>
                    }
                  />
                ) : (
                  <View className="flex-1 items-center justify-center bg-[#2D2A33]">
                    <Text className="text-[20px] font-black text-white">{initials || "?"}</Text>
                  </View>
                )}
              </View>

              <View className="ml-4 flex-1">
                <Text className="text-[12px] font-black uppercase tracking-[1.2px] text-[#9F96B8]">
                  Seu perfil
                </Text>
                <Text className="mt-1 text-[18px] font-black text-white" numberOfLines={1}>
                  {currentUserName}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color="#6F7181" />
            </Pressable>

            <ScrollView className="mt-8 flex-1" showsVerticalScrollIndicator={false}>
              {menuTabs.map((tab) => {
                const active = pathname === tab.route || pathname.startsWith(`${tab.route}/`);
                const badgeValue =
                  tab.badgeKey === "matches" && unseenProfilesCount > 0
                    ? String(unseenProfilesCount)
                    : null;

                return (
                  <Pressable
                    key={tab.route}
                    className="mb-3 flex-row items-center rounded-[20px] border border-[#1E2230] bg-[#131521] px-4 py-4"
                    onPress={() => {
                      speak(
                        joinSpeechParts([
                          tab.label,
                          badgeValue ? `${badgeValue} novos perfis` : null,
                        ])
                      );
                      setMenuOpen(false);

                      if (!active) {
                        router.replace(tab.route);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={tab.label}
                    accessibilityState={{ selected: active }}
                  >
                    <View className="relative h-11 w-11 items-center justify-center rounded-full bg-[#1B1E2A]">
                      <Ionicons
                        name={active && tab.iconActive ? tab.iconActive : tab.icon}
                        size={22}
                        color={active ? "#7C4DFF" : "#CAC3D8"}
                      />

                      {badgeValue ? (
                        <View className="absolute -right-2 -top-1 rounded-full bg-[#814DFF] px-1.5 py-0.5">
                          <Text className="text-[9px] font-black text-white">{badgeValue}</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text
                      className={`ml-4 flex-1 text-[17px] font-black ${
                        active ? "text-[#7C4DFF]" : "text-white"
                      }`}
                    >
                      {tab.label}
                    </Text>

                    <Ionicons name="chevron-forward" size={20} color="#6F7181" />
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              className="mt-4 flex-row items-center justify-center rounded-[20px] border border-[#3A2A32] bg-[#1D1519] px-4 py-4"
              onPress={() => {
                void handleSignOut();
              }}
              accessibilityRole="button"
              accessibilityLabel="Sair da conta"
            >
              <Ionicons name="log-out-outline" size={22} color="#FF8FAB" />
              <Text className="ml-3 text-[16px] font-black text-[#FFCCD8]">Sair</Text>
            </Pressable>
          </View>

          <Pressable className="flex-1" onPress={() => setMenuOpen(false)} />
        </View>
      </Modal>
    </>
  );
}