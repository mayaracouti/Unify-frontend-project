import { runtimeConfig } from "../config/runtime";
import type { ApiErrorBody, NormalizedApiError } from "../types/auth";
import { showGlobalToast } from "../utils/globalToast";
import { Platform } from "react-native";

export type ApiMethod = "DELETE" | "GET" | "POST" | "PUT";

type PrimitiveQueryValue = boolean | number | string;

export type ApiQueryParams = Record<
  string,
  PrimitiveQueryValue | PrimitiveQueryValue[] | null | undefined
>;

export interface ApiRequestConfig {
  url: string;
  method: ApiMethod;
  params?: ApiQueryParams;
  data?: unknown;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
  skipAuthRefresh?: boolean;
  retryCount?: number;
  suppressErrorToast?: boolean;
  timeoutMs?: number;
}

export interface ApiResponse<T> {
  status: number;
  headers: Headers;
  data: T | null;
}

export type RequestInterceptor = (
  config: ApiRequestConfig
) => Promise<ApiRequestConfig> | ApiRequestConfig;

export type ResponseInterceptor = (
  response: ApiResponse<unknown>,
  request: ApiRequestConfig,
  client: ApiClient
) => Promise<ApiResponse<unknown>> | ApiResponse<unknown>;

export type ResponseErrorInterceptor = (
  error: NormalizedApiError,
  request: ApiRequestConfig,
  client: ApiClient
) => Promise<ApiResponse<unknown>> | ApiResponse<unknown>;

export interface ApiClient {
  baseURL: string;
  timeoutMs: number;
  interceptors: {
    request: RequestInterceptor[];
    response: ResponseInterceptor[];
    error: ResponseErrorInterceptor[];
  };
  request<T>(config: ApiRequestConfig): Promise<ApiResponse<T>>;
}

const DEFAULT_TIMEOUT_MS = 20000;

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function buildUrl(baseURL: string, path: string, params?: ApiQueryParams): string {
  const normalizedBaseUrl = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!params) {
    return `${normalizedBaseUrl}${normalizedPath}`;
  }

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        searchParams.append(key, String(item));
      });
      return;
    }

    searchParams.append(key, String(value));
  });

  const queryString = searchParams.toString();

  return queryString.length > 0
    ? `${normalizedBaseUrl}${normalizedPath}?${queryString}`
    : `${normalizedBaseUrl}${normalizedPath}`;
}

function extractMessage(body: unknown, status: number): string {
  if (typeof body === "string" && body.trim().length > 0) {
    return body;
  }

  if (
    body &&
    typeof body === "object" &&
    "message" in body &&
    typeof body.message === "string" &&
    body.message.trim().length > 0
  ) {
    return body.message;
  }

  if (status >= 500) {
    return "O servidor encontrou um problema ao processar a solicitação.";
  }

  if (status === 401) {
    return "Sua sessão expirou. Faça login novamente.";
  }

  return "Não foi possível concluir a solicitação.";
}

function createApiError(args: {
  status: number;
  body?: unknown;
  rawText?: string;
  message: string;
  isNetworkError: boolean;
}): NormalizedApiError {
  const apiError = new Error(args.message) as NormalizedApiError;
  const errorBody =
    args.body && typeof args.body === "object" ? (args.body as ApiErrorBody) : undefined;

  apiError.name = "ApiError";
  apiError.status = args.status;
  apiError.code = errorBody?.code;
  apiError.error = errorBody?.error;
  apiError.body = args.body;
  apiError.rawText = args.rawText;
  apiError.isNetworkError = args.isNetworkError;

  return apiError;
}

function normalizeApiError(
  error: unknown,
  fallbackMessage = "Não foi possível conectar ao servidor."
): NormalizedApiError {
  if (
    error instanceof Error &&
    typeof (error as Partial<NormalizedApiError>).status === "number"
  ) {
    return error as NormalizedApiError;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return createApiError({
      status: 0,
      message: "A solicitação excedeu o tempo limite configurado.",
      isNetworkError: true,
    });
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return createApiError({
      status: 0,
      message: error.message,
      isNetworkError: true,
    });
  }

  return createApiError({
    status: 0,
    message: fallbackMessage,
    isNetworkError: true,
  });
}

function shouldShowErrorToast(
  error: NormalizedApiError,
  request: ApiRequestConfig
): boolean {
  if (request.suppressErrorToast) {
    return false;
  }

  return error.isNetworkError || error.status >= 400;
}

