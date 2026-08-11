import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { setGlobalTextAdjustments } from "../accessibility/global-text-adjustments";
import { ScreenReaderAnnouncer } from "../accessibility/ScreenReaderAnnouncer";
import { accessibilityService } from "../services/accessibilityService";
import {
  clearCachedAccessibilitySettings,
  getCachedAccessibilitySettings,
  saveCachedAccessibilitySettings,
} from "../storage/accessibilitySettingsStorage";
import type {
  UserAccessibilitySettingsResponse,
  UserAccessibilitySettingsUpsertRequest,
} from "../types/accessibility";
import { useAuth } from "./AuthContext";

const DEFAULT_SETTINGS: UserAccessibilitySettingsResponse = {
  fontScale: "MEDIUM",
  fontScaleMultiplier: 1,
  highContrast: false,
  screenReaderOptimized: false,
  reduceMotion: false,
};

type AccessibilityContextValue = {
  settings: UserAccessibilitySettingsResponse;
  isLoading: boolean;
  updateSettings: (
    patch: Partial<UserAccessibilitySettingsUpsertRequest>
  ) => Promise<void>;
};

const AccessibilityContext = createContext<AccessibilityContextValue | undefined>(
  undefined
);

export function AccessibilityProvider({ children }: PropsWithChildren) {
  const { isAuthenticated, isReady } = useAuth();
  const [settings, setSettings] =
    useState<UserAccessibilitySettingsResponse>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      const cached = await getCachedAccessibilitySettings();

      if (active && cached) {
        setSettings(cached);
      }

      if (!isReady) {
        return;
      }

      if (!isAuthenticated) {
        if (active) {
          setSettings(DEFAULT_SETTINGS);
          setIsLoading(false);
        }
        await clearCachedAccessibilitySettings();
        return;
      }

      try {
        const remoteSettings = await accessibilityService.getSettings();

        if (!active) {
          return;
        }

        setSettings(remoteSettings);
        await saveCachedAccessibilitySettings(remoteSettings);
      } catch {
        // Mantem o cache local (ou os defaults) se a rede falhar.
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void hydrate();

    return () => {
      active = false;
    };
  }, [isAuthenticated, isReady]);

  // Alimenta o singleton global consumido pelo patch de `Text`/`TextInput`,
  // pelo leitor de tela e pelos componentes animados. Cobre tanto a hidratacao
  // do cache local (cold start) quanto as alteracoes feitas pelo usuario.
  useEffect(() => {
    setGlobalTextAdjustments({
      fontScaleMultiplier: settings.fontScaleMultiplier,
      highContrast: settings.highContrast,
      screenReaderOptimized: settings.screenReaderOptimized,
      reduceMotion: settings.reduceMotion,
    });
  }, [settings]);

  const updateSettings = useCallback(
    async (patch: Partial<UserAccessibilitySettingsUpsertRequest>) => {
      const nextRequest: UserAccessibilitySettingsUpsertRequest = {
        fontScale: patch.fontScale ?? settings.fontScale,
        highContrast: patch.highContrast ?? settings.highContrast,
        screenReaderOptimized:
          patch.screenReaderOptimized ?? settings.screenReaderOptimized,
        reduceMotion: patch.reduceMotion ?? settings.reduceMotion,
      };

      const updated = await accessibilityService.saveSettings(nextRequest);
      setSettings(updated);
      await saveCachedAccessibilitySettings(updated);
    },
    [settings]
  );

  const value = useMemo<AccessibilityContextValue>(
    () => ({ settings, isLoading, updateSettings }),
    [settings, isLoading, updateSettings]
  );

  return (
    <AccessibilityContext.Provider value={value}>
      <ScreenReaderAnnouncer />
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);

  if (!context) {
    throw new Error("useAccessibility must be used within an AccessibilityProvider.");
  }

  return context;
}
