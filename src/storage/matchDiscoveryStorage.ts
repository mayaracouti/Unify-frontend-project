import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { getBulkItem, removeBulkItem, setBulkItem } from "./bulkStorage";

/**
 * v2: o escopo passou a ser o `sub` do access token (UUID do usuario) em vez
 * de um hash de 32 bits do refresh token (que rotacionava a cada refresh e
 * ainda tinha colisao plausivel entre usuarios). O prefixo mudou junto para
 * que as chaves da v1 nao sejam lidas com a semantica nova; elas sao apagadas
 * uma unica vez, na primeira leitura/escrita.
 */
const MATCH_DISCOVERY_STORAGE_KEY_PREFIX = "unify.matches.discovery.v2";
const LEGACY_STORAGE_KEY_PREFIX = "unify.matches.discovery";
const MATCH_DISCOVERY_SCOPE_INDEX_KEY = `${MATCH_DISCOVERY_STORAGE_KEY_PREFIX}.__scopes__`;
const LEGACY_SCOPE_INDEX_KEY = `${LEGACY_STORAGE_KEY_PREFIX}.__scopes__`;

/**
 * Cap mantido em 500. Com o escopo estavel a lista realmente acumula (~19 KB
 * em JSON), por isso este estado saiu do SecureStore (limite de 2048 bytes) e
 * foi para o `bulkStorage` (AsyncStorage no nativo, localStorage no web).
 */
const MAX_SEEN_PROFILE_IDS = 500;

type MatchDiscoveryStorageListener = (
  scopeId: string,
  state: StoredMatchDiscoveryState
) => void;

const listeners = new Set<MatchDiscoveryStorageListener>();

export type StoredMatchDiscoveryState = {
  queuedProfileIds: string[];
  seenProfileIds: string[];
  sessionDate: string;
};

const webStorageFallback = (() => {
  if (Platform.OS !== "web") {
    return null;
  }

  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
})();

function createSessionDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeProfileIds(profileIds: string[] | null | undefined) {
  const uniqueProfileIds = new Set<string>();

  for (const profileId of profileIds ?? []) {
    const normalizedProfileId = profileId?.trim();

    if (!normalizedProfileId) {
      continue;
    }

    uniqueProfileIds.add(normalizedProfileId);
  }

  return Array.from(uniqueProfileIds);
}

function normalizeStoredState(
  state: Partial<StoredMatchDiscoveryState> | null | undefined
): StoredMatchDiscoveryState {
  return {
    queuedProfileIds: normalizeProfileIds(state?.queuedProfileIds),
    seenProfileIds: normalizeProfileIds(state?.seenProfileIds).slice(-MAX_SEEN_PROFILE_IDS),
    sessionDate:
      typeof state?.sessionDate === "string" && state.sessionDate.trim().length > 0
        ? state.sessionDate.trim()
        : createSessionDate(),
  };
}

function createStorageKey(scopeId: string) {
  return `${MATCH_DISCOVERY_STORAGE_KEY_PREFIX}.${scopeId}`;
}

async function getStoredValue(key: string): Promise<string | null> {
  return getBulkItem(key);
}

async function setStoredValue(key: string, value: string): Promise<void> {
  await setBulkItem(key, value);
}

async function deleteStoredValue(key: string): Promise<void> {
  await removeBulkItem(key);
}

/**
 * Limpeza unica das chaves da v1, que viviam no SecureStore (nativo) ou no
 * `localStorage` (web). Sem isso os escopos orfaos acumulados a cada rotacao
 * de refresh token ficariam la para sempre.
 */
let legacyPurge: Promise<void> | null = null;

