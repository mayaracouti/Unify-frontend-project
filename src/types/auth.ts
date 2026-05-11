export interface SignUpRequest {
  name: string;
  lastName: string;
  email: string;
  password: string;
  birthdate: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface EmailVerificationRequest {
  email: string;
  code: string;
}

export interface ResendEmailVerificationRequest {
  email: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface VerificationCodeDispatchResponse {
  email: string;
  expiresInSeconds: number;
  message: string;
}

export interface MessageResponse {
  message: string;
}

export interface CurrentUserResponse {
  id: string;
  name: string;
  lastName: string;
  email: string;
  cellphone: string;
}

export interface ApiErrorBody {
  code?: number;
  error?: string;
  message?: string;
  timestamp?: number;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
}

export interface StoredAuthSnapshot {
  session: AuthSession | null;
  pendingVerificationEmail: string | null;
}

export interface NormalizedApiError extends Error {
  status: number;
  code?: number;
  error?: string;
  body?: unknown;
  rawText?: string;
  isNetworkError: boolean;
}

export type SignInResult =
  | {
      status: "authenticated";
    }
  | {
      status: "needs-verification";
      email: string;
    };

export function createAuthSession(tokenResponse: TokenResponse): AuthSession {
  return {
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken,
    accessTokenExpiresAt: Date.now() + tokenResponse.expiresIn * 1000,
  };
}

export function isApiError(value: unknown): value is NormalizedApiError {
  return value instanceof Error && typeof (value as NormalizedApiError).status === "number";
}