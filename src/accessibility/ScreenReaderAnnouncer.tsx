/**
 * Anuncia em voz alta o nome da tela a cada mudanca de rota, quando o leitor de
 * tela in-app esta ligado. Montado dentro do `AccessibilityProvider`.
 */
import { usePathname } from "expo-router";
import { useEffect, useRef } from "react";

import { announceForAccessibility } from "../utils/accessibilityAnnouncements";
import { isSystemScreenReaderEnabled, speak } from "./tts";

/** Nome amigavel (pt-BR) de cada rota real do diretorio `app/`. */
const ROUTE_LABELS: Record<string, string> = {
  "/": "Unify",
  "/accessibility-onboarding": "Leitura por voz",
  // Mantidos iguais aos rotulos das abas: o toque na aba e o anuncio de rota
  // produzem o mesmo texto e a supressao de duplicata evita fala dupla.
  "/home": "Início",
  "/matches": "Encontros",
  "/matches/mutual": "Matches mútuos",
  "/matches/my-profile": "Meu perfil de match",
  "/matches/success": "Deu match",
  "/community": "Comunidades",
  "/community/mine": "Minhas comunidades",
  "/community/new": "Novas comunidades",
  "/community/create": "Criar comunidade",
  "/community/comments": "Comentários da publicação",
  "/posts/comments": "Comentários da publicação",
  "/community/settings": "Configurações da comunidade",
  "/community/manage-member": "Gerenciar membro da comunidade",
  "/chats": "Conversas",
  "/profile": "Seu perfil",
  "/profile/new-post": "Nova publicação",
  "/profile/posts": "Postagens",
  "/profile/followers": "Seguidores",
  "/profile/following": "Seguindo",
  "/profile/edit": "Editar perfil",
  "/profile/edit-match-preferences": "Editar preferências de match",
  "/profile/accessibility-settings": "Configurações de acessibilidade",
  "/onboarding/profile": "Complete seu perfil",
  "/onboarding/match-preferences": "Preferências de match",
  "/auth/login": "Entrar na Unify",
  "/auth/cadastro": "Criar conta",
  "/auth/cadastro/accessibility": "Preferências de acessibilidade",
  "/auth/email-code": "Confirmação de e-mail",
  "/auth/forgot-password": "Recuperar senha",
  "/auth/forgot-password/reset-password": "Definir nova senha",
  "/auth/underage": "Cadastro indisponível para menores de idade",
  "/reset-password": "Definir nova senha",
};

/**
 * Janela de supressao de duplicata do anuncio nativo, espelhando
 * `DUPLICATE_SUPPRESSION_MS` do TTS (`src/accessibility/tts/tts-service.ts`,
 * 1200 ms) com uma folga: o leitor do sistema enfileira a fala e pode demorar
 * mais que o motor in-app para consumi-la.
 */
const DUPLICATE_SUPPRESSION_MS = 1500;

/** Rotas dinamicas do app: o id nunca deve ser falado. */
const COMMUNITY_DETAIL_PATTERN = /^\/community\/[^/]+$/;
const CHAT_DETAIL_PATTERN = /^\/chats\/[^/]+$/;
const USER_PROFILE_PATTERN = /^\/users\/[^/]+$/;

/**
 * Telas que falam a propria sequencia de entrada assim que os dados chegam
 * (ex.: chat: nome da tela, pendencias, pessoa e ultima mensagem). Anunciar
 * so o nome da rota aqui seria cortado no meio pela sequencia da tela.
 */
function isSelfAnnouncingRoute(normalizedPathname: string): boolean {
  return normalizedPathname === "/chats" || CHAT_DETAIL_PATTERN.test(normalizedPathname);
}

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split("?")[0];
  const trimmed = withoutQuery.replace(/\/+$/, "");

  return trimmed.length > 0 ? trimmed : "/";
}

function formatSegment(segment: string): string {
  const words = decodeURIComponent(segment).replace(/[-_]+/g, " ").trim();

  if (!words) {
    return "";
  }

  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

export function getRouteAnnouncement(pathname: string): string {
  const normalized = normalizePathname(pathname);
  const label = ROUTE_LABELS[normalized];

  if (label) {
    return label;
  }

  if (COMMUNITY_DETAIL_PATTERN.test(normalized)) {
    return "Comunidade";
  }

  if (CHAT_DETAIL_PATTERN.test(normalized)) {
    return "Conversa";
  }

  if (USER_PROFILE_PATTERN.test(normalized)) {
    return "Perfil";
  }

  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  const lastSegment = segments[segments.length - 1];

  return lastSegment ? formatSegment(lastSegment) : "Unify";
}

export function ScreenReaderAnnouncer() {
  const pathname = usePathname();
  const lastAnnouncedPathname = useRef<string | null>(null);
  const lastNativeAnnouncement = useRef<string | null>(null);
  const lastNativeAnnouncementAt = useRef(0);

  useEffect(() => {
    if (!pathname || lastAnnouncedPathname.current === pathname) {
      return;
    }

    lastAnnouncedPathname.current = pathname;

    // O onboarding de acessibilidade fala a propria introducao completa;
    // anunciar o nome da rota por cima interromperia essa fala.
    const normalized = normalizePathname(pathname);

    if (normalized === "/accessibility-onboarding" || isSelfAnnouncingRoute(normalized)) {
      return;
    }

    const announcement = getRouteAnnouncement(pathname);

    // `speak()` do TTS in-app se cala quando o leitor nativo esta ligado (mesma
    // fonte de verdade: `isSystemScreenReaderEnabled`). Nesse caso o nome da
    // rota precisa sair pelo canal do sistema, senao a troca de tela fica muda.
    if (isSystemScreenReaderEnabled()) {
      const now = Date.now();

      // Mesma janela de supressao do TTS: evita fala dupla quando o toque na
      // aba e o anuncio da rota produzem o mesmo texto.
      if (
        announcement === lastNativeAnnouncement.current &&
        now - lastNativeAnnouncementAt.current < DUPLICATE_SUPPRESSION_MS
      ) {
        return;
      }

      lastNativeAnnouncement.current = announcement;
      lastNativeAnnouncementAt.current = now;

      announceForAccessibility(announcement);
      return;
    }

    speak(announcement);
  }, [pathname]);

  return null;
}
