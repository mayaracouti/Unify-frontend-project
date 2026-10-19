import type { NotificationResponse } from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

import { useNotifications } from "../../context/NotificationContext";
import { notificationService } from "../../services/notificationService";
import { checkPendingMatchCelebrations } from "../../utils/matchCelebration";
import { openNotificationTarget, parsePushData } from "../../utils/notificationNavigation";
import { loadNotifications } from "../../utils/pushNotifications";

/**
 * Toque numa notificacao do sistema (app em segundo plano, fechado ou
 * aberto) leva direto ao destino. Montado em `app/_layout.tsx` SO quando as
 * rotas autenticadas ja existem no `Stack` — antes disso `router.push` cairia
 * no `+not-found`. Quando o toque abriu o app do zero, a resposta fica
 * guardada pelo `expo-notifications` e e consumida aqui ao montar.
 *
 * Nao renderiza nada.
 */
export function PushNotificationRouter() {
  const router = useRouter();
  const { refreshUnreadCount } = useNotifications();
  const handledRef = useRef(new Set<string>());

  const handleResponse = useCallback(
    async (response: NotificationResponse) => {
      const key = `${response.notification.request.identifier}:${response.notification.date}`;

      if (handledRef.current.has(key)) {
        return;
      }

      handledRef.current.add(key);
      loadNotifications()?.clearLastNotificationResponse();

      const data = parsePushData(response.notification.request.content.data);

      if (!data) {
        return;
      }

      if (data.notificationId) {
        // Tocar e "ler": o aviso sai do sino mesmo que o destino nao exista mais.
        await notificationService.markAsRead(data.notificationId).catch(() => undefined);
      }

      // Match ainda nao comemorado: a tela "Deu match" no lugar da lista de
      // conexoes (o "Continuar navegando" dela volta para onde a pessoa estava).
      if (data.type === "NEW_MATCH" && (await checkPendingMatchCelebrations())) {
        void refreshUnreadCount();
        return;
      }

      const result = await openNotificationTarget(router, data);

      if (result === "none") {
        router.push("/notifications");
      }

      void refreshUnreadCount();
    },
    [refreshUnreadCount, router]
  );

  useEffect(() => {
    // Expo Go/web: sem notificacoes do sistema, nada a rotear.
    const Notifications = loadNotifications();

    if (!Notifications) {
      return;
    }

    const launchResponse = Notifications.getLastNotificationResponse();

    if (launchResponse) {
      void handleResponse(launchResponse);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleResponse(response);
    });

    return () => subscription.remove();
  }, [handleResponse]);

  return null;
}
