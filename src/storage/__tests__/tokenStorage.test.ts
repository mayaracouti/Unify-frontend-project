/**
 * `tokenStorage` guarda a sessao de autenticacao usando `expo-secure-store`
 * no nativo e `localStorage` no web. Os dois caminhos sao testados aqui.
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

function createMemoryLocalStorage() {
  const store = new Map<string, string>();

  return {
    getItem: jest.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: jest.fn((key: string) => {
      store.delete(key);
    }),
    clear: jest.fn(() => {
      store.clear();
    }),
  };
}

const session = {
  accessToken: "access-123",
  refreshToken: "refresh-456",
  accessTokenExpiresAt: Date.now() + 60_000,
};

const originalPlatformOS = Platform.OS;

describe("tokenStorage (nativo, expo-secure-store)", () => {
  beforeEach(() => {
    jest.resetModules();
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "ios",
    });
    jest.doMock("expo-secure-store", () => createMemorySecureStore());
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  it("salva, le e limpa a sessao", async () => {
    const { saveAuthSession, getToken, getRefreshToken, clearAuthSession } =
      require("../tokenStorage");

    await saveAuthSession(session);

    expect(await getToken()).toBe(session.accessToken);
    expect(await getRefreshToken()).toBe(session.refreshToken);

    await clearAuthSession();

    expect(await getToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
  });

  it("getAuthSnapshot retorna null quando nao ha sessao salva", async () => {
    const { getAuthSnapshot } = require("../tokenStorage");

    const snapshot = await getAuthSnapshot();

    expect(snapshot.session).toBeNull();
    expect(snapshot.pendingVerificationEmail).toBeNull();
  });
});

describe("tokenStorage (web, localStorage)", () => {
  const originalLocalStorage = (globalThis as any).localStorage;

  beforeEach(() => {
    jest.resetModules();
    (globalThis as any).localStorage = createMemoryLocalStorage();
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "web",
    });
  });

  afterEach(() => {
    (globalThis as any).localStorage = originalLocalStorage;
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  it("salva, le e limpa a sessao usando localStorage", async () => {
    const { saveAuthSession, getToken, clearAuthSession } = require("../tokenStorage");

    await saveAuthSession(session);
    expect(await getToken()).toBe(session.accessToken);
    expect((globalThis as any).localStorage.setItem).toHaveBeenCalled();

    await clearAuthSession();
    expect(await getToken()).toBeNull();
  });

  it("clearAllStoredAuthData com clearEntireWebStorage limpa o storage inteiro", async () => {
    const { saveAuthSession, clearAllStoredAuthData, getToken } =
      require("../tokenStorage");

    await saveAuthSession(session);
    await clearAllStoredAuthData({ clearEntireWebStorage: true });

    expect((globalThis as any).localStorage.clear).toHaveBeenCalled();
    expect(await getToken()).toBeNull();
  });
});
