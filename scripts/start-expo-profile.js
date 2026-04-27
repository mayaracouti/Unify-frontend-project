const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SUPPORTED_PROFILES = new Set([
  "dev",
  "dev-avd-localhost",
  "homolog",
  "prod",
]);
const RESERVED_FLAGS = new Set(["--android-local", "--check", "--help"]);
const ANDROID_LOCAL_API_HOSTS = new Set(["10.0.2.2", "127.0.0.1", "localhost"]);
const DEFAULT_EXPO_PORT = 8081;
const MAX_EXPO_PORT = 8100;

function printUsage(exitCode = 0) {
  const usage = [
    "Usage: node scripts/start-expo-profile.js <profile> [--android-local] [--check] [-- <expo args>]",
    "",
    "Profiles:",
    "  dev",
    "  dev-avd-localhost",
    "  homolog",
    "  prod",
    "",
    "Examples:",
    "  node scripts/start-expo-profile.js dev",
    "  node scripts/start-expo-profile.js dev-avd-localhost --android-local",
    "  node scripts/start-expo-profile.js homolog --check",
    "  node scripts/start-expo-profile.js prod -- start --web",
  ];

  const output = usage.join("\n");

  if (exitCode === 0) {
    console.log(output);
  } else {
    console.error(output);
  }

  process.exit(exitCode);
}

function fail(message) {
  console.error(`[start-expo-profile] ${message}`);
  process.exit(1);
}

function parseArguments(argv) {
  if (argv.length === 0 || argv.includes("--help")) {
    printUsage(0);
  }

  const separatorIndex = argv.indexOf("--");
  const head = separatorIndex >= 0 ? argv.slice(0, separatorIndex) : argv;
  const tail = separatorIndex >= 0 ? argv.slice(separatorIndex + 1) : [];
  const [profile, ...rawFlags] = head;

  if (!SUPPORTED_PROFILES.has(profile)) {
    fail(
      `Unsupported profile \"${profile ?? ""}\". Use one of: ${Array.from(
        SUPPORTED_PROFILES
      ).join(", ")}.`
    );
  }

  for (const flag of rawFlags) {
    if (!RESERVED_FLAGS.has(flag)) {
      fail(`Unknown flag \"${flag}\".`);
    }
  }

  return {
    profile,
    androidLocal: rawFlags.includes("--android-local"),
    checkOnly: rawFlags.includes("--check"),
    forwardedExpoArgs: tail,
  };
}

function parseEnvValue(rawValue) {
  const value = rawValue.trim();

  if (value.length === 0) {
    return "";
  }

  const isDoubleQuoted = value.startsWith('"') && value.endsWith('"');
  const isSingleQuoted = value.startsWith("'") && value.endsWith("'");

  if (isDoubleQuoted || isSingleQuoted) {
    const unwrapped = value.slice(1, -1);

    return isDoubleQuoted
      ? unwrapped
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
      : unwrapped;
  }

  const inlineCommentIndex = value.indexOf(" #");

  return inlineCommentIndex >= 0 ? value.slice(0, inlineCommentIndex).trim() : value;
}

function parseEnvFile(content) {
  const env = {};
  const normalizedContent = content.replace(/^\uFEFF/, "");

  for (const line of normalizedContent.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const match = trimmedLine.match(
      /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/
    );

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    env[key] = parseEnvValue(rawValue);
  }

  return env;
}

function readEnvFile(filePath) {
  return parseEnvFile(fs.readFileSync(filePath, "utf8"));
}

function resolveProfileEnv(profile) {
  const baseFileName = `.env.${profile}`;
  const baseFilePath = path.join(PROJECT_ROOT, baseFileName);
  const localFilePath = path.join(PROJECT_ROOT, `${baseFileName}.local`);

  if (!fs.existsSync(baseFilePath)) {
    fail(`Missing base env file ${baseFileName}.`);
  }

  const loadedFiles = [baseFilePath];
  const env = {
    ...readEnvFile(baseFilePath),
  };

  if (fs.existsSync(localFilePath)) {
    Object.assign(env, readEnvFile(localFilePath));
    loadedFiles.push(localFilePath);
  }

  env.EXPO_PUBLIC_APP_PROFILE = profile;

  return {
    env,
    loadedFiles,
  };
}

function validateApiBaseUrl(apiBaseUrl, profile) {
  if (!apiBaseUrl) {
    fail(`Profile \"${profile}\" is missing EXPO_PUBLIC_API_BASE_URL.`);
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(apiBaseUrl);
  } catch {
    fail(`EXPO_PUBLIC_API_BASE_URL is not a valid URL: ${apiBaseUrl}`);
  }

  if (!/^https?:$/.test(parsedUrl.protocol)) {
    fail(`EXPO_PUBLIC_API_BASE_URL must use http or https: ${apiBaseUrl}`);
  }

  return parsedUrl;
}