function getErrorToastTitle(error: NormalizedApiError): string {
  if (error.isNetworkError) {
    return "Falha de conexão";
  }

  if (error.status >= 500) {
    return "Erro no servidor";
  }

  return "Atenção";
}

function buildNetworkFailureMessage(requestUrl: string): string {
  try {
    const parsedUrl = new URL(requestUrl);

    if (
      Platform.OS === "android" &&
      parsedUrl.protocol === "http:" &&
      parsedUrl.hostname === "10.0.2.2"
    ) {
      return "Falha ao conectar com http://10.0.2.2. No Android emulator, libere HTTP claro no app nativo e confira se o proxy do emulador nao esta interceptando esse endereco local.";
    }
  } catch {
    // Fall back to the generic message below when the URL cannot be parsed.
  }

  return "Nao foi possivel conectar ao servidor.";
}

function logNetworkFailure(
  request: ApiRequestConfig,
  requestUrl: string,
  error: NormalizedApiError
): void {
  if (!__DEV__ || !error.isNetworkError) {
    return;
  }

  console.warn("[api] Network request failed", {
    profile: runtimeConfig.profile,
    platform: Platform.OS,
    method: request.method,
    url: requestUrl,
    message: error.message,
  });
}

async function performRequest<T>(
  baseURL: string,
  defaultTimeoutMs: number,
  config: ApiRequestConfig
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const requestUrl = buildUrl(baseURL, config.url, config.params);
  const timeoutHandle = setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? defaultTimeoutMs
  );

  try {
    const response = await fetch(requestUrl, {
      method: config.method,
      headers: config.headers,
      body:
        config.data === undefined
          ? undefined
          : isFormData(config.data)
            ? config.data
            : JSON.stringify(config.data),
      signal: controller.signal,
      credentials: "include",
    });

    const rawText = await response.text();
    let parsedBody: unknown = null;

    if (rawText.length > 0) {
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        parsedBody = rawText;
      }
    }

    if (!response.ok) {
      throw createApiError({
        status: response.status,
        body: parsedBody,
        rawText,
        message: extractMessage(parsedBody, response.status),
        isNetworkError: false,
      });
    }

    return {
      status: response.status,
      headers: response.headers,
      data: parsedBody as T | null,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "Network request failed") {
      throw createApiError({
        status: 0,
        message: buildNetworkFailureMessage(requestUrl),
        isNetworkError: true,
      });
    }

    throw normalizeApiError(error);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export function createApiClient(args?: {
  baseURL?: string;
  timeoutMs?: number;
}): ApiClient {
  const baseURL = args?.baseURL ?? runtimeConfig.apiBaseUrl;
  const timeoutMs = args?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const interceptors = {
    request: [] as RequestInterceptor[],
    response: [] as ResponseInterceptor[],
    error: [] as ResponseErrorInterceptor[],
  };

  const client: ApiClient = {
    baseURL,
    timeoutMs,
    interceptors,
    async request<T>(initialConfig: ApiRequestConfig): Promise<ApiResponse<T>> {
      let nextConfig = { ...initialConfig };

      for (const interceptor of interceptors.request) {
        nextConfig = await interceptor(nextConfig);
      }

      try {
        let response = (await performRequest<unknown>(
          baseURL,
          timeoutMs,
          nextConfig
        )) as ApiResponse<unknown>;

        for (const interceptor of interceptors.response) {
          response = await interceptor(response, nextConfig, client);
        }

        return response as ApiResponse<T>;
      } catch (error) {
        let currentError = normalizeApiError(error);
        const requestUrl = buildUrl(baseURL, nextConfig.url, nextConfig.params);

        logNetworkFailure(nextConfig, requestUrl, currentError);

        for (const interceptor of interceptors.error) {
          try {
            const recoveredResponse = await interceptor(currentError, nextConfig, client);
            return recoveredResponse as ApiResponse<T>;
          } catch (nextError) {
            currentError = normalizeApiError(nextError);
          }
        }

        if (shouldShowErrorToast(currentError, nextConfig)) {
          showGlobalToast({
            title: getErrorToastTitle(currentError),
            message: currentError.message,
            variant: "warning",
          });
        }

        throw currentError;
      }
    },
  };

  return client;
}

export const apiClient = createApiClient();