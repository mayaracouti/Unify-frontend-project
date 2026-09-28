import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAppShell } from "../context/AppShellContext";
import { followService } from "../services/followService";

/**
 * Pedidos para seguir RECEBIDOS aguardando, para badges (menu, Perfil).
 * Vem de `GET /users/{meuUserProfileId}/follow-stats` →
 * `pendingFollowRequestsCount`. Recarrega ao focar a tela e via `refresh`
 * (ex.: ao abrir o menu). Falha silenciosa: mantem o ultimo valor.
 *
 * `enabled = false` nao faz requisicao (ex.: barra sem menu).
 */
export function useFollowRequestsCount(enabled = true) {
  const { currentUserProfileId } = useAppShell();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled || !currentUserProfileId) {
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    try {
      const stats = await followService.getFollowStats(currentUserProfileId, { silent: true });

      if (!mountedRef.current || requestRef.current !== requestId) {
        return;
      }

      setPendingCount(
        typeof stats.pendingFollowRequestsCount === "number" ? stats.pendingFollowRequestsCount : 0
      );
      setApprovalRequired(stats.followApprovalRequired === true);
    } catch {
      // Silencioso: o badge e um extra e nao pode derrubar a tela.
    }
  }, [currentUserProfileId, enabled]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  return { pendingCount, approvalRequired, refresh };
}
