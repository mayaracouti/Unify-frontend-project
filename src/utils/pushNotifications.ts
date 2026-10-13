/**
 * Push (Firebase Cloud Messaging) do lado do app.
 *
 * - O backend envia DIRETO ao FCM (sem o servico de push do Expo), entao o
 *   token registrado e o NATIVO do aparelho (`getDevicePushTokenAsync`), nao
 *   um ExpoPushToken.
 * - Mensagens chegam como "data-only" (title/message/body/channelId/tag): o
 *   `expo-notifications` monta a notificacao com o app aberto, em segundo
 *   plano ou fechado, e o toque cai em `addNotificationResponseReceivedListener`.
 * - Push remoto NAO existe no Expo Go desde o SDK 53 nem no web: la tudo aqui
 *   vira no-op e o app segue com as notificacoes in-app (sino).
 * - iOS fica de fora por enquanto: o token nativo do iOS e de APNs, nao FCM
 *   (exigiria conta Apple Developer + chave APNs no Firebase).
 */
import { isRunningInExpoGo } from "expo";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { notificationService } from "../services/notificationService";
import {
  clearPushRegistration,
  getPushRegistration,
  hasAutoPromptedPushPermission,
  markPushPermissionAutoPrompted,
  savePushRegistration,
} from "../storage/pushRegistrationStorage";

/** Mesmo id que o backend manda em `data.channelId` e o plugin usa como padrao. */
export const DEFAULT_NOTIFICATION_CHANNEL_ID = "default";

export type PushPermissionStatus = "granted" | "denied" | "undetermined" | "unsupported";

/** Push remoto so existe em build nativo Android fora do Expo Go. */
export function isRemotePushSupported(): boolean {
  return Platform.OS === "android" && !isRunningInExpoGo();
}

// ---------------------------------------------------------------------------
// Apresentacao com o app aberto
// ---------------------------------------------------------------------------

/**
 * Conversa aberta agora (tela de chat em foco). Push de mensagem dessa
 * conversa nao vira banner: a mensagem ja aparece na tela e o TalkBack/TTS
 * da propria conversa anuncia.
 */
let activeConversationId: string | null = null;

export function setActiveConversationId(conversationId: string | null) {
  activeConversationId = conversationId;
}

export function shouldPresentNotification(data: Record<string, unknown> | null | undefined): boolean {
  if (!data) {
    return true;
  }

  return !(
    data.type === "NEW_MESSAGE" &&
    typeof data.referenceId === "string" &&
    data.referenceId === activeConversationId
  );
}

/**
 * Push do FCM so com `data` (o formato que o backend manda). A copia local
 * criada por `presentForegroundPush` nao conta (gatilho de canal, nao "push").
 */
export function isDataOnlyRemotePush(notification: Notifications.Notification): boolean {
  const trigger = notification.request.trigger as Notifications.NotificationTrigger | null;

  if (Platform.OS !== "android" || !trigger || typeof trigger !== "object" || !("type" in trigger)) {
    return false;
  }

  return (
    trigger.type === "push" &&
    !(trigger as Notifications.PushNotificationTrigger).remoteMessage?.notification
  );
}

/**
 * Com o app ABERTO o expo-notifications so avisa o JS de push data-only: nao
 * chama o `setNotificationHandler` nem mostra nada (`NotificationsHandler.kt`).
 * Reapresenta como notificacao local com o mesmo id (`tag` do backend) e os
 * mesmos dados: o handler abaixo decide o banner e o toque cai no mesmo
 * roteador. Em segundo plano/fechado o proprio expo apresenta.
 */
export async function presentForegroundPush(notification: Notifications.Notification): Promise<void> {
  if (!isDataOnlyRemotePush(notification)) {
    return;
  }

  const { identifier, content } = notification.request;

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title: content.title, body: content.body, data: content.data ?? {} },
    trigger: { channelId: DEFAULT_NOTIFICATION_CHANNEL_ID },
  });
}

let handlerConfigured = false;

/** Idempotente. Chamado uma vez na raiz (NotificationProvider). */
export function configureNotificationPresentation() {
  if (handlerConfigured || Platform.OS === "web") {
    return;
  }

  handlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const present = shouldPresentNotification(
        notification.request.content.data as Record<string, unknown> | undefined
      );

      return {
        shouldShowBanner: present,
        shouldShowList: present,
        // Som do canal (padrao do sistema) so quando o aviso aparece.
        shouldPlaySound: present,
        shouldSetBadge: false,
      };
    },
  });
}

/**
 * Canal Android unico ("Geral"). Precisa existir ANTES de pedir a permissao no
 * Android 13+, senao o dialogo do sistema nao aparece.
 */
