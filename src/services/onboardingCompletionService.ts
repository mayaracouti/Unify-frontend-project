/**
 * Estado de conclusao do onboarding: memoria -> storage -> rede.
 *
 * Por que persistir: ate aqui o cache era `let` de modulo. Em cold start
 * offline nao existia cache nenhum, entao qualquer politica "fail-closed sem
 * cache" viraria "fail-closed em todo cold start offline". Com a conclusao
 * persistida por usuario o gate consegue liberar o app offline e so mostrar a
 * tela de erro quando realmente nao sabe nada sobre o usuario.
 *
 * A chave e o `sub` do access token (UUID do usuario), estavel entre refreshes
 * — o refresh token rotaciona a cada `/auth/refresh` e invalidava o cache.
 * Nada aqui e segredo (dois booleanos), por isso vive no `bulkStorage`
 * (AsyncStorage/localStorage) e nao no SecureStore.
 */
import { getBulkItem, removeBulkItem, setBulkItem } from "../storage/bulkStorage";
import { getJwtSubject } from "../utils/jwt";
import type { ProfileCompletionResponse } from "../types/profile";
import { profileService } from "./profileService";

export type OnboardingCompletionStatus = "unknown" | "complete" | "incomplete";
export type OnboardingCompletionSource = "cache" | "network";

export type OnboardingCompletionSnapshot = {
  status: OnboardingCompletionStatus;
  /** `null` apenas quando `status === "unknown"`. */
  source: OnboardingCompletionSource | null;
  completion: ProfileCompletionResponse | null;
  fetchedAt: number | null;
  error: unknown;
};

type CachedCompletion = {
  profileCompleted: boolean;
  matchPreferencesCompleted: boolean;
  fetchedAt: number;
};

const STORAGE_KEY_PREFIX = "unify.onboarding.completion.v1.";
const STORAGE_VERSION = 1;

const UNKNOWN_SNAPSHOT: OnboardingCompletionSnapshot = {
  status: "unknown",
  source: null,
  completion: null,
  fetchedAt: null,
  error: null,
};

let cachedSessionKey: string | null = null;
let cachedCompletion: CachedCompletion | null = null;

let pendingRequest: Promise<ProfileCompletionResponse> | null = null;
let pendingRequestSessionKey: string | null = null;

const listeners = new Set<() => void>();

function createStorageKey(sessionKey: string) {
  return `${STORAGE_KEY_PREFIX}${sessionKey}`;
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Um assinante quebrado nunca pode derrubar a atualizacao dos outros.
    }
  });
}

/** Assina mudancas do cache (conclusao marcada pelo proprio app, invalidacao). */
export function subscribeToOnboardingCompletion(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function toCompletionResponse(entry: CachedCompletion): ProfileCompletionResponse {
  return {
    profileCompleted: entry.profileCompleted,
    matchPreferencesCompleted: entry.matchPreferencesCompleted,
    fullyCompleted: entry.profileCompleted && entry.matchPreferencesCompleted,
    missingProfileFields: [],
    missingMatchPreferenceFields: [],
  };
}

function toCachedCompletion(
  completion: ProfileCompletionResponse,
  fetchedAt: number
): CachedCompletion {
  return {
    profileCompleted: Boolean(completion.profileCompleted),
    matchPreferencesCompleted: Boolean(completion.matchPreferencesCompleted),
    fetchedAt,
  };
}

function toStatus(entry: CachedCompletion): OnboardingCompletionStatus {
  return entry.profileCompleted && entry.matchPreferencesCompleted
    ? "complete"
    : "incomplete";
}

function toSnapshot(
  entry: CachedCompletion,
  source: OnboardingCompletionSource
): OnboardingCompletionSnapshot {
  return {
    status: toStatus(entry),
    source,
    completion: toCompletionResponse(entry),
    fetchedAt: entry.fetchedAt,
    error: null,
  };
}

async function readPersistedCompletion(
  sessionKey: string
): Promise<CachedCompletion | null> {
  const raw = await getBulkItem(createStorageKey(sessionKey));

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CachedCompletion> & {
      version?: number;
    };

    if (
      parsed.version !== STORAGE_VERSION ||
      typeof parsed.profileCompleted !== "boolean" ||
      typeof parsed.matchPreferencesCompleted !== "boolean"
    ) {
      return null;
    }

    return {
      profileCompleted: parsed.profileCompleted,
      matchPreferencesCompleted: parsed.matchPreferencesCompleted,
      fetchedAt:
        typeof parsed.fetchedAt === "number" && Number.isFinite(parsed.fetchedAt)
          ? parsed.fetchedAt
          : 0,
    };
  } catch {
    return null;
  }
}

async function persistCompletion(sessionKey: string, entry: CachedCompletion) {
  await setBulkItem(
    createStorageKey(sessionKey),
    JSON.stringify({ version: STORAGE_VERSION, ...entry })
  );
}

function rememberInMemory(sessionKey: string, entry: CachedCompletion) {
  cachedSessionKey = sessionKey;
  cachedCompletion = entry;
}

function readFromMemory(sessionKey: string): CachedCompletion | null {
  return cachedSessionKey === sessionKey ? cachedCompletion : null;
}

/**
 * Chave de cache/particionamento: o `sub` do access token (UUID do usuario).
 */
export function createOnboardingCompletionSessionKey(
  accessToken: string | null | undefined
) {
  return getJwtSubject(accessToken);
}

