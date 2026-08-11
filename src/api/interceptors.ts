import { apiClient } from "./client";
import type { AuthSession, TokenResponse } from "../types/auth";
import { createAuthSession } from "../types/auth";
import { clearAuthSession, getAuthSnapshot, saveAuthSession } from "../storage/tokenStorage";

let initialized = false;
let refreshPromise: Promise<AuthSession | null> | null = null;

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

    throw error;
  });

  initialized = true;
}

initializeApiInterceptors();