import type { FollowRequestResponse } from "../types/social";
import { formatRelativePostDate } from "./postFormatting";

/** Abas da tela de pedidos para seguir. */
export type FollowRequestsTab = "received" | "sent";

export const FOLLOW_REQUESTS_TABS: readonly {
  key: FollowRequestsTab;
  label: string;
  hint: string;
}[] = [
  {
    key: "received",
    label: "Recebidos",
    hint: "Mostra quem pediu para seguir você",
  },
  {
    key: "sent",
    label: "Enviados",
    hint: "Mostra as pessoas que você pediu para seguir",
  },
];

export function parseFollowRequestsTab(value: string | string[] | undefined): FollowRequestsTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "sent" ? "sent" : "received";
}

/**
 * Rotulo acessivel do atalho para os pedidos (Perfil e menu): o badge e
 * decorativo, entao a contagem vai aqui. Sem contagem (carregando ou falhou),
 * so o nome do destino.
 */
export function followRequestsAccessLabel(pendingCount: number | null | undefined): string {
  if (typeof pendingCount !== "number" || !Number.isFinite(pendingCount)) {
    return "Pedidos para seguir";
  }

  return pendingCount > 0
    ? `Pedidos para seguir, ${pendingCount} aguardando`
    : "Pedidos para seguir, nenhum aguardando";
}

/**
 * O atalho do Perfil aparece com a conta privada ligada ou com pedidos
 * aguardando (sobram pendentes de quando a conta era privada).
 */
export function shouldShowFollowRequestsShortcut(
  stats: { followApprovalRequired?: boolean | null; pendingFollowRequestsCount?: number | null } | null | undefined
): boolean {
  if (!stats) {
    return false;
  }

  return stats.followApprovalRequired === true || (stats.pendingFollowRequestsCount ?? 0) > 0;
}

/** "Recebidos, 3 pedidos" (sem contagem enquanto a aba nao carregou). */
export function followRequestsTabAccessibilityLabel(label: string, total: number | null): string {
  if (total === null) {
    return label;
  }

  if (total === 0) {
    return `${label}, nenhum pedido`;
  }

  return `${label}, ${total} ${total === 1 ? "pedido" : "pedidos"}`;
}

/** Rotulo do botao que abre o perfil (foto + nome) de cada pedido. */
export function followRequestRowLabel(
  request: Pick<FollowRequestResponse, "name" | "createdAt">,
  tab: FollowRequestsTab,
  now = Date.now()
): string {
  const name = request.name?.trim() || "Pessoa sem nome";
  const when = formatRelativePostDate(request.createdAt, now);
  const base = tab === "received" ? `${name} pediu para seguir você` : `Você pediu para seguir ${name}`;

  return when ? `${base}, ${when}` : base;
}

/** Anexa uma pagina sem repetir pedidos (a lista pode mudar entre paginas). */
export function mergeFollowRequestPage(
  previous: readonly FollowRequestResponse[],
  incoming: readonly FollowRequestResponse[]
): FollowRequestResponse[] {
  const known = new Set(previous.map((request) => request.id));
  return [...previous, ...incoming.filter((request) => !known.has(request.id))];
}

/** Remocao otimista: devolve a lista sem o pedido e onde ele estava (para o rollback). */
export function removeFollowRequest(
  items: readonly FollowRequestResponse[],
  requestId: string
): { items: FollowRequestResponse[]; removed: FollowRequestResponse | null; index: number } {
  const index = items.findIndex((request) => request.id === requestId);

  if (index < 0) {
    return { items: [...items], removed: null, index: -1 };
  }

  return {
    items: [...items.slice(0, index), ...items.slice(index + 1)],
    removed: items[index],
    index,
  };
}

/** Rollback: devolve o pedido a posicao original (ou ao fim, se a lista encolheu). */
export function restoreFollowRequest(
  items: readonly FollowRequestResponse[],
  request: FollowRequestResponse,
  index: number
): FollowRequestResponse[] {
  if (items.some((item) => item.id === request.id)) {
    return [...items];
  }

  const position = Math.max(0, Math.min(index, items.length));
  return [...items.slice(0, position), request, ...items.slice(position)];
}
