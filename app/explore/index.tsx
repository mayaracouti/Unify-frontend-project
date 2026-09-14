import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

import { AppTabScreen } from "../../src/components/navigation/app-tab-screen";
import { ScreenEmpty } from "../../src/components/ui/screen-empty";
import { useScreenHeadingFocus } from "../../src/hooks/use-screen-heading-focus";

// A busca de perfis depende de GET /users/profiles, que ainda nao existe no
// backend (ver profileService.getAllProfiles). Ate o endpoint ser criado,
// esta tela permanece com um estado "em breve" honesto em vez de tentar
// carregar dados e falhar silenciosamente. Ver plano-implementacao §3.9.
export default function Explore() {
  const router = useRouter();
  // `AppTabScreen` renderiza o titulo da tela como um `Text` comum, sem role de
  // cabecalho e sem ref — e o componente e compartilhado, entao nao pode ser
  // alterado aqui. O cabecalho focavel desta tela e o icone do estado vazio,
  // que ja fica acima do titulo e nao participa do anuncio do bloco de texto.
  const headingRef = useScreenHeadingFocus<View>();

  return (
    <AppTabScreen
      title="Explorar"
      subtitle="Veja perfis disponíveis e descubra conexões com mais afinidade."
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-4"
        showsVerticalScrollIndicator={false}
      >
        <ScreenEmpty
          className="items-center rounded-[28px] bg-surface-alt p-6"
          icon={
            <View
              ref={headingRef}
              accessible
              accessibilityRole="header"
              accessibilityLabel="Explorar perfis em breve"
              className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-[#2B2338]"
            >
              <Ionicons
                name="compass-outline"
                size={30}
                color="#CDBDFF"
                importantForAccessibility="no"
              />
            </View>
          }
          title="Explorar perfis em breve"
          description="Estamos preparando o diretório de perfis. Em breve você poderá descobrir novas conexões por aqui."
          action={{
            label: "Ir para o Descobrir",
            onPress: () => router.push("/matches"),
            accessibilityHint: "Abre a descoberta de perfis",
          }}
        />
      </ScrollView>
    </AppTabScreen>
  );
}
