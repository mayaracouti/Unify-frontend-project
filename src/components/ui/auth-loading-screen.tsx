import { ActivityIndicator, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { UnifyMark } from "./unify-mark";

export function AuthLoadingScreen() {
  return (
    <LinearGradient
      // Ultima parada escurecida de #906DDE para #845DDA (mesma matiz): mesmo
      // degrade do login (ver app/auth/login).
      colors={["#4D52B5", "#724BCE", "#845DDA"]}
      locations={[0, 0.55, 0.96]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1">
        {/* Um unico foco para o leitor de tela: sem isso o TalkBack/VoiceOver
            ficava em silencio (ou parava num texto solto) durante o boot. */}
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Carregando. Preparando sua sessão e validando o acesso ao app."
          accessibilityLiveRegion="polite"
          accessibilityState={{ busy: true }}
          className="flex-1 items-center justify-center px-8"
        >
          <View className="mb-5 items-center">
            <UnifyMark size="large" />
            <Text className="mt-5 text-[42px] font-black tracking-tight text-white">
              Unify
            </Text>
            <Text className="mt-3 text-center text-[15px] leading-6 text-white/90">
              Preparando sua sessão e validando o acesso ao app.
            </Text>
          </View>

          <ActivityIndicator color="#FFFFFF" size="large" />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}