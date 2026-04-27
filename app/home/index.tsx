import { SafeAreaView, Text, View } from "react-native";

const tabs = [
  { label: "Início", icon: "⌂", active: true },
  { label: "Explorar", icon: "⌖", active: false },
  { label: "Encontros", icon: "♡", active: false, badge: "99+" },
  { label: "Comunidade", icon: "◌", active: false },
  { label: "Perfil", icon: "◍", active: false },
];

export default function Home() {
  return (
    <View className="flex-1 bg-[#1F2023]">
      <SafeAreaView className="flex-1 justify-end">
        <View className="mx-4 mb-4 rounded-b-2xl rounded-t-sm bg-black px-4 py-4">
          <View className="flex-row items-center justify-between">
            {tabs.map((tab) => (
              <View key={tab.label} className="min-w-[52px] items-center">
                <View className="relative h-8 w-8 items-center justify-center">
                  <Text
                    className={`text-[28px] font-black ${
                      tab.active ? "text-white" : "text-[#6D6E75]"
                    }`}
                  >
                    {tab.icon}
                  </Text>

                  {tab.badge ? (
                    <View className="absolute -right-4 -top-1 rounded-full bg-[#814DFF] px-1.5 py-0.5">
                      <Text className="text-[7px] font-black text-white">
                        {tab.badge}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
