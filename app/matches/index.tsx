import { useEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import { Text, View } from "react-native";

import { AppTabScreen } from "../../src/components/navigation/app-tab-screen";
import { requestForegroundLocationPermissionState } from "../../src/utils/location";

export default function Matches() {
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    let active = true;

    async function ensureLocationPermission() {
      try {
        await requestForegroundLocationPermissionState();

        if (!active) {
          return;
        }
      } catch {
        // Ignore permission prompt failures here to avoid blocking the screen.
      }
    }

    void ensureLocationPermission();

    return () => {
      active = false;
    };
  }, [isFocused]);

  return (
    <AppTabScreen
      title="Encontros"
      subtitle="Acompanhe suas conexões, conversas e próximos passos por aqui."
    >
      <View className="rounded-[28px] bg-[#111214] p-6">
        <Text className="text-[22px] font-black text-white">
          Seus encontros vão aparecer aqui
        </Text>
        <Text className="mt-3 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
          Assim que você começar a interagir com perfis e matches, este espaço
          reunirá seu histórico e seus próximos movimentos.
        </Text>
      </View>
    </AppTabScreen>
  );
}