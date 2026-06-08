import { useMemo, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { usePathname, useRouter } from "expo-router";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

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

type GlobalTopNavProps = {
  settingsRoute?: string | null;
};

export function GlobalTopNav({ settingsRoute = null }: GlobalTopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { currentUserName, currentUserPhotoUrl, unseenProfilesCount } = useAppShell();
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = useMemo(() => getInitials(currentUserName || "Perfil"), [currentUserName]);
  const shouldShowMutualMatchesShortcut = pathname === "/matches";

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    router.replace("/auth/login");
  }

  return (
    <>
      <View className="h-16 flex-row items-center justify-between border-b border-[#262037] bg-[#090B18] px-6">
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full"
          onPress={() => setMenuOpen(true)}
          accessibilityLabel="Abrir menu"
        >
          <Ionicons name="menu-outline" size={24} color="#A270FF" />
        </Pressable>

        <Text className="text-[26px] font-black tracking-[2px] text-[#7C4DFF]">UNIFY</Text>

        {shouldShowMutualMatchesShortcut ? (
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full"
            onPress={() => router.push("/matches/mutual")}
            accessibilityLabel="Abrir lista de matches"
          >
            <Ionicons name="heart-circle-outline" size={30} color="#A270FF" />
          </Pressable>
        ) : settingsRoute ? (
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full"
            onPress={() => router.push(settingsRoute)}
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
                onPress={() => setMenuOpen(false)}
                accessibilityLabel="Fechar menu"
              >
                <Ionicons name="close" size={22} color="#E5E2E1" />
              </Pressable>
            </View>

            <View className="mt-8 flex-row items-center rounded-[28px] border border-[#2B2D39] bg-[#151722] p-4">
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
            </View>

            <ScrollView className="mt-8 flex-1" showsVerticalScrollIndicator={false}>
              {navigationTabs.map((tab) => {
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
                      setMenuOpen(false);

                      if (!active) {
                        router.replace(tab.route);
                      }
                    }}
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