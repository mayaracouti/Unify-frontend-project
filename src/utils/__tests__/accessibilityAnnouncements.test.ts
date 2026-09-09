/**
 * `getRouteAnnouncement` (mapeamento de rota -> anuncio) vive em
 * `src/accessibility/ScreenReaderAnnouncer.tsx`, nao em
 * `accessibilityAnnouncements.ts` — este arquivo testa as duas coisas:
 * o mapeamento de rotas e os textos centralizados de `accessibilityAnnouncements`.
 */
jest.mock("../../accessibility/tts", () => ({
  speak: jest.fn(),
}));

import { getRouteAnnouncement } from "../../accessibility/ScreenReaderAnnouncer";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../accessibilityAnnouncements";

describe("getRouteAnnouncement", () => {
  it("mapeia rotas conhecidas para o rotulo em pt-BR", () => {
    expect(getRouteAnnouncement("/home")).toBe("Início");
    expect(getRouteAnnouncement("/explore")).toBe("Explorar");
    expect(getRouteAnnouncement("/matches")).toBe("Encontros");
    expect(getRouteAnnouncement("/auth/login")).toBe("Entrar na Unify");
  });

  it("ignora barra final e query string ao normalizar", () => {
    expect(getRouteAnnouncement("/home/")).toBe("Início");
    expect(getRouteAnnouncement("/explore?tab=nearby")).toBe("Explorar");
  });

  it("reconhece a rota dinamica de detalhe de comunidade", () => {
    expect(getRouteAnnouncement("/community/abc-123")).toBe("Comunidade");
  });

  it("cai para o ultimo segmento formatado quando a rota e desconhecida", () => {
    expect(getRouteAnnouncement("/some-unknown-route")).toBe(
      "Some unknown route"
    );
  });

  it("cai para 'Unify' quando o caminho normalizado fica vazio", () => {
    expect(getRouteAnnouncement("/")).toBe("Unify");
  });
});

describe("accessibilityAnnouncements", () => {
  it("gera o texto de novo match mutuo com o nome informado", () => {
    expect(accessibilityAnnouncements.newMutualMatch("Ana")).toBe(
      "Novo match com Ana. Vocês demonstraram interesse mútuo. Agora dá para conversar."
    );
  });

  it("pluraliza corretamente novas mensagens", () => {
    expect(accessibilityAnnouncements.newMessages(1, "Ana")).toBe(
      "Nova mensagem de Ana."
    );
    expect(accessibilityAnnouncements.newMessages(3, "Ana")).toBe(
      "3 novas mensagens de Ana."
    );
  });
});

describe("announceForAccessibility", () => {
  it("nao chama AccessibilityInfo quando a mensagem e vazia", () => {
    const { AccessibilityInfo } = require("react-native");
    jest.spyOn(AccessibilityInfo, "announceForAccessibility");

    announceForAccessibility("   ");

    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
  });

  it("anuncia a mensagem normalizada quando ha conteudo", () => {
    const { AccessibilityInfo } = require("react-native");
    jest.spyOn(AccessibilityInfo, "announceForAccessibility");

    announceForAccessibility("  Ola mundo  ");

    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      "Ola mundo"
    );
  });
});
