/**
 * Anuncia em voz alta o nome da tela a cada mudanca de rota, quando o leitor de
 * tela in-app esta ligado. Montado dentro do `AccessibilityProvider`.
 */
import { usePathname } from "expo-router";
import { useEffect, useRef } from "react";

import { speak } from "./tts";

/** Nome amigavel (pt-BR) de cada rota real do diretorio `app/`. */
const ROUTE_LABELS: Record<string, string> = {
  "/": "Unify",
  "/accessibility-onboarding": "Leitura por voz",
  // Mantidos iguais aos rotulos das abas: o toque na aba e o anuncio de rota
  // produzem o mesmo texto e a supressao de duplicata evita fala dupla.
  "/home": "Início",
  "/explore": "Explorar",
  "/matches": "Encontros",
  "/matches/mutual": "Matches mútuos",
  "/matches/my-profile": "Meu perfil de match",
  "/matches/success": "Deu match",
  "/community": "Comunidades",
  "/community/mine": "Minhas comunidades",
  "/community/new": "Novas comunidades",
  "/community/create": "Criar comunidade",
  "/community/comments": "Comentários da publicação",
  "/community/settings": "Configurações da comunidade",
  "/community/manage-member": "Gerenciar membro da comunidade",
  "/profile": "Seu perfil",
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

/** `/community/<id>` e a unica rota dinamica do app. */
const COMMUNITY_DETAIL_PATTERN = /^\/community\/[^/]+$/;

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

  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  const lastSegment = segments[segments.length - 1];

  return lastSegment ? formatSegment(lastSegment) : "Unify";
}

export function ScreenReaderAnnouncer() {
  const pathname = usePathname();
  const lastAnnouncedPathname = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastAnnouncedPathname.current === pathname) {
      return;
    }

    lastAnnouncedPathname.current = pathname;

    // O onboarding de acessibilidade fala a propria introducao completa;
    // anunciar o nome da rota por cima interromperia essa fala.
    if (normalizePathname(pathname) === "/accessibility-onboarding") {
      return;
    }

    speak(getRouteAnnouncement(pathname));
  }, [pathname]);

  return null;
}
