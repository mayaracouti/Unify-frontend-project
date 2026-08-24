import { apiClient, type ApiRequestConfig } from "./client";
import { notifyUserNotFound } from "./session-events";
import { Platform } from "react-native";
import type { AuthSession, NormalizedApiError, TokenResponse } from "../types/auth";
import { createAuthSession } from "../types/auth";
import {
  clearAllStoredAuthData,
  clearAuthSession,
  getAuthSnapshot,
  saveAuthSession,
} from "../storage/tokenStorage";
import { showGlobalToast } from "../utils/globalToast";

let initialized = false;
let refreshPromise: Promise<AuthSession | null> | null = null;

/** `ErrorCode.USER_NOT_FOUND` do backend (HTTP 404). */
const USER_NOT_FOUND_ERROR = "USER_NOT_FOUND";
const USER_NOT_FOUND_CODE = 4001;
const USER_NOT_FOUND_MESSAGE = "Usuário não encontrado";

/**
 * `true` somente quando o backend diz, de forma explicita, que o usuario
 * AUTENTICADO nao existe mais (o token e valido, mas o registro sumiu).
 *
 * A checagem e deliberadamente estreita: exige a requisicao autenticada, o
 * status 404 e o identificador do erro no corpo. Um 404 generico
 * (`RESOURCE_NOT_FOUND`, ex.: "Perfil de destino nao encontrado"), um 403 ou
 * qualquer outra falha NAO desloga ninguem.
 */
function isAuthenticatedUserNotFound(
  error: NormalizedApiError,
  request: ApiRequestConfig
): boolean {
  return (
    request.requiresAuth === true &&
    error.status === 404 &&
    (error.error === USER_NOT_FOUND_ERROR || error.code === USER_NOT_FOUND_CODE)
  );
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function hasHeader(headers: Record<string, string>, headerName: string): boolean {
  const normalizedHeaderName = headerName.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === normalizedHeaderName);
}

async function refreshSession(refreshToken: string): Promise<AuthSession | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await apiClient.request<TokenResponse>({
        url: "/auth/refresh",
        method: "POST",
        data: { refreshToken },
        skipAuthRefresh: true,
        suppressErrorToast: true,
      });

      if (!response.data) {
        await clearAuthSession();
        return null;
      }

      const session = createAuthSession(response.data);
      await saveAuthSession(session);
      return session;
    } catch {
      await clearAuthSession();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function initializeApiInterceptors() {
  if (initialized) {
    return;
  }

  apiClient.interceptors.request.push(async (config) => {
    const headers = { ...(config.headers ?? {}) };

    if (!hasHeader(headers, "Accept")) {
      headers.Accept = "application/json";
    }

    if (
      config.data !== undefined &&
      !isFormData(config.data) &&
      !hasHeader(headers, "Content-Type")
    ) {
      headers["Content-Type"] = "application/json";
    }

    if (!config.requiresAuth) {
      return {
        ...config,
        headers,
      };
    }

    const snapshot = await getAuthSnapshot();

    if (snapshot.session?.accessToken) {
      headers.Authorization = `Bearer ${snapshot.session.accessToken}`;
    }

    return {
      ...config,
      headers,
    };
  });

  apiClient.interceptors.error.push(async (error, request, client) => {
    if (
      error.status === 401 &&
      request.requiresAuth &&
      !request.skipAuthRefresh &&
      (request.retryCount ?? 0) < 1
    ) {
      const snapshot = await getAuthSnapshot();
      const nextSession = snapshot.session?.refreshToken
        ? await refreshSession(snapshot.session.refreshToken)
        : null;

      if (nextSession) {
        return client.request({
          ...request,
          retryCount: (request.retryCount ?? 0) + 1,
        });
      }
    }

    // Apenas 401 significa "sessao invalida". 403 e negacao de permissao de
    // negocio (ex.: moderador tentando alterar um admin) e NAO deve deslogar.
    if (error.status === 401 && request.requiresAuth) {
      await clearAuthSession();
    }

    // Usuario autenticado que nao existe mais no backend: nao ha o que
    // recuperar, entao a sessao e encerrada e o app avisa com uma mensagem
    // unica. O `NavigationGuard` leva para o login assim que a sessao some.
    if (isAuthenticatedUserNotFound(error, request)) {
      const clearedByAuthProvider = await notifyUserNotFound();

      if (!clearedByAuthProvider) {
        await clearAllStoredAuthData({
          clearEntireWebStorage: Platform.OS === "web",
        });
      }

      // Evita o toast generico do cliente HTTP em cima deste.
      error.toastHandled = true;

      showGlobalToast({
        message: USER_NOT_FOUND_MESSAGE,
        variant: "error",
      });
    }

    throw error;
  });

  initialized = true;
}

initializeApiInterceptors();