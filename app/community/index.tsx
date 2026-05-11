import { Text, View } from "react-native";

import { AppTabScreen } from "../../src/components/navigation/app-tab-screen";

export default function Community() {
  return (
    <AppTabScreen
      title="Comunidade"
      subtitle="Encontre conteúdos, trocas e pontos de apoio dentro da plataforma."
    >
      <View className="rounded-[28px] bg-[#111214] p-6">
        <Text className="text-[22px] font-black text-white">
          Espaço da comunidade
        </Text>
        <Text className="mt-3 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
          Esta área está pronta para receber publicações, grupos e novidades da
          comunidade da Unify.
        </Text>
      </View>
    </AppTabScreen>
  );
}