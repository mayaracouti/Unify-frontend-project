// @ts-ignore
import "../global.css";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthLoadingScreen } from "../src/components/ui/auth-loading-screen";
import { GlobalToastViewport } from "../src/components/ui/global-toast-viewport";
import { AuthProvider, useAuth } from "../src/context/AuthContext";

function NavigationGuard() {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const { isAuthenticated, isReady, pendingVerificationEmail } = useAuth();

  useEffect(() => {
    if (!navigationState?.key || !isReady) {
      return;
    }

    const routePath = segments.join("/");
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
    navigationState?.key,
    pendingVerificationEmail,
    router,
    segments,
  ]);

  return null;
}

function RootNavigator() {
  const navigationState = useRootNavigationState();
  const { isReady } = useAuth();

  if (!navigationState?.key || !isReady) {
    return <AuthLoadingScreen />;
  }

  return (
    <>
      <NavigationGuard />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: Platform.OS === "android" ? "none" : "default",
          contentStyle: {
            backgroundColor: "#201233",
          },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
        <GlobalToastViewport />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
