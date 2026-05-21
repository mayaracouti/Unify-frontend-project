import Constants from "expo-constants";
import { Platform } from "react-native";

const APP_PROFILES = ["dev", "dev-avd-localhost", "homolog", "prod"] as const;

export type AppProfile = (typeof APP_PROFILES)[number];

export type RuntimeConfig = {
  profile: AppProfile;
  apiBaseUrl: string;
  useMocks: boolean;
};

type RuntimeExtra = {
  appProfile?: string;
  apiBaseUrl?: string;
  useMocks?: boolean | string;
};

function readProcessEnv(
  name:
    | "EXPO_PUBLIC_API_BASE_URL"
    | "EXPO_PUBLIC_APP_PROFILE"
    | "EXPO_PUBLIC_USE_MOCKS"
) {
  const value = (
    globalThis as {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process?.env?.[name];

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseBooleanFlag(value: boolean | string | null | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function readRuntimeExtra(): RuntimeExtra {
  const maybeExtra = Constants.expoConfig?.extra;

  if (!maybeExtra || typeof maybeExtra !== "object") {
    return {};
  }

  const extra = maybeExtra as RuntimeExtra;

  return {
    appProfile:
      typeof extra.appProfile === "string" && extra.appProfile.trim().length > 0
        ? extra.appProfile.trim()
        : undefined,
    apiBaseUrl:
      typeof extra.apiBaseUrl === "string" && extra.apiBaseUrl.trim().length > 0
        ? extra.apiBaseUrl.trim()
        : undefined,
    useMocks: extra.useMocks,
  };
}

function isAppProfile(value: string | null | undefined): value is AppProfile {
  return Boolean(value) && APP_PROFILES.includes(value as AppProfile);
}

function resolveWebLocalBaseUrl(): string {
  if (typeof window !== "undefined" && window.location) {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }

  return "http://localhost:8080";
}

function resolveDefaultApiBaseUrl(profile: AppProfile): string {
  if (profile === "dev-avd-localhost") {
    return "http://10.0.2.2:8080";
  }

  if (Platform.OS === "web") {
    return resolveWebLocalBaseUrl();
  }

  return "http://localhost:8080";
}

function resolveAppProfile(): AppProfile {
  const envProfile = readProcessEnv("EXPO_PUBLIC_APP_PROFILE");

  if (isAppProfile(envProfile)) {
    return envProfile;
  }

  const { appProfile } = readRuntimeExtra();

  if (isAppProfile(appProfile)) {
    return appProfile;
  }

  return "dev";
}

function resolveApiBaseUrl(profile: AppProfile): string {
  const envApiBaseUrl = readProcessEnv("EXPO_PUBLIC_API_BASE_URL");

  if (envApiBaseUrl) {
    return envApiBaseUrl;
  }

  const { apiBaseUrl } = readRuntimeExtra();

  if (apiBaseUrl) {
    return apiBaseUrl;
  }

  return resolveDefaultApiBaseUrl(profile);
}

function resolveUseMocks(): boolean {
  const envUseMocks = readProcessEnv("EXPO_PUBLIC_USE_MOCKS");

  if (envUseMocks) {
    return parseBooleanFlag(envUseMocks);
  }

  const { useMocks } = readRuntimeExtra();

  return parseBooleanFlag(useMocks);
}

export const runtimeConfig: RuntimeConfig = (() => {
  const profile = resolveAppProfile();

  return {
    profile,
    apiBaseUrl: resolveApiBaseUrl(profile),
    useMocks: resolveUseMocks(),
  };
})();
