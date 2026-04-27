import { Redirect } from "expo-router";

import { AuthLoadingScreen } from "../src/components/ui/auth-loading-screen";
import { useAuth } from "../src/context/AuthContext";

export default function Index() {
  const { isAuthenticated, isReady, pendingVerificationEmail } = useAuth();

  if (!isReady) {
    return <AuthLoadingScreen />;
  }

  if (pendingVerificationEmail) {
    return (
      <Redirect
        href={{
          pathname: "/auth/email-code",
          params: { email: pendingVerificationEmail },
        }}
      />
    );
  }

  return <Redirect href={isAuthenticated ? "/home" : "/auth/login"} />;
}