import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { authService } from "../services/authService";
import {
  clearAuthSession,
  clearPendingVerificationEmail,
  getAuthSnapshot,
  saveAuthSession,
  setPendingVerificationEmail,
  subscribeToAuthStorage,
} from "../storage/tokenStorage";
import type {
  EmailVerificationRequest,
  ResendEmailVerificationRequest,
  SignInRequest,
  SignInResult,
  SignUpRequest,
  StoredAuthSnapshot,
  VerificationCodeDispatchResponse,
} from "../types/auth";
import { createAuthSession, isApiError } from "../types/auth";
import { normalizeEmail } from "../utils/auth";

type AuthContextValue = {
  isAuthenticated: boolean;
  isReady: boolean;
  pendingVerificationEmail: string | null;
  resendVerificationCode: (
    email?: string
  ) => Promise<VerificationCodeDispatchResponse>;
  session: StoredAuthSnapshot["session"];
  signIn: (payload: SignInRequest) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  signUp: (payload: SignUpRequest) => Promise<VerificationCodeDispatchResponse>;
  verifyEmail: (payload: EmailVerificationRequest) => Promise<{ message: string }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const INITIAL_SNAPSHOT: StoredAuthSnapshot = {
  session: null,
  pendingVerificationEmail: null,
};

export function AuthProvider({ children }: PropsWithChildren) {
  const [snapshot, setSnapshot] = useState<StoredAuthSnapshot>(INITIAL_SNAPSHOT);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeToAuthStorage((nextSnapshot) => {
      if (!isMounted) {
        return;
      }

      setSnapshot(nextSnapshot);
    });

    const hydrateAuthState = async () => {
      const nextSnapshot = await getAuthSnapshot();

      if (!isMounted) {
        return;
      }

      setSnapshot(nextSnapshot);

      if (isMounted) {
        setIsReady(true);
      }
    };

    void hydrateAuthState();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const signUp = async (payload: SignUpRequest) => {
    const response = await authService.signUp(payload);
    await clearAuthSession();
    await setPendingVerificationEmail(response.email);
    return response;
  };

  const signIn = async (payload: SignInRequest): Promise<SignInResult> => {
    const normalizedEmail = normalizeEmail(payload.email);

    try {
      const tokenResponse = await authService.signIn({
        ...payload,
        email: normalizedEmail,
      });

      const session = createAuthSession(tokenResponse);

      await saveAuthSession(session);
      await clearPendingVerificationEmail();

      return {
        status: "authenticated",
      };
    } catch (error) {
      if (
        isApiError(error) &&
        error.status === 403 &&
        error.error === "USER_EMAIL_NOT_VERIFIED"
      ) {
        await clearAuthSession();
        await setPendingVerificationEmail(normalizedEmail);

        return {
          status: "needs-verification",
          email: normalizedEmail,
        };
      }

      throw error;
    }
  };

  const verifyEmail = async (payload: EmailVerificationRequest) => {
    const response = await authService.verifyEmail(payload);
    await clearPendingVerificationEmail();
    return response;
  };

  const resendVerificationCode = async (
    email?: string
  ): Promise<VerificationCodeDispatchResponse> => {
    const targetEmail = normalizeEmail(email ?? snapshot.pendingVerificationEmail ?? "");

    if (!targetEmail) {
      throw new Error("Nenhum email pendente foi encontrado para reenviar o código.");
    }

    const response = await authService.resendEmailVerification({
      email: targetEmail,
    } as ResendEmailVerificationRequest);

    await setPendingVerificationEmail(response.email);

    return response;
  };

  const signOut = async () => {
    try {
      if (snapshot.session) {
        await authService.logout();
      }
    } catch {
      // Local cleanup still wins because the backend only revokes refresh tokens.
    } finally {
      await clearAuthSession();
      await clearPendingVerificationEmail();
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(snapshot.session),
      isReady,
      pendingVerificationEmail: snapshot.pendingVerificationEmail,
      resendVerificationCode,
      session: snapshot.session,
      signIn,
      signOut,
      signUp,
      verifyEmail,
    }),
    [isReady, snapshot.pendingVerificationEmail, snapshot.session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}