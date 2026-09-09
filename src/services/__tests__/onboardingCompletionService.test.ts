import type { ProfileCompletionResponse } from "../../types/profile";

const mockStore = new Map<string, string>();
const mockGetCompletion = jest.fn<Promise<ProfileCompletionResponse>, []>();

jest.mock("../profileService", () => ({
  profileService: {
    getCompletion: () => mockGetCompletion(),
  },
}));

jest.mock("../../storage/bulkStorage", () => ({
  getBulkItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setBulkItem: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  removeBulkItem: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

const USER_ID = "8ba0a0a5-1f1a-4f52-9a2e-0f0f8d0b7d11";
const STORAGE_KEY = `unify.onboarding.completion.v1.${USER_ID}`;

function completionResponse(
  overrides: Partial<ProfileCompletionResponse> = {}
): ProfileCompletionResponse {
  const profileCompleted = overrides.profileCompleted ?? true;
  const matchPreferencesCompleted = overrides.matchPreferencesCompleted ?? true;

  return {
    profileCompleted,
    matchPreferencesCompleted,
    fullyCompleted: profileCompleted && matchPreferencesCompleted,
    missingProfileFields: [],
    missingMatchPreferenceFields: [],
    ...overrides,
  };
}

function seedPersistedCompletion(entry: {
  profileCompleted: boolean;
  matchPreferencesCompleted: boolean;
  fetchedAt?: number;
}) {
  mockStore.set(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      profileCompleted: entry.profileCompleted,
      matchPreferencesCompleted: entry.matchPreferencesCompleted,
      fetchedAt: entry.fetchedAt ?? 1,
    })
  );
}

type Service = typeof import("../onboardingCompletionService");

function loadService(): Service {
  // O servico guarda cache em modulo; cada teste precisa de uma instancia limpa.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("../onboardingCompletionService") as Service;
}

describe("onboardingCompletionService", () => {
  let service: Service;

  beforeEach(() => {
    jest.resetModules();
    mockStore.clear();
    mockGetCompletion.mockReset();
    service = loadService();
  });

  it("usa o cache persistido mesmo quando a rede falha (cache hit sem rede)", async () => {
    seedPersistedCompletion({
      profileCompleted: true,
      matchPreferencesCompleted: true,
      fetchedAt: 1000,
    });
    mockGetCompletion.mockRejectedValue(new Error("offline"));

    const snapshot = await service.loadOnboardingCompletion(USER_ID);

    expect(snapshot.status).toBe("complete");
    expect(snapshot.source).toBe("cache");
    expect(snapshot.fetchedAt).toBe(1000);
    expect(snapshot.error).toBeNull();
  });

  it("cai para `unknown` quando nao ha cache e a rede falha", async () => {
    const networkError = new Error("network down");
    mockGetCompletion.mockRejectedValue(networkError);

    const snapshot = await service.loadOnboardingCompletion(USER_ID);

    expect(snapshot.status).toBe("unknown");
    expect(snapshot.source).toBeNull();
    expect(snapshot.completion).toBeNull();
    expect(snapshot.error).toBe(networkError);
    expect(mockStore.has(STORAGE_KEY)).toBe(false);
  });

  it("persiste a resposta quando nao ha cache e a rede responde", async () => {
    mockGetCompletion.mockResolvedValue(
      completionResponse({ profileCompleted: true, matchPreferencesCompleted: false })
    );

    const snapshot = await service.loadOnboardingCompletion(USER_ID);

    expect(snapshot.status).toBe("incomplete");
    expect(snapshot.source).toBe("network");
    expect(JSON.parse(mockStore.get(STORAGE_KEY) as string)).toEqual(
      expect.objectContaining({
        version: 1,
        profileCompleted: true,
        matchPreferencesCompleted: false,
      })
    );

    // Segunda leitura nao vai a rede para decidir: o cache ja responde.
    mockGetCompletion.mockClear();
    const cachedSnapshot = await service.loadOnboardingCompletion(USER_ID);

    expect(cachedSnapshot.source).toBe("cache");
    expect(cachedSnapshot.status).toBe("incomplete");
  });

  it("marca a conclusao feita pelo proprio app sem ida a rede", async () => {
    seedPersistedCompletion({
      profileCompleted: true,
      matchPreferencesCompleted: false,
    });
    mockGetCompletion.mockRejectedValue(new Error("offline"));

    const listener = jest.fn();
    const unsubscribe = service.subscribeToOnboardingCompletion(listener);

    await service.markOnboardingCompletionForSession(USER_ID, {
      matchPreferencesCompleted: true,
    });

    expect(listener).toHaveBeenCalled();
    unsubscribe();

    const snapshot = await service.loadOnboardingCompletion(USER_ID);

    expect(snapshot.status).toBe("complete");
    expect(snapshot.source).toBe("cache");
    expect(JSON.parse(mockStore.get(STORAGE_KEY) as string)).toEqual(
      expect.objectContaining({
        profileCompleted: true,
        matchPreferencesCompleted: true,
      })
    );
  });

  it("invalida memoria e chave persistida no logout", async () => {
    mockGetCompletion.mockResolvedValue(completionResponse());

    await service.loadOnboardingCompletion(USER_ID);
    expect(service.hasCompletedOnboardingForSession(USER_ID)).toBe(true);

    await service.clearOnboardingCompletionCache(USER_ID);

    expect(service.hasCompletedOnboardingForSession(USER_ID)).toBe(false);
    expect(mockStore.has(STORAGE_KEY)).toBe(false);

    // Sem cache: a proxima leitura precisa da rede de novo.
    mockGetCompletion.mockClear();
    mockGetCompletion.mockRejectedValue(new Error("offline"));

    const snapshot = await service.loadOnboardingCompletion(USER_ID);

    expect(mockGetCompletion).toHaveBeenCalledTimes(1);
    expect(snapshot.status).toBe("unknown");
  });

  it("ignora payload persistido de versao desconhecida", async () => {
    mockStore.set(
      STORAGE_KEY,
      JSON.stringify({ version: 99, profileCompleted: true, matchPreferencesCompleted: true })
    );
    mockGetCompletion.mockResolvedValue(
      completionResponse({ profileCompleted: false, matchPreferencesCompleted: false })
    );

    const snapshot = await service.loadOnboardingCompletion(USER_ID);

    expect(snapshot.source).toBe("network");
    expect(snapshot.status).toBe("incomplete");
  });
});
