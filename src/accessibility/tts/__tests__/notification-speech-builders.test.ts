import { buildNotificationListEntrySpeech } from "../speech-builders";

describe("buildNotificationListEntrySpeech", () => {
  it("lista vazia: nome da tela e aviso", () => {
    expect(buildNotificationListEntrySpeech([], 0)).toEqual([
      "Notificações",
      "Você ainda não tem notificações",
    ]);
  });

  it("lê o total e só as não lidas, uma frase por notificação", () => {
    const parts = buildNotificationListEntrySpeech(
      [
        { read: false, title: "Novo seguidor", body: "Ana começou a seguir você." },
        { read: true, title: "Novo match!", body: "Beto também curtiu você." },
        { read: false, title: "Beto", body: "3 novas mensagens. Última: oi" },
      ],
      2
    );

    expect(parts[0]).toBe("Notificações");
    expect(parts[1]).toBe("2 notificações não lidas");
    expect(parts).toContain("Novo seguidor: Ana começou a seguir você.");
    expect(parts.some((part) => part.includes("Novo match"))).toBe(false);
  });
});