async function readLegacyValue(key: string): Promise<string | null> {
  try {
    if (webStorageFallback) {
      return webStorageFallback.getItem(key);
    }

    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function deleteLegacyValue(key: string): Promise<void> {
  try {
    if (webStorageFallback) {
      webStorageFallback.removeItem(key);
      return;
    }

    await SecureStore.deleteItemAsync(key);
  } catch {
    // Melhor deixar a chave orfa do que quebrar a leitura do estado atual.
  }
}

function purgeLegacyMatchDiscoveryState(): Promise<void> {
  if (!legacyPurge) {
    legacyPurge = (async () => {
      const storedIndex = await readLegacyValue(LEGACY_SCOPE_INDEX_KEY);

      if (storedIndex) {
        let legacyScopeIds: string[] = [];

        try {
          legacyScopeIds = normalizeProfileIds(JSON.parse(storedIndex) as string[]);
        } catch {
          legacyScopeIds = [];
        }

        await Promise.all(
          legacyScopeIds.map((scopeId) =>
            deleteLegacyValue(`${LEGACY_STORAGE_KEY_PREFIX}.${scopeId}`)
          )
        );
      }

      await deleteLegacyValue(LEGACY_SCOPE_INDEX_KEY);
    })();
  }

  return legacyPurge;
}

async function getRegisteredScopeIds() {
  const storedValue = await getStoredValue(MATCH_DISCOVERY_SCOPE_INDEX_KEY);

  if (!storedValue) {
    return [] as string[];
  }

  try {
    return normalizeProfileIds(JSON.parse(storedValue) as string[]);
  } catch {
    return [] as string[];
  }
}

async function saveRegisteredScopeIds(scopeIds: string[]) {
  const normalizedScopeIds = normalizeProfileIds(scopeIds);

  if (normalizedScopeIds.length === 0) {
    await deleteStoredValue(MATCH_DISCOVERY_SCOPE_INDEX_KEY);
    return;
  }

  await setStoredValue(MATCH_DISCOVERY_SCOPE_INDEX_KEY, JSON.stringify(normalizedScopeIds));
}

async function registerScopeId(scopeId: string) {
  const normalizedScopeId = scopeId.trim();

  if (!normalizedScopeId) {
    return;
  }

  const registeredScopeIds = await getRegisteredScopeIds();

  if (registeredScopeIds.includes(normalizedScopeId)) {
    return;
  }

  await saveRegisteredScopeIds([...registeredScopeIds, normalizedScopeId]);
}

async function unregisterScopeId(scopeId: string) {
  const normalizedScopeId = scopeId.trim();

  if (!normalizedScopeId) {
    return;
  }

  const registeredScopeIds = await getRegisteredScopeIds();

  await saveRegisteredScopeIds(
    registeredScopeIds.filter((registeredScopeId) => registeredScopeId !== normalizedScopeId)
  );
}

function notifyListeners(scopeId: string, state: StoredMatchDiscoveryState) {
  const nextState = normalizeStoredState(state);

  listeners.forEach((listener) => {
    try {
      listener(scopeId, nextState);
    } catch {
      // Ignore listener errors so discovery state updates keep flowing.
    }
  });
}

export function createEmptyMatchDiscoveryState(): StoredMatchDiscoveryState {
  return {
    queuedProfileIds: [],
    seenProfileIds: [],
    sessionDate: createSessionDate(),
  };
}

export async function getStoredMatchDiscoveryState(
  scopeId: string
): Promise<StoredMatchDiscoveryState> {
  await purgeLegacyMatchDiscoveryState();

  const storedValue = await getStoredValue(createStorageKey(scopeId));

  if (!storedValue) {
    return createEmptyMatchDiscoveryState();
  }

  try {
    const parsedValue = JSON.parse(storedValue) as Partial<StoredMatchDiscoveryState>;
    const normalizedState = normalizeStoredState(parsedValue);

    if (normalizedState.sessionDate !== createSessionDate()) {
      return createEmptyMatchDiscoveryState();
    }

    return normalizedState;
  } catch {
    return createEmptyMatchDiscoveryState();
  }
}

export async function saveStoredMatchDiscoveryState(
  scopeId: string,
  state: StoredMatchDiscoveryState
): Promise<void> {
  await purgeLegacyMatchDiscoveryState();

  const normalizedState = normalizeStoredState(state);

  await setStoredValue(
    createStorageKey(scopeId),
    JSON.stringify(normalizedState)
  );

  await registerScopeId(scopeId);
  notifyListeners(scopeId, normalizedState);
}

export async function clearStoredMatchDiscoveryState(scopeId: string): Promise<void> {
  await deleteStoredValue(createStorageKey(scopeId));
  await unregisterScopeId(scopeId);
  notifyListeners(scopeId, createEmptyMatchDiscoveryState());
}

export async function clearAllStoredMatchDiscoveryState(): Promise<void> {
  const scopeIds = await getRegisteredScopeIds();

  await Promise.all(
    scopeIds.map((scopeId) => deleteStoredValue(createStorageKey(scopeId)))
  );

  await deleteStoredValue(MATCH_DISCOVERY_SCOPE_INDEX_KEY);
  await purgeLegacyMatchDiscoveryState();
}

export function subscribeToMatchDiscoveryStorage(
  listener: MatchDiscoveryStorageListener
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
