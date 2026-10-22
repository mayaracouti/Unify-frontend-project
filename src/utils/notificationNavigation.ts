import type { Href } from "expo-router";

import { feedService } from "../services/feedService";
import type { NotificationTargetData, NotificationType } from "../types/notification";
import { showGlobalToast } from "./globalToast";
import { buildPostCommentsHref } from "./postRoutes";
import { buildUserProfileHref } from "./userProfileRoute";

/**
 * Destino de uma notificacao — PONTO UNICO usado pela lista in-app
 * (`app/notifications`) e pelo toque no push do sistema. Contrato com o
 * backend (`NotificationType.java`):
 *
 * | tipo                    | referenceId              | contextId            | destino                         |
 * |-------------------------|--------------------------|----------------------|---------------------------------|
 * | NEW_MATCH               | id do match              | perfil da pessoa     | /matches/mutual                 |
 * | NEW_MESSAGE             | conversa                 | perfil de quem mandou| /chats/[conversationId]         |
 * | NEW_FOLLOWER            | perfil de quem seguiu    | —                    | /users/[userProfileId]          |
 * | FOLLOW_REQUEST          | perfil de quem pediu     | —                    | /profile/follow-requests        |
 * | FOLLOW_REQUEST_ACCEPTED | perfil de quem aceitou   | —                    | /users/[userProfileId]          |
 * | POST_LIKED/COMMENTED    | post                     | comunidade (ou nulo) | comentarios do post (busca o post) |
 * | COMMUNITY_POST          | post                     | comunidade           | /community/[communityId]        |
 * | REPORT_UPDATE           | denuncia                 | —                    | (sem tela propria)              |
 * | POST_REMOVED            | post removido            | comunidade (ou nulo) | (post nao abre mais)            |
 */
export type NotificationTarget =
  | { kind: "route"; href: Href }
  /** Precisa buscar o post para saber a origem (pessoal x comunidade). */
  | { kind: "post"; postId: string }
  | { kind: "none" };

const NOTIFICATION_TYPES: readonly NotificationType[] = [
  "NEW_MATCH",
  "NEW_MESSAGE",
  "NEW_FOLLOWER",
  "FOLLOW_REQUEST",
  "FOLLOW_REQUEST_ACCEPTED",
  "POST_LIKED",
  "POST_COMMENTED",
  "COMMUNITY_POST",
  "REPORT_UPDATE",
  "POST_REMOVED",
];

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === "string" && (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

function clean(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveNotificationTarget(data: NotificationTargetData): NotificationTarget {
  const referenceId = clean(data.referenceId);
  const contextId = clean(data.contextId);
  const actorName = clean(data.actorName);

  switch (data.type) {
    case "NEW_MATCH":
      // Nao existe tela de "detalhe do match": a lista de mutuos abre a conversa.
      return { kind: "route", href: "/matches/mutual" };

    case "NEW_MESSAGE":
      return referenceId
        ? {
            kind: "route",
            href: {
              pathname: "/chats/[conversationId]",
              params: {
                conversationId: referenceId,
                ...(actorName ? { name: actorName } : {}),
                ...(contextId ? { otherUserProfileId: contextId } : {}),
              },
            },
          }
        : { kind: "route", href: "/chats" };

    case "NEW_FOLLOWER":
    case "FOLLOW_REQUEST_ACCEPTED":
      return referenceId
        ? { kind: "route", href: buildUserProfileHref(referenceId, actorName) }
        : { kind: "none" };

    case "FOLLOW_REQUEST":
      return { kind: "route", href: "/profile/follow-requests" };

    case "POST_LIKED":
    case "POST_COMMENTED":
      return referenceId ? { kind: "post", postId: referenceId } : { kind: "none" };

    case "COMMUNITY_POST":
      return contextId
        ? {
            kind: "route",
            href: { pathname: "/community/[communityId]", params: { communityId: contextId } },
          }
        : { kind: "none" };

    default:
      return { kind: "none" };
  }
}

export type OpenNotificationResult = "opened" | "unavailable" | "none";

type RouterLike = { push: (href: Href) => void };

/**
 * Navega para o destino. Post que sumiu (ou deixou de ser visivel) vira um
 * aviso "nao esta mais disponivel" em vez de uma tela quebrada (plano 05,
 * risco 6: `reference_id` nao tem FK).
 */
export async function openNotificationTarget(
  router: RouterLike,
  data: NotificationTargetData
): Promise<OpenNotificationResult> {
  const target = resolveNotificationTarget(data);

  if (target.kind === "route") {
    router.push(target.href);
    return "opened";
  }

  if (target.kind === "post") {
    try {
      const post = await feedService.getPost(target.postId, { silent: true });
      router.push(buildPostCommentsHref(post));
      return "opened";
    } catch {
      showGlobalToast({
        variant: "info",
        title: "Conteúdo indisponível",
        message: "Esta publicação não está mais disponível.",
      });
      return "unavailable";
    }
  }

  return "none";
}

/**
 * Converte `content.data` de um push (tudo texto, chaves possivelmente
 * ausentes) no formato da navegacao. `null` quando nao e notificacao da Unify.
 */
export function parsePushData(raw: unknown): NotificationTargetData | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Record<string, unknown>;

  if (!isNotificationType(data.type)) {
    return null;
  }

  const read = (key: string) => (typeof data[key] === "string" ? (data[key] as string) : null);

  return {
    type: data.type,
    referenceId: read("referenceId"),
    contextId: read("contextId"),
    notificationId: read("notificationId"),
  };
}
