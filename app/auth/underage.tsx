import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function UnderageScreen() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={["#180A2E", "#2B0B4F", "#4F3474"]}
      locations={[0, 0.48, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <View className="absolute inset-0 bg-black/15" />

      <SafeAreaView className="flex-1 px-6 py-6">
        <View className="flex-1 items-center justify-center">
          <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-[#F97316]/20">
            <Ionicons name="hand-right-outline" size={36} color="#FDBA74" />
          </View>

          <Text className="mb-4 text-center text-[28px] font-extrabold text-white">
            Desculpe
          </Text>

          <Text className="mb-8 max-w-[320px] text-center text-[15px] font-semibold leading-6 text-[#D6D2E1]">
            O aplicativo é destinado apenas para usuários com 18 anos ou mais.
          </Text>

          <Pressable
            className="w-full max-w-[320px] items-center justify-center rounded-md bg-[#F2F500] px-6 py-4"
            onPress={() => router.replace("/auth/login")}
          >
            <Text className="text-[15px] font-extrabold text-[#191919]">
              Voltar para o Login
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}