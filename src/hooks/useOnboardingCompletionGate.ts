import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../context/AuthContext";
import {
  createOnboardingCompletionSessionKey,
  loadOnboardingCompletion,
  subscribeToOnboardingCompletion,
  type OnboardingCompletionSnapshot,
  type OnboardingCompletionSource,
  type OnboardingCompletionStatus,
} from "../services/onboardingCompletionService";
import type { ProfileCompletionResponse } from "../types/profile";

export type OnboardingCompletionGate = {
  status: OnboardingCompletionStatus;
  source: OnboardingCompletionSource | null;
  completion: ProfileCompletionResponse | null;
  error: unknown;
  /** `true` enquanto a primeira resolucao do estado esta em andamento. */
  isResolving: boolean;
  retry: () => void;
};

const IDLE_GATE: Pick<
  OnboardingCompletionGate,
  "status" | "source" | "completion" | "error"
> = {
  status: "unknown",
  source: null,
  completion: null,
  error: null,
};

/**
 * Unica fonte do estado de conclusao de onboarding usada pela navegacao.
 *
 * Substitui o antigo `useRequireCompletedOnboarding` (que era chamado em ~18
 * telas, redirecionava por conta propria e era fail-open em erro de rede).
 * Aqui nao ha navegacao: o hook so responde "completo / incompleto / nao sei",
 * e quem decide para onde ir e o `app/_layout.tsx`.
 */
export function useOnboardingCompletionGate(): OnboardingCompletionGate {
  const { isAuthenticated, isReady, session } = useAuth();
  const sessionKey = createOnboardingCompletionSessionKey(session?.accessToken);

  const [snapshot, setSnapshot] = useState(IDLE_GATE);
  const [isResolving, setIsResolving] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  // O retry precisa furar o cache uma unica vez; sem o ref, todo reexecutar do
  // efeito depois do primeiro retry continuaria forcando ida a rede.
  const forceRefreshRef = useRef(false);

  const retry = useCallback(() => {
    forceRefreshRef.current = true;
    setRetryToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (!isReady || !isAuthenticated || !sessionKey) {
      setSnapshot(IDLE_GATE);
      setIsResolving(false);
      return;
    }

    let active = true;
    setIsResolving(true);

    const applySnapshot = (result: OnboardingCompletionSnapshot) => {
      if (!active) {
        return;
      }

      setSnapshot({
        status: result.status,
        source: result.source,
        completion: result.completion,
        error: result.error,
      });
      setIsResolving(false);
    };

    const resolve = (options?: { forceRefresh?: boolean }) => {
      void loadOnboardingCompletion(sessionKey, options).then(applySnapshot);
    };

    const shouldForceRefresh = forceRefreshRef.current;
    forceRefreshRef.current = false;

    resolve({ forceRefresh: shouldForceRefresh });

    // Conclusao marcada pelo proprio app (fim do onboarding) e revalidacao em
    // background que muda o estado chegam por aqui.
    const unsubscribe = subscribeToOnboardingCompletion(() => {
      resolve();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [isAuthenticated, isReady, retryToken, sessionKey]);

  return {
    ...snapshot,
    isResolving,
    retry,
  };
}
