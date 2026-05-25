import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { AuthSession, StoredAuthSnapshot } from "../types/auth";

const ACCESS_TOKEN_KEY = "unify.auth.accessToken";
const REFRESH_TOKEN_KEY = "unify.auth.refreshToken";
const ACCESS_TOKEN_EXPIRES_AT_KEY = "unify.auth.accessTokenExpiresAt";
const PENDING_VERIFICATION_EMAIL_KEY = "unify.auth.pendingVerificationEmail";
const AUTH_STORAGE_KEYS = [
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  ACCESS_TOKEN_EXPIRES_AT_KEY,
  PENDING_VERIFICATION_EMAIL_KEY,
];

type AuthStorageListener = (snapshot: StoredAuthSnapshot) => void;

const listeners = new Set<AuthStorageListener>();

let cachedSnapshot: StoredAuthSnapshot | null = null;

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

function cloneSnapshot(snapshot: StoredAuthSnapshot): StoredAuthSnapshot {
  return {
    session: snapshot.session ? { ...snapshot.session } : null,
    pendingVerificationEmail: snapshot.pendingVerificationEmail,
  };
}

async function readSnapshotFromStorage(): Promise<StoredAuthSnapshot> {
  const [accessToken, refreshToken, expiresAtValue, pendingVerificationEmail] =
    await Promise.all([
      getStoredValue(ACCESS_TOKEN_KEY),
      getStoredValue(REFRESH_TOKEN_KEY),
      getStoredValue(ACCESS_TOKEN_EXPIRES_AT_KEY),
      getStoredValue(PENDING_VERIFICATION_EMAIL_KEY),
    ]);

  const expiresAt = expiresAtValue ? Number(expiresAtValue) : Number.NaN;

  return {
    session:
      accessToken &&
      refreshToken &&
      Number.isFinite(expiresAt) &&
      expiresAt > 0
        ? {
            accessToken,
            refreshToken,
            accessTokenExpiresAt: expiresAt,
          }
        : null,
    pendingVerificationEmail: pendingVerificationEmail?.trim() || null,
  };
}

async function ensureSnapshot(): Promise<StoredAuthSnapshot> {
  if (webStorageFallback) {
    cachedSnapshot = await readSnapshotFromStorage();
    return cachedSnapshot;
  }

  if (!cachedSnapshot) {
    cachedSnapshot = await readSnapshotFromStorage();
  }

  return cachedSnapshot;
}

function notifyListeners(snapshot: StoredAuthSnapshot) {
  const nextSnapshot = cloneSnapshot(snapshot);

  listeners.forEach((listener) => {
    try {
      listener(nextSnapshot);
    } catch {
      // Ignore listener errors so auth storage updates keep flowing.
    }
  });
}

export async function getAuthSnapshot(): Promise<StoredAuthSnapshot> {
  const snapshot = await ensureSnapshot();
  return cloneSnapshot(snapshot);
}

export async function getToken(): Promise<string | null> {
  const snapshot = await getAuthSnapshot();
  return snapshot.session?.accessToken ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  const snapshot = await getAuthSnapshot();
  return snapshot.session?.refreshToken ?? null;
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  await Promise.all([
    setStoredValue(ACCESS_TOKEN_KEY, session.accessToken),
    setStoredValue(REFRESH_TOKEN_KEY, session.refreshToken),
    setStoredValue(ACCESS_TOKEN_EXPIRES_AT_KEY, session.accessTokenExpiresAt.toString()),
  ]);

  const snapshot = await ensureSnapshot();

  cachedSnapshot = {
    ...snapshot,
    session: { ...session },
  };

  notifyListeners(cachedSnapshot);
}

export async function clearAuthSession(): Promise<void> {
  await Promise.all([
    deleteStoredValue(ACCESS_TOKEN_KEY),
    deleteStoredValue(REFRESH_TOKEN_KEY),
    deleteStoredValue(ACCESS_TOKEN_EXPIRES_AT_KEY),
  ]);

  const snapshot = await ensureSnapshot();

  cachedSnapshot = {
    ...snapshot,
    session: null,
  };

  notifyListeners(cachedSnapshot);
}

export async function setPendingVerificationEmail(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  await setStoredValue(PENDING_VERIFICATION_EMAIL_KEY, normalizedEmail);

  const snapshot = await ensureSnapshot();

  cachedSnapshot = {
    ...snapshot,
    pendingVerificationEmail: normalizedEmail,
  };

  notifyListeners(cachedSnapshot);
}

export async function clearPendingVerificationEmail(): Promise<void> {
  await deleteStoredValue(PENDING_VERIFICATION_EMAIL_KEY);

  const snapshot = await ensureSnapshot();

  cachedSnapshot = {
    ...snapshot,
    pendingVerificationEmail: null,
  };

  notifyListeners(cachedSnapshot);
}

export async function clearAllStoredAuthData(options?: {
  clearEntireWebStorage?: boolean;
}): Promise<void> {
  if (webStorageFallback && options?.clearEntireWebStorage) {
    webStorageFallback.clear();
  } else {
    await Promise.all(AUTH_STORAGE_KEYS.map((key) => deleteStoredValue(key)));
  }

  cachedSnapshot = {
    session: null,
    pendingVerificationEmail: null,
  };

  notifyListeners(cachedSnapshot);
}

export function subscribeToAuthStorage(listener: AuthStorageListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}