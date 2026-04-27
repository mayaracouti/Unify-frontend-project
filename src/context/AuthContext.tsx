import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { authService } from "../services/authService";
import { userService } from "../services/userService";
import {
  clearAuthSession,
  clearPendingVerificationEmail,
  getAuthSnapshot,
  saveAuthSession,
  setPendingVerificationEmail,
  subscribeToAuthStorage,
} from "../storage/tokenStorage";
import type {
  CurrentUserResponse,
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
  currentUser: CurrentUserResponse | null;
  isAuthenticated: boolean;
  isReady: boolean;
  pendingVerificationEmail: string | null;
  refreshCurrentUser: () => Promise<CurrentUserResponse | null>;
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
  const [currentUser, setCurrentUser] = useState<CurrentUserResponse | null>(null);
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

      if (!nextSnapshot.session) {
        setIsReady(true);
        return;
      }

      try {
        const user = await userService.getCurrentUser();

        if (!isMounted) {
          return;
        }

        setCurrentUser(user);
      } catch {
        await clearAuthSession();

        if (!isMounted) {
          return;
        }

        setCurrentUser(null);
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    };

    void hydrateAuthState();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!snapshot.session) {
      setCurrentUser(null);
    }
  }, [snapshot.session]);

  const refreshCurrentUser = async () => {
    if (!snapshot.session) {
      setCurrentUser(null);
      return null;
    }

    try {
      const user = await userService.getCurrentUser();
      setCurrentUser(user);
      return user;
    } catch (error) {
      await clearAuthSession();
      setCurrentUser(null);
      throw error;
    }
  };

  const signUp = async (payload: SignUpRequest) => {
    const response = await authService.signUp(payload);
    await clearAuthSession();
    setCurrentUser(null);
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

      const user = await userService.getCurrentUser();

      setCurrentUser(user);

      return {
        status: "authenticated",
        user,
      };
    } catch (error) {
      if (
        isApiError(error) &&
        error.status === 403 &&
        error.error === "USER_EMAIL_NOT_VERIFIED"
      ) {
        await clearAuthSession();
        setCurrentUser(null);
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
      setCurrentUser(null);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      isAuthenticated: Boolean(snapshot.session),
      isReady,
      pendingVerificationEmail: snapshot.pendingVerificationEmail,
      refreshCurrentUser,
      resendVerificationCode,
      session: snapshot.session,
      signIn,
      signOut,
      signUp,
      verifyEmail,
    }),
    [currentUser, isReady, snapshot.pendingVerificationEmail, snapshot.session]
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