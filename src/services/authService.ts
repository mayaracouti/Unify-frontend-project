import { customApiCall } from "../api/customApi";
import type {
  EmailVerificationRequest,
  ForgotPasswordRequest,
  MessageResponse,
  RefreshTokenRequest,
  ResendEmailVerificationRequest,
  ResetPasswordRequest,
  SignInRequest,
  SignUpRequest,
  TokenResponse,
  VerificationCodeDispatchResponse,
} from "../types/auth";
import { normalizeEmail, normalizeVerificationCode } from "../utils/auth";

export const authService = {
  signUp(payload: SignUpRequest) {
    return customApiCall.post<VerificationCodeDispatchResponse, SignUpRequest>(
      "/auth/signup",
      {
        ...payload,
        email: normalizeEmail(payload.email),
      }
    );
  },

  signIn(payload: SignInRequest) {
    return customApiCall.post<TokenResponse, SignInRequest>("/auth/signin", {
      ...payload,
      email: normalizeEmail(payload.email),
    });
  },

  verifyEmail(payload: EmailVerificationRequest) {
    return customApiCall.post<MessageResponse, EmailVerificationRequest>(
      "/auth/verify-email",
      {
        email: normalizeEmail(payload.email),
        code: normalizeVerificationCode(payload.code),
      }
    );
  },

  resendEmailVerification(payload: ResendEmailVerificationRequest) {
    return customApiCall.post<
      VerificationCodeDispatchResponse,
      ResendEmailVerificationRequest
    >("/auth/resend-email-verification", {
      email: normalizeEmail(payload.email),
    });
  },

  forgotPassword(payload: ForgotPasswordRequest) {
    return customApiCall.post<MessageResponse, ForgotPasswordRequest>(
      "/auth/forgot-password",
      {
        email: normalizeEmail(payload.email),
      }
    );
  },

  resetPassword(payload: ResetPasswordRequest) {
    return customApiCall.post<MessageResponse, ResetPasswordRequest>(
      "/auth/reset-password",
      {
        token: payload.token.trim(),
        password: payload.password,
      }
    );
  },

  refresh(payload: RefreshTokenRequest) {
    return customApiCall.post<TokenResponse, RefreshTokenRequest>(
      "/auth/refresh",
      payload
    );
  },

  logout() {
    return customApiCall.post<null>("/auth/logout", undefined, {
      requiresAuth: true,
      suppressErrorToast: true,
    });
  },
};