import { Redirect } from "expo-router";

import { useTTS } from "../src/accessibility/tts";
import { AuthLoadingScreen } from "../src/components/ui/auth-loading-screen";
import { useAuth } from "../src/context/AuthContext";
import { useOnboardingCompletionGate } from "../src/hooks/useOnboardingCompletionGate";

/**
 * Rota de despacho: e a unica rota sempre disponivel no `Stack` do
 * `app/_layout.tsx`, entao tambem e para onde o router cai quando a rota atual
 * sai do ar (o guard mudou). Ela nao decide permissao — isso e do
 * `Stack.Protected` —, so escolhe o destino.
 */
export default function Index() {
  const { isAuthenticated, isReady, pendingVerificationEmail } = useAuth();
  const { isReady: isTtsReady, onboardingCompleted } = useTTS();
  const { completion, status } = useOnboardingCompletionGate();

  if (!isReady || !isTtsReady) {
    return <AuthLoadingScreen />;
  }

  if (!onboardingCompleted) {
    return <Redirect href="/accessibility-onboarding" />;
  }

  if (pendingVerificationEmail && !isAuthenticated) {
    return (
      <Redirect
        href={{
          pathname: "/auth/email-code",
          params: { email: pendingVerificationEmail },
        }}
      />
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/login" />;
  }

  if (status === "incomplete") {
    return (
      <Redirect
        href={
          completion?.profileCompleted
            ? "/onboarding/match-preferences"
            : "/onboarding/profile"
        }
      />
    );
  }

  if (status === "complete") {
    return <Redirect href="/home" />;
  }

  return <AuthLoadingScreen />;
}
