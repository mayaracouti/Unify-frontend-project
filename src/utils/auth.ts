import { isApiError } from "../types/auth";

const FORBIDDEN_MESSAGE = "Sua conta não tem permissão para acessar este conteúdo.";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeVerificationCode(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase().slice(0, 6);
}

export function formatApiErrorMessage(
  error: unknown,
  fallbackMessage: string
): string {
  if (isApiError(error) && error.status === 403) {
    return FORBIDDEN_MESSAGE;
  }

  if (isApiError(error) && error.message.trim().length > 0) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}