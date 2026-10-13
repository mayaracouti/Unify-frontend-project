import type Ionicons from "@expo/vector-icons/Ionicons";

import type { NotificationResponse, NotificationType } from "../types/notification";
import { formatRelativePostDate } from "./postFormatting";

type IconName = keyof typeof Ionicons.glyphMap;

/** Icone por tipo (decorativo: o tipo ja esta no texto do item). */
export const NOTIFICATION_ICONS: Record<NotificationType, IconName> = {
  NEW_MATCH: "heart",
  NEW_MESSAGE: "chatbubble-ellipses",
  NEW_FOLLOWER: "person-add",
  FOLLOW_REQUEST: "hourglass-outline",
  FOLLOW_REQUEST_ACCEPTED: "checkmark-circle",
  POST_LIKED: "thumbs-up",
  POST_COMMENTED: "chatbubble",
  COMMUNITY_POST: "people",
  REPORT_UPDATE: "shield-checkmark",
};

/** Dica de acessibilidade: o que acontece ao tocar (resultado da acao). */
export const NOTIFICATION_ACTION_HINTS: Record<NotificationType, string> = {
  NEW_MATCH: "Abre a lista de matches para conversar",
  NEW_MESSAGE: "Abre a conversa",
  NEW_FOLLOWER: "Abre o perfil de quem começou a seguir você",
  FOLLOW_REQUEST: "Abre os pedidos para seguir para aceitar ou recusar",
  FOLLOW_REQUEST_ACCEPTED: "Abre o perfil de quem aceitou o seu pedido",
  POST_LIKED: "Abre a publicação e os comentários",
  POST_COMMENTED: "Abre a publicação e os comentários",
  COMMUNITY_POST: "Abre a comunidade",
  REPORT_UPDATE: "Marca esta notificação como lida",
};

export function notificationIcon(type: NotificationType): IconName {
  return NOTIFICATION_ICONS[type] ?? "notifications";
}

export function notificationActionHint(type: NotificationType): string {
  return NOTIFICATION_ACTION_HINTS[type] ?? "Abre o conteúdo da notificação";
}

/** "Nenhuma não lida" / "1 não lida" / "3 não lidas". */
export function formatUnreadNotifications(count: number): string {
  if (!Number.isFinite(count) || count <= 0) {
    return "Nenhuma não lida";
  }

  return count === 1 ? "1 não lida" : `${count} não lidas`;
}

/**
 * Rotulo unico do item para o leitor de tela, na ordem que importa: estado
 * (so quando nao lida — "lida" em todo item seria ruido), titulo, texto e
 * quando. Ex.: "Não lida. Novo match! Ana também curtiu você. há 5 min".
 */
export function buildNotificationAccessibilityLabel(
  notification: Pick<NotificationResponse, "read" | "title" | "body" | "createdAt">,
  now = Date.now()
): string {
  const parts = [
    notification.read ? null : "Não lida",
    notification.title?.trim() || null,
    notification.body?.trim() || null,
    formatRelativePostDate(notification.createdAt, now) || null,
  ].filter((part): part is string => Boolean(part));

  // Ponto so quando a frase ainda nao termina em pontuacao ("Novo match!"
  // nao vira "Novo match!.").
  return parts
    .map((part, index) =>
      index === parts.length - 1 || /[.!?…:]$/.test(part) ? part : `${part}.`
    )
    .join(" ");
}

/** Rotulo do sino no topo (o numero visual do badge fica fora da arvore de acessibilidade). */
export function notificationBellLabel(unreadCount: number): string {
  return unreadCount > 0
    ? `Notificações, ${formatUnreadNotifications(unreadCount).toLowerCase()}`
    : "Notificações, nenhuma não lida";
}
