import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { notificationService } from "../../services/notificationService";
import {
  clearPushRegistration,
  getPushRegistration,
  hasAutoPromptedPushPermission,
  markPushPermissionAutoPrompted,
  savePushRegistration,
} from "../../storage/pushRegistrationStorage";
import {
  claimAutoPushPermissionPrompt,
  isDataOnlyRemotePush,
  presentForegroundPush,
  setActiveConversationId,
  shouldPresentNotification,
  syncPushRegistration,
  unregisterPushRegistration,
} from "../pushNotifications";

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(),
  addPushTokenListener: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
}));

jest.mock("../../services/notificationService", () => ({
  notificationService: { registerPushToken: jest.fn(), removePushToken: jest.fn() },
}));

jest.mock("../../storage/pushRegistrationStorage", () => ({
  getPushRegistration: jest.fn(),
  savePushRegistration: jest.fn(),
  clearPushRegistration: jest.fn(),
  hasAutoPromptedPushPermission: jest.fn(),
  markPushPermissionAutoPrompted: jest.fn(),
}));

jest.mock("expo", () => ({ isRunningInExpoGo: jest.fn(() => false) }));

describe("shouldPresentNotification", () => {
  afterEach(() => setActiveConversationId(null));

  it("não mostra banner de mensagem da conversa que está aberta", () => {
    setActiveConversationId("c1");

    expect(shouldPresentNotification({ type: "NEW_MESSAGE", referenceId: "c1" })).toBe(false);
    expect(shouldPresentNotification({ type: "NEW_MESSAGE", referenceId: "c2" })).toBe(true);
    expect(shouldPresentNotification({ type: "NEW_FOLLOWER", referenceId: "c1" })).toBe(true);
    expect(shouldPresentNotification(undefined)).toBe(true);
  });
});

describe("registro do token", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("não chama a API quando o mesmo token já está registrado para a mesma pessoa", async () => {
    (getPushRegistration as jest.Mock).mockResolvedValue({ id: "t1", token: "fcm-1", userId: "u1" });

    await expect(
      syncPushRegistration("u1", { askPermission: false, forceToken: "fcm-1" })
    ).resolves.toBe(true);
    expect(notificationService.registerPushToken).not.toHaveBeenCalled();
  });

  it("registra de novo quando o token rotaciona ou outra pessoa loga no aparelho", async () => {
    (getPushRegistration as jest.Mock).mockResolvedValue({ id: "t1", token: "fcm-1", userId: "u1" });
    (notificationService.registerPushToken as jest.Mock).mockResolvedValue({
      id: "t2",
      platform: "ANDROID",
    });

    await syncPushRegistration("u2", { askPermission: false, forceToken: "fcm-1" });

    expect(notificationService.registerPushToken).toHaveBeenCalledWith({
      token: "fcm-1",
      platform: "ANDROID",
    });
    expect(savePushRegistration).toHaveBeenCalledWith({ id: "t2", token: "fcm-1", userId: "u2" });
  });

  it("logout descadastra pelo id e limpa o registro local mesmo se a API falhar", async () => {
    (getPushRegistration as jest.Mock).mockResolvedValue({ id: "t9", token: "fcm-9", userId: "u1" });
    (notificationService.removePushToken as jest.Mock).mockRejectedValue(new Error("rede"));

    await unregisterPushRegistration();

    expect(notificationService.removePushToken).toHaveBeenCalledWith("t9");
    expect(clearPushRegistration).toHaveBeenCalled();
  });
});

describe("pedido automático da permissão", () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    (hasAutoPromptedPushPermission as jest.Mock).mockResolvedValue(false);
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatformOS });
  });

  it("pede no Android 13+ mesmo com status denied antes do primeiro pedido, e só uma vez", async () => {
    // expo-notifications no Android 13+: notificacoes desligadas = denied, mesmo sem nunca ter pedido.
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
      canAskAgain: true,
    });

    await expect(claimAutoPushPermissionPrompt()).resolves.toBe(true);
    expect(markPushPermissionAutoPrompted).toHaveBeenCalledTimes(1);

    (hasAutoPromptedPushPermission as jest.Mock).mockResolvedValue(true);
    await expect(claimAutoPushPermissionPrompt()).resolves.toBe(false);
    expect(markPushPermissionAutoPrompted).toHaveBeenCalledTimes(1);
  });

  it("não pede quando já concedida ou quando o sistema não deixa pedir de novo", async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: "granted",
      canAskAgain: true,
    });
    await expect(claimAutoPushPermissionPrompt()).resolves.toBe(false);

    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: "denied",
      canAskAgain: false,
    });
    await expect(claimAutoPushPermissionPrompt()).resolves.toBe(false);

    expect(markPushPermissionAutoPrompted).not.toHaveBeenCalled();
  });

  it("não pede fora do Android nativo", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });

    await expect(claimAutoPushPermissionPrompt()).resolves.toBe(false);
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe("push com o app aberto", () => {
  const originalPlatformOS = Platform.OS;
  const content = {
    title: "Bruno Martins",
    body: "Oi Ana!",
    data: { notificationId: "n1", type: "NEW_MESSAGE", referenceId: "c1" },
  };

  function received(trigger: unknown) {
    return { date: 0, request: { identifier: "conversation-c1", content, trigger } } as never;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatformOS });
  });

  it("reapresenta o push data-only do backend como notificação local com o mesmo id e dados", async () => {
    await presentForegroundPush(received({ type: "push", remoteMessage: { notification: null } }));

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: "conversation-c1",
      content: { title: "Bruno Martins", body: "Oi Ana!", data: content.data },
      trigger: { channelId: "default" },
    });
  });

  it("ignora a própria cópia local e push com bloco notification (o expo já mostra)", async () => {
    const localCopy = received({ channelId: "default" });
    const withNotification = received({ type: "push", remoteMessage: { notification: { title: "x" } } });

    expect(isDataOnlyRemotePush(localCopy)).toBe(false);
    expect(isDataOnlyRemotePush(withNotification)).toBe(false);

    await presentForegroundPush(localCopy);
    await presentForegroundPush(withNotification);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
