import { Pressable, Text, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { AppTabScreen } from "../../src/components/navigation/app-tab-screen";
import Ionicicons from "@expo/vector-icons/Ionicons";

export default function Home() {
  const { signOut } = useAuth();

  return (
    <AppTabScreen
      title="Início"
      subtitle="Continue explorando conexões inclusivas e acompanhe seu espaço dentro da Unify."
      headerRight={
        <Pressable onPress={signOut}>
          <Ionicicons name="log-out-outline" size={24} color="#fff" />
        </Pressable>
      }
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
