import { usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { matchService } from "../../services/matchService";
import {
  buildMatchCelebrationHref,
  MATCH_CELEBRATION_PATHNAME,
  pickNextMatchCelebration,
  registerMatchCelebrationCheck,
} from "../../utils/matchCelebration";

/**
 * Com o app aberto, a consulta se repete neste ritmo: e o que faz a tela
 * aparecer "quase na hora" para quem curtiu primeiro mesmo sem push (Expo Go,
 * rede que bloqueia o FCM). Com push, o NEW_MATCH antecipa a consulta.
 */
const POLL_INTERVAL_MS = 15000;

/** Fechou uma comemoracao: espera a navegacao assentar antes da proxima. */
const NEXT_CELEBRATION_DELAY_MS = 800;

/**
 * Abre a tela "Deu match" dos matches mutuos que a pessoa ainda nao viu (ver
 * `src/utils/matchCelebration.ts`). Montado em `app/_layout.tsx` SO com as
 * rotas autenticadas no `Stack`, antes do `PushNotificationRouter` (que usa
 * a consulta registrada aqui no toque de um NEW_MATCH).
 *
 * Nao renderiza nada.
 */
export function MatchCelebrationWatcher() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const previousPathnameRef = useRef(pathname);
  // Aberto uma vez nesta sessao nao reabre, mesmo que o "visto" ainda nao
  // tenha chegado ao backend (a tela de sucesso confirma e tenta de novo).
  const presentedRef = useRef(new Set<string>());
  const inFlightRef = useRef<Promise<boolean> | null>(null);

  const check = useCallback(() => {
    // Gatilhos quase juntos (voltar ao app + push) viram uma consulta so.
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const run = (async () => {
      // Uma comemoracao por vez: a proxima sai quando esta fechar.
      if (pathnameRef.current === MATCH_CELEBRATION_PATHNAME) {
        return true;
      }

      if (AppState.currentState !== "active") {
        return false;
      }

      const queue = await matchService.getUnseenMutualMatches().catch(() => null);

      // A pessoa pode ter saido do app (ou aberto a tela) durante a requisicao.
      if (pathnameRef.current === MATCH_CELEBRATION_PATHNAME) {
        return true;
      }

      if (AppState.currentState !== "active") {
        return false;
      }

      const next = pickNextMatchCelebration(queue, presentedRef.current);

      if (!next?.matchId) {
        return false;
      }

      presentedRef.current.add(next.matchId);
      router.push(buildMatchCelebrationHref(next));
      return true;
    })().finally(() => {
      inFlightRef.current = null;
    });

    inFlightRef.current = run;
    return run;
  }, [router]);

  useEffect(() => registerMatchCelebrationCheck(check), [check]);

  // Ao entrar, a cada intervalo com o app ativo e ao voltar para o app.
  useEffect(() => {
    void check();

    const intervalId = setInterval(() => {
      if (AppState.currentState === "active") {
        void check();
      }
    }, POLL_INTERVAL_MS);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void check();
      }
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [check]);

  // Saiu da tela "Deu match": mostra o proximo da fila, se houver.
  useEffect(() => {
    const previous = previousPathnameRef.current;
    previousPathnameRef.current = pathname;
    pathnameRef.current = pathname;

    if (previous !== MATCH_CELEBRATION_PATHNAME || pathname === MATCH_CELEBRATION_PATHNAME) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void check();
    }, NEXT_CELEBRATION_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [check, pathname]);

  return null;
}
