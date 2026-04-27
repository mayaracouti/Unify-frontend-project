import { ActivityIndicator, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { UnifyMark } from "./unify-mark";

export function AuthLoadingScreen() {
  return (
    <LinearGradient
      colors={["#4D52B5", "#724BCE", "#906DDE"]}
      locations={[0, 0.55, 0.96]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1">
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-5 items-center">
            <UnifyMark size="large" />
            <Text className="mt-5 text-[42px] font-black tracking-tight text-white">
              Unify
            </Text>
            <Text className="mt-3 text-center text-[15px] leading-6 text-white/72">
              Preparando sua sessão e validando o acesso ao app.
            </Text>
          </View>

          <ActivityIndicator color="#FFFFFF" size="large" />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}