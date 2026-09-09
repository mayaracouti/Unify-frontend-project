/**
 * Politica tri-estado do refresh de sessao: so uma resposta AUTORITATIVA do
 * proprio `/auth/refresh` (401/403) pode deslogar o usuario. Timeout, falha de
 * rede, 429 do rate limit e 5xx preservam a sessao e deixam o erro original da
 * request de negocio subir.
 */
import { Platform } from "react-native";

function createMemorySecureStore() {
  const store = new Map<string, string>();

  return {
    getItemAsync: jest.fn((key: string) =>
      Promise.resolve(store.has(key) ? store.get(key)! : null)
    ),
    setItemAsync: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
}

type FetchStep =
  | { kind: "json"; status: number; body?: unknown }
  | { kind: "throw"; error: Error };

function createFetchMock(steps: FetchStep[]) {
  const calls: { url: string; method: string }[] = [];

  const fetchMock = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, method: String(init?.method ?? "GET") });

    const step = steps[calls.length - 1];

    if (!step) {
      throw new Error(`fetch inesperado: ${url}`);
    }

    if (step.kind === "throw") {
      throw step.error;
    }

    return {
      ok: step.status >= 200 && step.status < 300,
      status: step.status,
      headers: new Headers(),
      text: async () => (step.body === undefined ? "" : JSON.stringify(step.body)),
    };
  });

  return { fetchMock, calls };
}

const initialSession = {
  accessToken: "access-antigo",
  refreshToken: "refresh-antigo",
  accessTokenExpiresAt: Date.now() + 60_000,
};

const originalPlatformOS = Platform.OS;
const originalFetch = global.fetch;

async function setupApi(steps: FetchStep[]) {
  const { fetchMock, calls } = createFetchMock(steps);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.fetch = fetchMock as any;

  const tokenStorage = require("../../storage/tokenStorage");
  await tokenStorage.saveAuthSession(initialSession);

  const { apiClient } = require("../client");
  require("../interceptors");

  return { apiClient, tokenStorage, fetchMock, calls };
}

describe("interceptors: politica de refresh", () => {
  beforeEach(() => {
    jest.resetModules();
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
    jest.doMock("expo-secure-store", () => createMemorySecureStore());
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOS,
    });
    global.fetch = originalFetch;
    jest.dontMock("expo-secure-store");
  });

  it("classifica apenas 401/403 do refresh como sessao invalida", () => {
    const { classifyRefreshFailureStatus } = require("../interceptors");

    expect(classifyRefreshFailureStatus(401)).toBe("invalid");
    expect(classifyRefreshFailureStatus(403)).toBe("invalid");
    expect(classifyRefreshFailureStatus(0)).toBe("unavailable");
    expect(classifyRefreshFailureStatus(408)).toBe("unavailable");
    expect(classifyRefreshFailureStatus(429)).toBe("unavailable");
    expect(classifyRefreshFailureStatus(500)).toBe("unavailable");
    expect(classifyRefreshFailureStatus(503)).toBe("unavailable");
  });

  it("401 na request -> refresh ok -> repete a request com o token novo", async () => {
    const { apiClient, tokenStorage, calls } = await setupApi([
      { kind: "json", status: 401, body: { message: "expirado" } },
      {
        kind: "json",
        status: 200,
        body: {
          accessToken: "access-novo",
          refreshToken: "refresh-novo",
          expiresIn: 3600,
        },
      },
      { kind: "json", status: 200, body: { ok: true } },
    ]);

    const response = await apiClient.request({
      url: "/profiles/me",
      method: "GET",
      requiresAuth: true,
      suppressErrorToast: true,
    });

    expect(response.data).toEqual({ ok: true });
    expect(calls).toHaveLength(3);
    expect(calls[1].url).toContain("/auth/refresh");
    expect(await tokenStorage.getToken()).toBe("access-novo");
  });

  it("refresh 401 limpa a sessao e propaga o erro original", async () => {
    const { apiClient, tokenStorage } = await setupApi([
      { kind: "json", status: 401, body: { message: "expirado" } },
      { kind: "json", status: 401, body: { message: "refresh token invalido" } },
    ]);

    await expect(
      apiClient.request({
        url: "/profiles/me",
        method: "GET",
        requiresAuth: true,
        suppressErrorToast: true,
      })
    ).rejects.toMatchObject({ status: 401 });

    expect(await tokenStorage.getToken()).toBeNull();
    expect((await tokenStorage.getAuthSnapshot()).session).toBeNull();
  });

  it("refresh 500 preserva a sessao e propaga o erro original", async () => {
    const { apiClient, tokenStorage } = await setupApi([
      { kind: "json", status: 401, body: { message: "expirado" } },
      { kind: "json", status: 500, body: { message: "boom" } },
    ]);

    await expect(
      apiClient.request({
        url: "/profiles/me",
        method: "GET",
        requiresAuth: true,
        suppressErrorToast: true,
      })
    ).rejects.toMatchObject({ status: 401, message: expect.stringContaining("expirado") });

    expect(await tokenStorage.getToken()).toBe(initialSession.accessToken);
  });

  it("refresh com 429 do rate limit preserva a sessao", async () => {
    const { apiClient, tokenStorage } = await setupApi([
      { kind: "json", status: 401, body: { message: "expirado" } },
      { kind: "json", status: 429, body: { message: "muitas tentativas" } },
    ]);

    await expect(
      apiClient.request({
        url: "/profiles/me",
        method: "GET",
        requiresAuth: true,
        suppressErrorToast: true,
      })
    ).rejects.toMatchObject({ status: 401 });

    expect(await tokenStorage.getToken()).toBe(initialSession.accessToken);
  });

  it("timeout/falha de rede no refresh preserva a sessao", async () => {
    const { apiClient, tokenStorage } = await setupApi([
      { kind: "json", status: 401, body: { message: "expirado" } },
      { kind: "throw", error: new Error("Network request failed") },
    ]);

    await expect(
      apiClient.request({
        url: "/profiles/me",
        method: "GET",
        requiresAuth: true,
        suppressErrorToast: true,
      })
    ).rejects.toMatchObject({ status: 401 });

    expect(await tokenStorage.getToken()).toBe(initialSession.accessToken);
  });
});
