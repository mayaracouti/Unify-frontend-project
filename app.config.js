const appJson = require("./app.json");

const HTTP_CLEAR_TEXT_PROFILES = new Set(["dev", "dev-avd-localhost"]);

function readTrimmedEnv(name) {
  const value = process.env[name];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function shouldAllowAndroidCleartextTraffic(appProfile, apiBaseUrl) {
  if (typeof apiBaseUrl === "string" && apiBaseUrl.startsWith("http://")) {
    return true;
  }

  return HTTP_CLEAR_TEXT_PROFILES.has(appProfile);
}

module.exports = () => {
  const expoConfig = appJson.expo;
  const appProfile = readTrimmedEnv("EXPO_PUBLIC_APP_PROFILE") ?? "dev";
  const apiBaseUrl = readTrimmedEnv("EXPO_PUBLIC_API_BASE_URL");
  const usesCleartextTraffic = shouldAllowAndroidCleartextTraffic(
    appProfile,
    apiBaseUrl
  );

  return {
    ...expoConfig,
    android: {
      ...(expoConfig.android ?? {}),
      usesCleartextTraffic,
    },
    extra: {
      ...(expoConfig.extra ?? {}),
      appProfile,
      ...(apiBaseUrl ? { apiBaseUrl } : {}),
    },
  };
};