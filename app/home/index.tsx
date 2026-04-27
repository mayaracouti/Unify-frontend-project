import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/context/AuthContext";
import Ionicicons from "@expo/vector-icons/Ionicons";

type Tab = {
  label: string;
  icon: ComponentProps<typeof Ionicicons>["name"];
  active: boolean;
  badge?: string;
};

const tabs: Tab[] = [
  { label: "Início", icon: "home-outline", active: false },
  { label: "Explorar", icon: "search-outline", active: false },
  { label: "Encontros", icon: "heart-outline", active: false, badge: "99+" },
  { label: "Comunidade", icon: "people-outline", active: false },
  { label: "Perfil", icon: "person-outline", active: false },
];

const changeActiveTab = (index: number) => {
  tabs.forEach((tab, i) => {
    tab.active = i === index;
  });
};

export default function Home() {
  const { signOut } = useAuth();

  return (
    <View className="flex-1 bg-[#1F2023]">
      <SafeAreaView className="flex-1 justify-end">
        <Pressable onPress={signOut}>
          <Ionicicons name="log-out-outline" size={24} color="#fff" className="mx-4 mb-4" />
        </Pressable>

        <View className="mx-4 mb-4 rounded-b-2xl rounded-t-sm bg-black px-4 py-4">
          <View className="flex-row items-center justify-between">
            {tabs.map((tab, index) => (
              <Pressable key={tab.label} className="min-w-[52px] items-center" onPress={() => changeActiveTab(index)}>
                <View className="relative h-8 w-8 items-center justify-center">

                  <Ionicicons name={tab.icon} size={24} color={tab.active ? "#fff" : "#6D6E75"} />

                  {tab.badge ? (
                    <View className="absolute -right-4 -top-1 rounded-full bg-[#814DFF] px-1.5 py-0.5">
                      <Text className="text-[7px] font-black text-white">
                        {tab.badge}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
