import { Redirect } from "expo-router";

/**
 * Rota protegida (ou inexistente) alcancada por deep link cai aqui em vez de
 * na tela padrao "Unmatched Route": `app/index.tsx` reencaminha para o destino
 * certo do estado atual (login, onboarding ou home).
 */
export default function NotFoundRoute() {
  return <Redirect href="/" />;
}
