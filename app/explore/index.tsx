import { ScrollView } from "react-native";

import { AppTabScreen } from "../../src/components/navigation/app-tab-screen";
import { ScreenEmpty } from "../../src/components/ui/screen-empty";

// A busca de perfis depende de GET /users/profiles, que ainda nao existe no
// backend (ver profileService.getAllProfiles). Ate o endpoint ser criado,
// esta tela permanece com um estado "em breve" honesto em vez de tentar
// carregar dados e falhar silenciosamente. Ver plano-implementacao §3.9.
export default function Explore() {
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
          className="rounded-[28px] bg-surface-alt p-6"
          title="Explorar perfis em breve"
          description="Estamos preparando o diretório de perfis. Em breve você poderá descobrir novas conexões por aqui."
        />
      </ScrollView>
    </AppTabScreen>
  );
}
