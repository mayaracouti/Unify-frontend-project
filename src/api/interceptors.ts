import { apiClient, type ApiRequestConfig } from "./client";
import { notifyUserNotFound } from "./session-events";
import { Platform } from "react-native";
import type { AuthSession, NormalizedApiError, TokenResponse } from "../types/auth";
import { createAuthSession, isApiError } from "../types/auth";
import {
  clearAllStoredAuthData,
  clearAuthSession,
  getAuthSnapshot,
  saveAuthSession,
} from "../storage/tokenStorage";
import { showGlobalToast } from "../utils/globalToast";

let initialized = false;
let refreshPromise: Promise<RefreshOutcome> | null = null;

/**
 * Desfecho de uma tentativa de renovacao de sessao.
 *
 * - `refreshed`: `/auth/refresh` devolveu tokens novos.
 * - `invalid`: o proprio `/auth/refresh` respondeu de forma AUTORITATIVA que a
 *   sessao morreu (401/403) ou devolveu corpo vazio. So aqui a sessao e limpa.
 * - `unavailable`: nao deu para saber (timeout/rede = status 0, 408, 429, 5xx).
 *   A sessao e PRESERVADA e a request original falha com o erro original.
 */
export type RefreshOutcome =
  | { status: "refreshed"; session: AuthSession }
  | { status: "invalid" }
  | { status: "unavailable" };

/**
 * Politica tri-estado, isolada como funcao pura para poder ser testada sem
 * rede: apenas 401/403 vindos do `/auth/refresh` derrubam a sessao. Qualquer
 * outra falha (incluindo 429 do rate limit e 5xx) e transitoria.
 *
 * Antes disso, um `catch` generico deslogava o usuario silenciosamente a cada
 * perda momentanea de rede.
 */
export function classifyRefreshFailureStatus(
  status: number
): "invalid" | "unavailable" {
  return status === 401 || status === 403 ? "invalid" : "unavailable";
}

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

async function refreshSession(refreshToken: string): Promise<RefreshOutcome> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async (): Promise<RefreshOutcome> => {
    try {
      const response = await apiClient.request<TokenResponse>({
        url: "/auth/refresh",
        method: "POST",
        data: { refreshToken },
        skipAuthRefresh: true,
        suppressErrorToast: true,
      });

      if (!response.data) {
        // 2xx sem corpo: resposta autoritativa e inutilizavel.
        await clearAuthSession();
        return { status: "invalid" };
      }

      const session = createAuthSession(response.data);
      await saveAuthSession(session);
      return { status: "refreshed", session };
    } catch (error) {
      const status = isApiError(error) ? error.status : 0;

      if (classifyRefreshFailureStatus(status) === "invalid") {
        await clearAuthSession();
        return { status: "invalid" };
      }

      return { status: "unavailable" };
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
    let sessionAlreadyResolved = false;

    if (
      error.status === 401 &&
      request.requiresAuth &&
      !request.skipAuthRefresh &&
      (request.retryCount ?? 0) < 1
    ) {
      const snapshot = await getAuthSnapshot();
      const outcome: RefreshOutcome = snapshot.session?.refreshToken
        ? await refreshSession(snapshot.session.refreshToken)
        : { status: "invalid" };

      if (outcome.status === "refreshed") {
        return client.request({
          ...request,
          retryCount: (request.retryCount ?? 0) + 1,
        });
      }

      if (outcome.status === "invalid") {
        // `refreshSession` ja limpou a sessao no caminho autoritativo; sem
        // refresh token guardado, limpa aqui.
        await clearAuthSession();
      }

      // `unavailable`: mantem a sessao e deixa o erro original subir.
      sessionAlreadyResolved = true;
    }

    // Apenas 401 significa "sessao invalida". 403 e negacao de permissao de
    // negocio (ex.: moderador tentando alterar um admin) e NAO deve deslogar.
    // O 401 da request de negocio so desloga quando NAO houve uma tentativa de
    // refresh: se houve, quem manda e o desfecho dela (um 429/5xx no refresh
    // nao pode derrubar a sessao).
    if (error.status === 401 && request.requiresAuth && !sessionAlreadyResolved) {
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