function looksLikePlaceholderUrl(parsedUrl) {
  return parsedUrl.hostname.endsWith(".invalid");
}

function mergeNoProxy(currentValue) {
  const requiredHosts = ["localhost", "127.0.0.1", "10.0.2.2", "::1"];
  const knownHosts = new Set(
    String(currentValue ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => value.toLowerCase())
  );

  for (const host of requiredHosts) {
    knownHosts.add(host);
  }

  return Array.from(knownHosts).join(",");
}

function getEnvValueCaseInsensitive(env, key) {
  const existingKey = Object.keys(env).find(
    (candidate) => candidate.toLowerCase() === key.toLowerCase()
  );

  return existingKey ? env[existingKey] : undefined;
}

function quoteForWindowsShell(value) {
  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
}

function upsertEnvValue(env, key, value) {
  const nextEnv = { ...env };
  const existingKey = Object.keys(nextEnv).find(
    (candidate) => candidate.toLowerCase() === key.toLowerCase()
  );

  if (existingKey) {
    for (const candidate of Object.keys(nextEnv)) {
      if (candidate.toLowerCase() === key.toLowerCase() && candidate !== existingKey) {
        delete nextEnv[candidate];
      }
    }

    nextEnv[existingKey] = value;
    return nextEnv;
  }

  nextEnv[key] = value;
  return nextEnv;
}

function normalizeWindowsEnv(env, updates) {
  if (process.platform !== "win32") {
    return {
      ...env,
      ...updates,
    };
  }

  let nextEnv = { ...env };

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      continue;
    }

    nextEnv = upsertEnvValue(nextEnv, key, value);
  }

  return nextEnv;
}

function buildAndroidLocalEnv(baseEnv) {
  const localAppData = baseEnv.LOCALAPPDATA;
  const defaultAndroidHome = localAppData
    ? path.join(localAppData, "Android", "Sdk")
    : undefined;
  const androidHome =
    getEnvValueCaseInsensitive(baseEnv, "ANDROID_HOME") ||
    getEnvValueCaseInsensitive(baseEnv, "ANDROID_SDK_ROOT") ||
    defaultAndroidHome;
  const pathEntries = [];

  if (androidHome) {
    pathEntries.push(path.join(androidHome, "platform-tools"));
    pathEntries.push(path.join(androidHome, "emulator"));
  }

  const currentPath = getEnvValueCaseInsensitive(baseEnv, "PATH") || "";

  return normalizeWindowsEnv(baseEnv, {
    ...(androidHome
      ? {
          ANDROID_HOME: androidHome,
          ANDROID_SDK_ROOT: androidHome,
        }
      : {}),
    PATH: [...pathEntries, currentPath].filter(Boolean).join(path.delimiter),
    NO_PROXY: mergeNoProxy(getEnvValueCaseInsensitive(baseEnv, "NO_PROXY")),
    EXPO_NO_DEPENDENCY_VALIDATION: "1",
    EXPO_OFFLINE: "1",
  });
}

function buildExpoArgs(forwardedExpoArgs, androidLocal) {
  if (forwardedExpoArgs.length > 0) {
    return forwardedExpoArgs;
  }

  return androidLocal
    ? ["start", "--android", "--localhost", "--clear"]
    : ["start"];
}

function hasExplicitExpoPort(expoArgs) {
  return expoArgs.some((arg, index) => {
    if (arg === "--port" || arg === "-p") {
      return expoArgs[index + 1] !== undefined;
    }

    return arg.startsWith("--port=") || arg.startsWith("-p=");
  });
}

function shouldAutoAssignExpoPort(expoArgs) {
  return expoArgs[0] === "start" && !hasExplicitExpoPort(expoArgs);
}

function tryListenOnPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.unref();

    server.once("error", (error) => {
      server.close();
      reject(error);
    });

    server.listen(port, () => {
      const address = server.address();

      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(typeof address === "object" && address ? address.port : port);
      });
    });
  });
}

