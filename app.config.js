const fs = require("node:fs");
const path = require("node:path");

const appJson = require("./app.json");

const HTTP_CLEAR_TEXT_PROFILES = new Set(["dev", "dev-avd-localhost"]);

function readTrimmedEnv(name) {
  const value = process.env[name];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

/**
 * `google-services.json` (Firebase → Configuracoes do projeto → app Android
 * `br.com.app.unify`) liga o FCM no build nativo. Fica opcional: sem ele o
 * app continua buildando e rodando (Expo Go, web, dev build sem push) e so o
 * registro do token de push falha. `GOOGLE_SERVICES_JSON` permite apontar
 * para outro arquivo (ex.: segredo de arquivo do EAS).
 */
function resolveGoogleServicesFile() {
  const configuredPath = readTrimmedEnv("GOOGLE_SERVICES_JSON") ?? "./google-services.json";
  const absolutePath = path.resolve(__dirname, configuredPath);

  return fs.existsSync(absolutePath) ? configuredPath : undefined;
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
  const googleServicesFile = resolveGoogleServicesFile();

  return {
    ...expoConfig,
    android: {
      ...(expoConfig.android ?? {}),
      usesCleartextTraffic,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    extra: {
      ...(expoConfig.extra ?? {}),
      appProfile,
      ...(apiBaseUrl ? { apiBaseUrl } : {}),
    },
  };
};