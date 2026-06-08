import { Text, View } from "react-native";
import { AppTabScreen } from "../../src/components/navigation/app-tab-screen";

export default function Home() {
  return (
    <AppTabScreen
      title="Início"
      subtitle="Continue explorando conexões inclusivas e acompanhe seu espaço dentro da Unify."
    >
      <View className="rounded-[28px] bg-[#111214] p-6">
        <Text className="text-[22px] font-black text-white">
          Sua jornada começa aqui
        </Text>
        <Text className="mt-3 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
          Use a navegação inferior para explorar perfis, acompanhar encontros,
          acessar a comunidade e revisar seu perfil sempre que quiser.
        </Text>
      </View>
    </AppTabScreen>
  );
}
