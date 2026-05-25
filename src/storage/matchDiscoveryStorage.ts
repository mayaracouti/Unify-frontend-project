import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const MATCH_DISCOVERY_STORAGE_KEY_PREFIX = "unify.matches.discovery";
const MATCH_DISCOVERY_SCOPE_INDEX_KEY = `${MATCH_DISCOVERY_STORAGE_KEY_PREFIX}.__scopes__`;
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

export function createMatchDiscoveryScopeId(seed: string | null | undefined) {
  const normalizedSeed = seed?.trim() || "anonymous";
  let hash = 0;

  for (let index = 0; index < normalizedSeed.length; index += 1) {
    hash = (hash * 31 + normalizedSeed.charCodeAt(index)) | 0;
  }

  return `session-${Math.abs(hash)}`;
}

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
  if (webStorageFallback) {
    return webStorageFallback.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

async function setStoredValue(key: string, value: string): Promise<void> {
  if (webStorageFallback) {
    webStorageFallback.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function deleteStoredValue(key: string): Promise<void> {
  if (webStorageFallback) {
    webStorageFallback.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
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
}

export function subscribeToMatchDiscoveryStorage(
  listener: MatchDiscoveryStorageListener
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}