/** Checagem sincrona (so memoria), usada para o estado inicial do gate. */
export function hasCompletedOnboardingForSession(
  sessionKey: string | null | undefined
) {
  if (!sessionKey) {
    return false;
  }

  const entry = readFromMemory(sessionKey);

  return Boolean(entry && toStatus(entry) === "complete");
}

async function requestCompletion(
  sessionKey: string
): Promise<ProfileCompletionResponse> {
  if (pendingRequest && pendingRequestSessionKey === sessionKey) {
    return await pendingRequest;
  }

  const request = profileService
    .getCompletion()
    .then(async (completion) => {
      const entry = toCachedCompletion(completion, Date.now());

      rememberInMemory(sessionKey, entry);
      await persistCompletion(sessionKey, entry);

      return completion;
    })
    .finally(() => {
      pendingRequest = null;
      pendingRequestSessionKey = null;
    });

  pendingRequest = request;
  pendingRequestSessionKey = sessionKey;

  return await request;
}

function revalidateInBackground(sessionKey: string, previousStatus: OnboardingCompletionStatus) {
  void requestCompletion(sessionKey)
    .then((completion) => {
      const nextStatus = toStatus(toCachedCompletion(completion, 0));

      if (nextStatus !== previousStatus) {
        notifyListeners();
      }
    })
    .catch(() => {
      // Revalidacao e best-effort: o cache (mesmo velho) continua valendo.
      // E exatamente isso que mantem o guard "pegajoso" — so uma resposta
      // autoritativa muda o estado de quem ja estava liberado.
    });
}

/**
 * Leitura tri-estado: memoria -> storage -> rede.
 *
 * - Com cache (mesmo antigo): devolve o cache e revalida em background.
 * - Sem cache e a rede falha: `unknown` (quem chama mostra erro com retry;
 *   nao redireciona nem libera).
 * - Sem cache e a rede responde: decide e persiste.
 */
export async function loadOnboardingCompletion(
  sessionKey: string,
  options?: { forceRefresh?: boolean }
): Promise<OnboardingCompletionSnapshot> {
  if (!options?.forceRefresh) {
    const memoryEntry = readFromMemory(sessionKey);

    if (memoryEntry) {
      revalidateInBackground(sessionKey, toStatus(memoryEntry));
      return toSnapshot(memoryEntry, "cache");
    }

    const persistedEntry = await readPersistedCompletion(sessionKey);

    if (persistedEntry) {
      rememberInMemory(sessionKey, persistedEntry);
      revalidateInBackground(sessionKey, toStatus(persistedEntry));
      return toSnapshot(persistedEntry, "cache");
    }
  }

  try {
    const completion = await requestCompletion(sessionKey);

    return toSnapshot(toCachedCompletion(completion, Date.now()), "network");
  } catch (error) {
    const fallbackEntry = readFromMemory(sessionKey);

    if (fallbackEntry) {
      return toSnapshot(fallbackEntry, "cache");
    }

    return { ...UNKNOWN_SNAPSHOT, error };
  }
}

/**
 * Marca (otimisticamente) uma etapa concluida pelo proprio app, sem ida a rede.
 *
 * Usado pelas telas de onboarding: invalidar e refazer a chamada aqui poderia
 * cair em `unknown` no meio do fluxo e jogar o usuario na tela de erro logo
 * depois de ele ter concluido o cadastro.
 */
export async function markOnboardingCompletionForSession(
  sessionKey: string | null | undefined,
  patch: Partial<Pick<CachedCompletion, "profileCompleted" | "matchPreferencesCompleted">>
) {
  if (!sessionKey) {
    return;
  }

  const current =
    readFromMemory(sessionKey) ??
    (await readPersistedCompletion(sessionKey)) ?? {
      profileCompleted: false,
      matchPreferencesCompleted: false,
      fetchedAt: 0,
    };

  const nextEntry: CachedCompletion = {
    profileCompleted: patch.profileCompleted ?? current.profileCompleted,
    matchPreferencesCompleted:
      patch.matchPreferencesCompleted ?? current.matchPreferencesCompleted,
    fetchedAt: Date.now(),
  };

  rememberInMemory(sessionKey, nextEntry);
  await persistCompletion(sessionKey, nextEntry);
  notifyListeners();
}

export async function getCompletionForSessionKey(sessionKey: string) {
  const snapshot = await loadOnboardingCompletion(sessionKey);

  if (!snapshot.completion) {
    throw snapshot.error ?? new Error("Nao foi possivel verificar seu cadastro.");
  }

  return snapshot.completion;
}

export async function getCompletionForActiveSession(
  accessToken: string | null | undefined
) {
  const sessionKey = createOnboardingCompletionSessionKey(accessToken);

  if (!sessionKey) {
    return null;
  }

  return await getCompletionForSessionKey(sessionKey);
}

/**
 * Limpa memoria e (quando a sessao e conhecida) a chave persistida. Chamado no
 * logout: no web o `clientStorage` ja limpa o storage inteiro, no nativo esta
 * remocao e a unica coisa que apaga a chave.
 */
export async function clearOnboardingCompletionCache(
  sessionKey?: string | null
): Promise<void> {
  cachedSessionKey = null;
  cachedCompletion = null;
  pendingRequest = null;
  pendingRequestSessionKey = null;

  if (sessionKey) {
    await removeBulkItem(createStorageKey(sessionKey));
  }

  notifyListeners();
}
