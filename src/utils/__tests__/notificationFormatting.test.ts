import {
  buildNotificationAccessibilityLabel,
  formatUnreadNotifications,
  notificationActionHint,
  notificationBellLabel,
} from "../notificationFormatting";

describe("notificationFormatting", () => {
  const now = Date.parse("2026-10-13T12:00:00Z");

  it("rótulo diz 'Não lida' só quando é o caso, depois título, texto e quando", () => {
    const base = {
      title: "Novo match!",
      body: "Ana também curtiu você.",
      createdAt: "2026-10-13T11:55:00Z",
    };

    expect(buildNotificationAccessibilityLabel({ ...base, read: false }, now)).toBe(
      "Não lida. Novo match! Ana também curtiu você. há 5 min"
    );
    expect(buildNotificationAccessibilityLabel({ ...base, read: true }, now)).toBe(
      "Novo match! Ana também curtiu você. há 5 min"
    );
  });

  it("contagem e rótulo do sino no singular e no plural", () => {
    expect(formatUnreadNotifications(0)).toBe("Nenhuma não lida");
    expect(formatUnreadNotifications(1)).toBe("1 não lida");
    expect(formatUnreadNotifications(12)).toBe("12 não lidas");
    expect(notificationBellLabel(0)).toBe("Notificações, nenhuma não lida");
    expect(notificationBellLabel(3)).toBe("Notificações, 3 não lidas");
  });

  it("toda notificação tem dica dizendo o resultado do toque", () => {
    expect(notificationActionHint("NEW_MESSAGE")).toBe("Abre a conversa");
    expect(notificationActionHint("REPORT_UPDATE")).toBe("Marca esta notificação como lida");
    expect(notificationActionHint("POST_REMOVED")).toBe("Marca esta notificação como lida");
  });
});