export async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(DEFAULT_NOTIFICATION_CHANNEL_ID, {
    name: "Geral",
    description: "Matches, mensagens, seguidores e interações nas suas publicações",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#7C4DFF",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

// ---------------------------------------------------------------------------
// Permissao + token
// ---------------------------------------------------------------------------

export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  if (!isRemotePushSupported()) {
    return "unsupported";
  }

  const current = await Notifications.getPermissionsAsync();
  return current.status as PushPermissionStatus;
}

/**
 * O app deve abrir o dialogo de permissao sozinho agora? So uma vez por
 * aparelho e so enquanto o sistema deixa pedir. Nao da para usar
 * `status === "undetermined"`: no Android 13+ o expo-notifications devolve
 * `denied` ANTES do primeiro pedido (notificacoes desligadas = denied), com
 * `canAskAgain: true`.
 */
export async function claimAutoPushPermissionPrompt(): Promise<boolean> {
  if (!isRemotePushSupported()) {
    return false;
  }

  const { status, canAskAgain } = await Notifications.getPermissionsAsync();

  if (status === "granted" || !canAskAgain || (await hasAutoPromptedPushPermission())) {
    return false;
  }

  await markPushPermissionAutoPrompted();
  return true;
}

/**
 * Pede a permissao (dialogo nativo do sistema, uma vez) e devolve o token
 * FCM. `null` quando nao suportado, negado ou sem Firebase configurado no
 * build (`google-services.json` ausente).
 */
async function obtainDevicePushToken(options: { askPermission: boolean }): Promise<string | null> {
  // Sem checar `Device.isDevice`: emulador com imagem "Google Play" recebe FCM
  // normalmente. Sem Google Play Services o `getDevicePushTokenAsync` falha e
  // cai no catch abaixo.
  if (!isRemotePushSupported()) {
    return null;
  }

  await ensureAndroidNotificationChannel();

  let status = (await Notifications.getPermissionsAsync()).status;

  if (status !== "granted" && options.askPermission) {
    status = (await Notifications.requestPermissionsAsync()).status;
  }

  if (status !== "granted") {
    return null;
  }

  try {
    const token = await Notifications.getDevicePushTokenAsync();
    return typeof token.data === "string" && token.data.trim() ? token.data.trim() : null;
  } catch (error) {
    if (__DEV__) {
      // SERVICE_NOT_AVAILABLE = o Google Play do aparelho nao alcanca o
      // Google (rede corporativa bloqueia android.clients.google.com e
      // mtalk.google.com:5228-5230): testar push em outra rede (4G).
      console.warn(
        "[push] Sem token FCM: build sem o google-services.json do app br.com.app.unify ou aparelho sem acesso aos servidores do Google (SERVICE_NOT_AVAILABLE).",
        error
      );
    }
    return null;
  }
}

/**
 * Garante o token deste aparelho registrado para `userId`. Barato quando ja
 * esta registrado (token e dono iguais ao ultimo registro): nao chama a API.
 * Falha silenciosa: push e um extra, nunca bloqueia o uso do app.
 */
export async function syncPushRegistration(
  userId: string,
  options: { askPermission: boolean; forceToken?: string }
): Promise<boolean> {
  try {
    const token = options.forceToken ?? (await obtainDevicePushToken(options));

    if (!token) {
      return false;
    }

    const previous = await getPushRegistration();

    if (previous && previous.token === token && previous.userId === userId) {
      return true;
    }

    const response = await notificationService.registerPushToken({ token, platform: "ANDROID" });
    await savePushRegistration({ id: response.id, token, userId });
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn("[push] Falha ao registrar o token no backend", error);
    }
    return false;
  }
}

/**
 * Logout: tira o aparelho do backend ANTES de revogar a sessao (a rota exige
 * o access token). Best-effort: a limpeza local acontece de qualquer jeito.
 */
export async function unregisterPushRegistration(): Promise<void> {
  const registration = await getPushRegistration();

  if (!registration) {
    return;
  }

  try {
    await notificationService.removePushToken(registration.id);
  } catch {
    // 404 = o aparelho ja mudou de dono no backend; rede fora = o proximo
    // login neste aparelho troca o dono do token de qualquer forma.
  } finally {
    await clearPushRegistration();
  }
}

/** Token FCM rotacionado pelo Google: reenviar ao backend. */
export function addPushTokenRotationListener(onToken: (token: string) => void) {
  if (!isRemotePushSupported()) {
    return { remove: () => undefined };
  }

  return Notifications.addPushTokenListener((token) => {
    if (typeof token.data === "string" && token.data.trim()) {
      onToken(token.data.trim());
    }
  });
}
