import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { usePathname, useRouter } from "expo-router";

type NavTab = {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  route: string;
  iconActive?: ComponentProps<typeof Ionicons>["name"];
  badge?: string;
};

const tabs: NavTab[] = [
  { label: "Início", icon: "home-outline", iconActive: "home", route: "/home" },
  { label: "Explorar", icon: "search-outline", iconActive: "search", route: "/explore" },
  { label: "Encontros", icon: "heart-outline", iconActive: "heart", route: "/matches", badge: "99+" },
  { label: "Comunidades", icon: "people-outline", iconActive: "people" , route: "/community" },
  { label: "Perfil", icon: "person-outline", iconActive: "person", route: "/profile" },
];

export function GlobalBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View className="mb-0 w-full border-t-2 border-[#353534] bg-black px-2">
      <View className="flex-row items-stretch justify-between">
        {tabs.map((tab) => {
          const active = pathname === tab.route || pathname.startsWith(`${tab.route}/`);

          return (
            <Pressable
              key={tab.route}
              className="min-h-[72px] flex-1 items-center justify-center"
              onPress={() => {
                if (!active) {
                  router.replace(tab.route);
                }
              }}
            >
              {active ? (
                <View className="absolute top-0 h-1 w-full max-w-[90px] bg-[#7C4DFF]" />
              ) : null}
              <View className="relative h-8 w-8 items-center justify-center">
                <Ionicons name={active && tab.iconActive ? tab.iconActive : tab.icon} size={26} color={active ? "#7C4DFF" : "#CAC3D8"} />

                {tab.badge ? (
                  <View className="absolute -right-4 -top-1 rounded-full bg-[#814DFF] px-1.5 py-0.5">
                    <Text className="text-[7px] font-black text-white">
                      {tab.badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
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
