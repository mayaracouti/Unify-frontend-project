import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { usePathname, useRouter } from "expo-router";

import { joinSpeechParts, useTTS } from "../../accessibility/tts";
import { useAppShell } from "../../context/AppShellContext";
import { navigationTabs } from "./navigation-tabs";

export function GlobalBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { speak } = useTTS();
  const { unreadChatCount, unseenProfilesCount } = useAppShell();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Navegação principal"
      className="mb-0 w-full border-t-2 border-[#353534] bg-black px-2"
    >
      <View className="flex-row items-stretch justify-between">
        {navigationTabs.map((tab) => {
          const active = pathname === tab.route || pathname.startsWith(`${tab.route}/`);
          const badgeValue =
            tab.badgeKey === "matches" && unseenProfilesCount > 0
              ? String(unseenProfilesCount)
              : tab.badgeKey === "chats" && unreadChatCount > 0
                ? unreadChatCount > 99
                  ? "99+"
                  : String(unreadChatCount)
                : null;
          // O TTS in-app precisa do substantivo certo por aba: "3 novos perfis"
          // nao serve para conversas.
          const badgeSpeech = badgeValue
            ? tab.badgeKey === "chats"
              ? `${badgeValue} ${
                  unreadChatCount === 1 ? "mensagem não lida" : "mensagens não lidas"
                }`
              : `${badgeValue} novos perfis`
            : null;

          return (
            <Pressable
              key={tab.route}
              accessible
              className="min-h-[72px] flex-1 items-center justify-center"
              onPress={() => {
                // O badge e dado dinamico: entra na fala junto com o nome da
                // aba ("Encontros. 3 novos perfis").
                speak(joinSpeechParts([tab.label, badgeSpeech]));

                if (!active) {
                  router.replace(tab.route);
                }
              }}
              accessibilityRole="tab"
              // O badge e informacao, nao decoracao: entra no rotulo da aba
              // porque o numero visual some da arvore de acessibilidade.
              accessibilityLabel={
                badgeValue
                  ? `${tab.label}, ${badgeValue} ${
                      Number(badgeValue) === 1 ? "novidade" : "novidades"
                    }`
                  : tab.label
              }
              accessibilityState={{ selected: active }}
            >
              {active ? (
                <View
                  className="absolute top-0 h-1 w-full max-w-[90px] bg-[#7C4DFF]"
                  importantForAccessibility="no"
                />
              ) : null}
              <View
                className="relative h-8 w-8 items-center justify-center"
                importantForAccessibility="no-hide-descendants"
              >
                <Ionicons name={active && tab.iconActive ? tab.iconActive : tab.icon} size={26} color={active ? "#7C4DFF" : "#CAC3D8"} />

                {badgeValue ? (
                  <View className="absolute -right-4 -top-1 rounded-full bg-[#814DFF] px-1.5 py-0.5">
                    <Text className="text-[7px] font-black text-white">
                      {badgeValue}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                importantForAccessibility="no"
                className={`mt-1 text-[11px] font-black ${
                  active ? "text-[#7C4DFF]" : "text-[#CAC3D8]"
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
