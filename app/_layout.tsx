// @ts-ignore
import "../global.css";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { applyGlobalTextAdjustmentsPatch } from "../src/accessibility/global-text-adjustments";
import { TtsProvider, useTTS } from "../src/accessibility/tts";
import { AuthLoadingScreen } from "../src/components/ui/auth-loading-screen";
import { GlobalToastViewport } from "../src/components/ui/global-toast-viewport";
import {
  AccessibilityProvider,
  useAccessibility,
} from "../src/context/AccessibilityContext";
import { AppShellProvider } from "../src/context/AppShellContext";
import { AuthProvider, useAuth } from "../src/context/AuthContext";

// Aplica o patch global de `Text`/`TextInput` antes de qualquer tela renderizar,
// para que a escala de fonte e o alto contraste valham no app inteiro.
applyGlobalTextAdjustmentsPatch();

function NavigationGuard() {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const { isAuthenticated, isReady, pendingVerificationEmail } = useAuth();
  const { isReady: isTtsReady, onboardingCompleted } = useTTS();

  useEffect(() => {
    if (!navigationState?.key || !isReady || !isTtsReady) {
      return;
    }

    const routePath = segments.join("/");
    const isAccessibilityOnboardingRoute = routePath === "accessibility-onboarding";

    // Primeiro launch: o onboarding de acessibilidade (TTS ligado por padrao)
    // precisa acontecer ANTES de qualquer outra tela, autenticado ou nao.
    if (!onboardingCompleted) {
      if (!isAccessibilityOnboardingRoute) {
        router.replace("/accessibility-onboarding");
      }
      return;
    }

    if (isAccessibilityOnboardingRoute) {
      router.replace("/");
      return;
    }

    const isIndexRoute = routePath.length === 0 || routePath === "index";
    const isAuthRoute = routePath.startsWith("auth");
    const isVerificationRoute = routePath === "auth/email-code";
    const isResetPasswordRoute =
      routePath === "reset-password" ||
      routePath === "auth/forgot-password/reset-password";

    if (isIndexRoute) {
      return;
    }

    if (pendingVerificationEmail && !isVerificationRoute && !isResetPasswordRoute) {
      router.replace({
        pathname: "/auth/email-code",
        params: { email: pendingVerificationEmail },
      });
      return;
    }

    if (isAuthenticated && isAuthRoute && !isResetPasswordRoute) {
      router.replace("/home");
      return;
    }

    if (
      !isAuthenticated &&
      !pendingVerificationEmail &&
      !isAuthRoute &&
      !isResetPasswordRoute
    ) {
      router.replace("/auth/login");
    }
  }, [
    isAuthenticated,
    isReady,
    isTtsReady,
    navigationState?.key,
    onboardingCompleted,
    pendingVerificationEmail,
    router,
    segments,
  ]);

  return null;
}

function RootNavigator() {
  const navigationState = useRootNavigationState();
  const { isReady } = useAuth();
  const { isReady: isTtsReady } = useTTS();
  const { settings } = useAccessibility();

  // Em alto contraste o fundo raiz vira preto puro: combinado com o mapeamento
  // de cor de texto do patch global, e o que garante o contraste maximo sem
  // precisar editar as telas uma a uma.
  const backgroundColor = settings.highContrast ? "#000000" : "#201233";
  const reduceMotion = settings.reduceMotion;

  if (!navigationState?.key || !isReady || !isTtsReady) {
    return <AuthLoadingScreen />;
  }

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <NavigationGuard />
      <Stack
        screenOptions={{
          headerShown: false,
          animation:
            reduceMotion || Platform.OS === "android" ? "none" : "default",
          contentStyle: {
            backgroundColor,
          },
        }}
      />
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
