import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Linking } from "react-native";

import { joinSpeechParts, speak } from "../accessibility/tts";
import { notificationService } from "../services/notificationService";
import {
  addPushTokenRotationListener,
  claimAutoPushPermissionPrompt,
  configureNotificationPresentation,
  getPushPermissionStatus,
  isDataOnlyRemotePush,
  isRemotePushSupported,
  loadNotifications,
  presentForegroundPush,
  type PushPermissionStatus,
  shouldPresentNotification,
  syncPushRegistration,
} from "../utils/pushNotifications";
import { useAppShell } from "./AppShellContext";
import { useAuth } from "./AuthContext";

type NotificationContextValue = {
  /** Nao lidas visiveis (o backend ja esconde as de pessoas bloqueadas). */
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  /** Ajuste otimista apos marcar como lida(s), antes do refresh confirmar. */
  adjustUnreadCount: (delta: number | "reset") => void;
  /** Estado da permissao de push neste aparelho ("unsupported" no Expo Go/web/iOS). */
  pushPermission: PushPermissionStatus;
  /**
   * Pede a permissao (ou abre os ajustes do sistema quando ja foi negada de
   * vez) e registra o token. `true` quando o push ficou ativo.
   */
  enablePush: () => Promise<boolean>;
};

/** Badge do sino: polling lento, mesmo ritmo do badge de conversas. */
const UNREAD_POLL_INTERVAL_MS = 60000;

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

// Handler de apresentacao com o app aberto: configurado uma vez, no import.
configureNotificationPresentation();

export function NotificationProvider({ children }: PropsWithChildren) {
  const { isAuthenticated, isReady, userId } = useAuth();
  // Perfil carregado = onboarding concluido: so a partir dai o app pede a
  // permissao de push (nunca no meio do cadastro).
  const { currentUserProfileId } = useAppShell();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushPermission, setPushPermission] = useState<PushPermissionStatus>(
    isRemotePushSupported() ? "undetermined" : "unsupported"
  );
  const requestRef = useRef(0);
  const userIdRef = useRef(userId);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const isActiveSession = isReady && isAuthenticated && Boolean(userId);

  const refreshUnreadCount = useCallback(async () => {
    if (!isActiveSession) {
      setUnreadCount(0);
      return;
    }

    const requestId = ++requestRef.current;

    try {
      const response = await notificationService.getUnreadCount();

      if (requestId === requestRef.current) {
        setUnreadCount(Math.max(0, response.unreadCount ?? 0));
      }
    } catch {
      // Silencioso: mantem o ultimo valor (badge e informacao secundaria).
    }
  }, [isActiveSession]);

  const adjustUnreadCount = useCallback((delta: number | "reset") => {
    // Invalida respostas em voo para nao "voltar" um numero antigo.
    requestRef.current += 1;
    setUnreadCount((current) => (delta === "reset" ? 0 : Math.max(0, current + delta)));
  }, []);

  // Badge: carrega ao entrar, a cada minuto com o app ativo e ao voltar ao app.
  useEffect(() => {
    if (!isActiveSession) {
      setUnreadCount(0);
      return;
    }

    void refreshUnreadCount();

    const intervalId = setInterval(() => {
      if (AppState.currentState === "active") {
        void refreshUnreadCount();
      }
    }, UNREAD_POLL_INTERVAL_MS);

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshUnreadCount();
        void getPushPermissionStatus().then(setPushPermission).catch(() => undefined);
      }
    });

    return () => {
      clearInterval(intervalId);
      appStateSubscription.remove();
    };
  }, [isActiveSession, refreshUnreadCount]);

  // Registro do token: uma vez por sessao, depois do onboarding. O app abre o
  // dialogo do sistema sozinho so na primeira vez neste aparelho; depois de
  // uma recusa, a tela de notificacoes oferece o atalho "Ativar notificacoes".
  useEffect(() => {
    if (!isActiveSession || !currentUserProfileId || !userId || !isRemotePushSupported()) {
      return;
    }

    let active = true;

    void (async () => {
      const askPermission = await claimAutoPushPermissionPrompt().catch(() => false);
      await syncPushRegistration(userId, { askPermission });
      const after = await getPushPermissionStatus().catch(() => "denied" as const);

      if (active) {
        setPushPermission(after);
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUserProfileId, isActiveSession, userId]);

  // Token rotacionado pelo Google: reenviado ao backend.
  useEffect(() => {
    if (!isActiveSession) {
      return;
    }

    const subscription = addPushTokenRotationListener((token) => {
      const currentUserId = userIdRef.current;

      if (currentUserId) {
        void syncPushRegistration(currentUserId, { askPermission: false, forceToken: token });
      }
    });

    return () => subscription.remove();
  }, [isActiveSession]);

  // Push recebido com o app ABERTO: vira banner nativo (copia local, ver
  // `presentForegroundPush`) que o TalkBack anuncia; quem usa a leitura por voz
  // in-app ouve pelo TTS. O badge atualiza na hora.
  useEffect(() => {
    const Notifications = isActiveSession ? loadNotifications() : null;

    if (!Notifications) {
      return;
    }

    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      // A copia local do banner tambem passa por aqui: so o push original conta.
      if (!isDataOnlyRemotePush(notification)) {
        return;
      }

      void refreshUnreadCount();

      const content = notification.request.content;

      if (shouldPresentNotification(content.data as Record<string, unknown> | undefined)) {
        speak(joinSpeechParts(["Nova notificação", content.title, content.body]));
        void presentForegroundPush(notification).catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, [isActiveSession, refreshUnreadCount]);

  const enablePush = useCallback(async () => {
    if (!isRemotePushSupported() || !userIdRef.current) {
      return false;
    }

    const current = await getPushPermissionStatus().catch(() => "undetermined" as const);

    if (current === "denied") {
      const canAskAgain = (await loadNotifications()?.getPermissionsAsync().catch(() => null))?.canAskAgain;

      if (!canAskAgain) {
        await Linking.openSettings().catch(() => undefined);
        return false;
      }
    }

    const registered = await syncPushRegistration(userIdRef.current, { askPermission: true });
    setPushPermission(await getPushPermissionStatus().catch(() => current));
    return registered;
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({ unreadCount, refreshUnreadCount, adjustUnreadCount, pushPermission, enablePush }),
    [adjustUnreadCount, enablePush, pushPermission, refreshUnreadCount, unreadCount]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider.");
  }

  return context;
}
