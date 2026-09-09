// @ts-ignore
import "../global.css";
import { Stack, useRootNavigationState } from "expo-router";
import { Platform, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { applyGlobalTextAdjustmentsPatch } from "../src/accessibility/global-text-adjustments";
import { TtsProvider, useTTS } from "../src/accessibility/tts";
import { AuthLoadingScreen } from "../src/components/ui/auth-loading-screen";
import { GlobalToastViewport } from "../src/components/ui/global-toast-viewport";
import { ScreenError } from "../src/components/ui/screen-error";
import {
  AccessibilityProvider,
  useAccessibility,
} from "../src/context/AccessibilityContext";
import { AppShellProvider } from "../src/context/AppShellContext";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { useHeadingFocusOnMount } from "../src/hooks/use-screen-heading-focus";
import { useOnboardingCompletionGate } from "../src/hooks/useOnboardingCompletionGate";

// Aplica o patch global de `Text`/`TextInput` antes de qualquer tela renderizar,
// para que a escala de fonte e o alto contraste valham no app inteiro.
applyGlobalTextAdjustmentsPatch();

/**
 * Tela mostrada quando o app NAO consegue saber se o onboarding foi concluido
 * (sem cache persistido e a rede falhou). Nao redireciona nem libera: mandar
 * quem ja completou refazer o cadastro e pior do que barrar, e liberar as telas
 * protegidas era o antigo fail-open de `useRequireCompletedOnboarding`.
 */
function OnboardingGateError({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  const headingRef = useHeadingFocusOnMount<Text>();

  return (
    <SafeAreaView className="flex-1 justify-center px-6">
      <ScreenError
        titleRef={headingRef}
        title="Não foi possível verificar seu cadastro"
        message="Verifique sua conexão e tente novamente."
        onRetry={onRetry}
        retrying={retrying}
      />
    </SafeAreaView>
  );
}

function RootNavigator() {
  const navigationState = useRootNavigationState();
  const { isAuthenticated, isReady } = useAuth();
  const { isReady: isTtsReady, onboardingCompleted } = useTTS();
  const { settings } = useAccessibility();
  const onboardingGate = useOnboardingCompletionGate();

  // Em alto contraste o fundo raiz vira preto puro: combinado com o mapeamento
  // de cor de texto do patch global, e o que garante o contraste maximo sem
  // precisar editar as telas uma a uma.
  const backgroundColor = settings.highContrast ? "#000000" : "#201233";
  const reduceMotion = settings.reduceMotion;

  // O onboarding de acessibilidade (TTS ligado por padrao) acontece ANTES de
  // qualquer outra coisa, autenticado ou nao — inclusive antes do gate.
  const shouldGateOnboarding = isAuthenticated && onboardingCompleted;
  const isGateUnresolved = shouldGateOnboarding && onboardingGate.status === "unknown";

  // Sem flash: a espera do estado assincrono acontece dentro da mesma
  // `AuthLoadingScreen` que ja segurava `isReady`/`isTtsReady`. Com a conclusao
  // persistida, na maioria dos cold starts o estado ja nasce resolvido.
  if (
    !navigationState?.key ||
    !isReady ||
    !isTtsReady ||
    (isGateUnresolved && !onboardingGate.error)
  ) {
    return <AuthLoadingScreen />;
  }

  if (isGateUnresolved) {
    return (
      <View style={{ flex: 1, backgroundColor }}>
        <OnboardingGateError
          onRetry={onboardingGate.retry}
          retrying={onboardingGate.isResolving}
        />
      </View>
    );
  }

  const isSignedOut = !isAuthenticated;
  const needsOnboarding = shouldGateOnboarding && onboardingGate.status === "incomplete";
  const hasCompletedOnboarding =
    shouldGateOnboarding && onboardingGate.status === "complete";

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation:
            reduceMotion || Platform.OS === "android" ? "none" : "default",
          contentStyle: {
            backgroundColor,
          },
        }}
      >
        {/*
          Autoridade UNICA de navegacao. `Stack.Protected` decide quais rotas
          existem; `app/index.tsx` e `app/+not-found.tsx` decidem apenas para
          onde mandar quem cai fora do grupo permitido. O antigo
          `NavigationGuard` (useEffect com 8 deps) e as ~18 chamadas de
          `useRequireCompletedOnboarding` deixaram de existir.

          A pasta `app/` nao usa grupos `(auth)/(onboarding)/(app)` e a
          reorganizacao esta fora de escopo, entao os grupos sao declarados por
          nome de rota. `index` fica sempre disponivel: e o destino de fallback
          quando a rota atual sai do ar.
        */}
        <Stack.Screen name="index" />

        <Stack.Protected guard={!onboardingCompleted}>
          <Stack.Screen name="accessibility-onboarding" />
        </Stack.Protected>

        <Stack.Protected guard={onboardingCompleted}>
          {/* Publicas: acessiveis autenticado ou nao (deep links de email). */}
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="auth/forgot-password/reset-password" />
          <Stack.Screen name="auth/underage" />

          <Stack.Protected guard={isSignedOut}>
            <Stack.Screen name="auth/login/index" />
            <Stack.Screen name="auth/cadastro/index" />
            <Stack.Screen name="auth/cadastro/accessibility" />
            <Stack.Screen name="auth/email-code/index" />
            <Stack.Screen name="auth/forgot-password/index" />
          </Stack.Protected>

          <Stack.Protected guard={needsOnboarding}>
            <Stack.Screen name="onboarding/profile" />
            <Stack.Screen name="onboarding/match-preferences" />
          </Stack.Protected>

          <Stack.Protected guard={hasCompletedOnboarding}>
            <Stack.Screen name="home/index" />
            <Stack.Screen name="explore/index" />
            <Stack.Screen name="chats/index" />
            <Stack.Screen name="chats/[conversationId]" />
            <Stack.Screen name="community/index" />
            <Stack.Screen name="community/mine" />
            <Stack.Screen name="community/new" />
            <Stack.Screen name="community/create" />
            <Stack.Screen name="community/comments" />
            <Stack.Screen name="community/join-requests" />
            <Stack.Screen name="community/manage-member" />
            <Stack.Screen name="community/settings" />
            <Stack.Screen name="community/[communityId]" />
            <Stack.Screen name="matches/index" />
            <Stack.Screen name="matches/mutual" />
            <Stack.Screen name="matches/my-profile" />
            <Stack.Screen name="matches/success" />
            <Stack.Screen name="profile/index" />
            <Stack.Screen name="profile/edit" />
            <Stack.Screen name="profile/edit-match-preferences" />
            <Stack.Screen name="profile/accessibility-settings" />
          </Stack.Protected>
        </Stack.Protected>
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TtsProvider>
        <AuthProvider>
          <AccessibilityProvider>
            <AppShellProvider>
              <RootNavigator />
            </AppShellProvider>
          </AccessibilityProvider>
          <GlobalToastViewport />
        </AuthProvider>
      </TtsProvider>
    </SafeAreaProvider>
  );
}