async function resolveAvailableExpoPort(startPort = DEFAULT_EXPO_PORT) {
  for (let port = startPort; port <= MAX_EXPO_PORT; port += 1) {
    try {
      return await tryListenOnPort(port);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "EADDRINUSE") {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    `Could not find a free Expo port between ${DEFAULT_EXPO_PORT} and ${MAX_EXPO_PORT}.`
  );
}

function getUrlPort(parsedUrl) {
  if (parsedUrl.port) {
    return parsedUrl.port;
  }

  return parsedUrl.protocol === "https:" ? "443" : "80";
}

function buildAndroidLocalApiRoutingPlan(parsedApiBaseUrl) {
  if (
    parsedApiBaseUrl.protocol !== "http:" ||
    !ANDROID_LOCAL_API_HOSTS.has(parsedApiBaseUrl.hostname)
  ) {
    return {
      effectiveApiBaseUrl: parsedApiBaseUrl.toString(),
      reversePort: null,
    };
  }

  const effectiveUrl = new URL(parsedApiBaseUrl.toString());
  effectiveUrl.hostname = "127.0.0.1";

  return {
    effectiveApiBaseUrl: effectiveUrl.toString(),
    reversePort: getUrlPort(parsedApiBaseUrl),
  };
}

function ensureAdbReverse(baseEnv, reversePort) {
  if (!reversePort) {
    return true;
  }

  const result = spawnSync("adb", ["reverse", `tcp:${reversePort}`, `tcp:${reversePort}`], {
    cwd: PROJECT_ROOT,
    env: baseEnv,
    encoding: "utf8",
  });

  if (result.error || result.status !== 0) {
    const reason = result.error?.message || result.stderr.trim() || result.stdout.trim();
    console.warn(
      `[start-expo-profile] warning: could not configure adb reverse for tcp:${reversePort}${
        reason ? ` (${reason})` : ""
      }.`
    );
    return false;
  }

  console.log(`[start-expo-profile] adb reverse: tcp:${reversePort} -> tcp:${reversePort}`);
  return true;
}

function printResolvedConfig(
  profile,
  loadedFiles,
  env,
  androidLocal,
  parsedApiBaseUrl,
  effectiveApiBaseUrl,
  metroPort
) {
  console.log(`[start-expo-profile] profile: ${profile}`);
  console.log(
    `[start-expo-profile] env files: ${loadedFiles
      .map((filePath) => path.relative(PROJECT_ROOT, filePath))
      .join(", ")}`
  );
  console.log(`[start-expo-profile] api base url: ${env.EXPO_PUBLIC_API_BASE_URL}`);

  if (effectiveApiBaseUrl !== env.EXPO_PUBLIC_API_BASE_URL) {
    console.log(`[start-expo-profile] effective api base url: ${effectiveApiBaseUrl}`);
  }

  console.log(
    `[start-expo-profile] mode: ${androidLocal ? "android-local" : "standard"}`
  );

  if (typeof metroPort === "number") {
    console.log(`[start-expo-profile] metro port: ${metroPort}`);
  }

  if (looksLikePlaceholderUrl(parsedApiBaseUrl)) {
    console.warn(
      `[start-expo-profile] warning: ${env.EXPO_PUBLIC_API_BASE_URL} is still using the tracked placeholder domain. Add a .local override before using this profile against a real backend.`
    );
  }
}

async function main() {
  const { profile, androidLocal, checkOnly, forwardedExpoArgs } = parseArguments(
    process.argv.slice(2)
  );
  const { env: profileEnv, loadedFiles } = resolveProfileEnv(profile);
  const parsedApiBaseUrl = validateApiBaseUrl(
    profileEnv.EXPO_PUBLIC_API_BASE_URL,
    profile
  );

  let launchEnv = {
    ...process.env,
    ...profileEnv,
  };

  if (androidLocal) {
    launchEnv = buildAndroidLocalEnv(launchEnv);
  }

  let effectiveApiBaseUrl = profileEnv.EXPO_PUBLIC_API_BASE_URL;

  if (androidLocal) {
    const routingPlan = buildAndroidLocalApiRoutingPlan(parsedApiBaseUrl);

    if (routingPlan.effectiveApiBaseUrl !== profileEnv.EXPO_PUBLIC_API_BASE_URL) {
      effectiveApiBaseUrl = routingPlan.effectiveApiBaseUrl;

      if (!checkOnly && ensureAdbReverse(launchEnv, routingPlan.reversePort)) {
        launchEnv = normalizeWindowsEnv(launchEnv, {
          EXPO_PUBLIC_API_BASE_URL: effectiveApiBaseUrl,
        });
      }
    }
  }

  let expoArgs = buildExpoArgs(forwardedExpoArgs, androidLocal);
  let metroPort;

  if (!checkOnly && shouldAutoAssignExpoPort(expoArgs)) {
    metroPort = await resolveAvailableExpoPort();
    expoArgs = [...expoArgs, "--port", String(metroPort)];
  }

  printResolvedConfig(
    profile,
    loadedFiles,
    profileEnv,
    androidLocal,
    parsedApiBaseUrl,
    effectiveApiBaseUrl,
    metroPort
  );

  if (checkOnly) {
    return;
  }

  const child =
    process.platform === "win32"
      ? spawn(
          process.env.ComSpec || "cmd.exe",
          [
            "/d",
            "/s",
            "/c",
            quoteForWindowsShell("npx.cmd"),
            "expo",
            ...expoArgs.map(quoteForWindowsShell),
          ],
          {
            cwd: PROJECT_ROOT,
            env: launchEnv,
            stdio: "inherit",
          }
        )
      : spawn("npx", ["expo", ...expoArgs], {
          cwd: PROJECT_ROOT,
          env: launchEnv,
          stdio: "inherit",
        });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });

  child.on("error", (error) => {
    fail(`Could not start Expo: ${error.message}`);
  });
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});