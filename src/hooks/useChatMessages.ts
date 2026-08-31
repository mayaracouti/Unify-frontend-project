import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { chatService } from "../services/chatService";
import type { ChatMessageResponse } from "../types/chat";

const POLL_INTERVAL_MS = 4500;
const MAX_BACKOFF_MS = 30000;
const PAGE_SIZE = 30;

type UseChatMessagesArgs = {
  conversationId: string | null;
  /** Tela em foco. Fora de foco o polling nao roda. */
  enabled: boolean;
  onNewIncomingMessages?: (messages: ChatMessageResponse[]) => void;
};

/**
 * Carrega o historico paginado e mantem a conversa atualizada por polling.
 *
 * Regras (C12 do plano):
 *  - o cursor `since` vem SEMPRE do serverTime da resposta anterior (nunca de Date.now())
 *  - um ciclo por vez (guarda com ref)
 *  - clearTimeout no cleanup (desmontagem, perda de foco)
 *  - backoff exponencial em erro, reset no primeiro sucesso
 *  - deduplicacao por id ao mesclar
 */
export function useChatMessages({
  conversationId,
  enabled,
  onNewIncomingMessages,
}: UseChatMessagesArgs) {
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageRef = useRef(0);
  const sinceRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const backoffRef = useRef(POLL_INTERVAL_MS);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // O callback muda de identidade a cada render da tela; guardar em ref evita
  // reiniciar o ciclo de polling por causa disso.
  const onNewIncomingMessagesRef = useRef(onNewIncomingMessages);

  useEffect(() => {
    onNewIncomingMessagesRef.current = onNewIncomingMessages;
  }, [onNewIncomingMessages]);

  const mergeMessages = useCallback(
    (incoming: ChatMessageResponse[], mode: "prepend" | "append" | "replace") => {
      setMessages((current) => {
        if (mode === "replace") {
          return incoming;
        }

        const byId = new Map<string, ChatMessageResponse>();
        const base = mode === "prepend" ? [...incoming, ...current] : [...current, ...incoming];

        for (const message of base) {
          byId.set(message.id, message);
        }

        // Sempre da mais recente para a mais antiga (a FlatList e `inverted`).
        return Array.from(byId.values()).sort(
          (first, second) =>
            new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
        );
      });
    },
    []
  );

  // ---- carga inicial ---------------------------------------------------
  useEffect(() => {
    if (!conversationId || !enabled) {
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    pageRef.current = 0;

    chatService
      .getMessages(conversationId, { page: 0, size: PAGE_SIZE })
      .then((response) => {
        if (!active) {
          return;
        }
        mergeMessages(response.messages, "replace");
        setHasNext(response.hasNext);
        sinceRef.current = response.serverTime;
      })
      .catch((nextError) => {
        if (active) {
          setError("Não foi possível carregar as mensagens.");
          if (__DEV__) {
            console.warn("[chat] falha ao carregar mensagens", nextError);
          }
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [conversationId, enabled, mergeMessages]);

  // ---- polling ---------------------------------------------------------
  useEffect(() => {
    if (!conversationId || !enabled) {
      return;
    }

    let disposed = false;

    const subscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;
    });

    const schedule = (delay: number) => {
      if (disposed) {
        return;
      }
      timeoutRef.current = setTimeout(() => {
        void tick();
      }, delay);
    };

    const tick = async () => {
      if (disposed || inFlightRef.current) {
        schedule(backoffRef.current);
        return;
      }

      // App em background ou historico ainda nao carregado: nada a buscar.
      if (appStateRef.current !== "active" || !sinceRef.current) {
        schedule(POLL_INTERVAL_MS);
        return;
      }

      inFlightRef.current = true;

      try {
        const response = await chatService.getMessagesSince(conversationId, sinceRef.current);
        sinceRef.current = response.serverTime;
        backoffRef.current = POLL_INTERVAL_MS; // sucesso: reseta o backoff

        if (!disposed && response.messages.length > 0) {
          mergeMessages(response.messages, "prepend");

          const incoming = response.messages.filter((message) => !message.fromMe);
          if (incoming.length > 0) {
            onNewIncomingMessagesRef.current?.(incoming);
          }
        }
      } catch {
        // Polling falha em silencio: sem toast, so backoff.
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
      } finally {
        inFlightRef.current = false;
        schedule(backoffRef.current);
      }
    };

    schedule(POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      subscription.remove();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [conversationId, enabled, mergeMessages]);

  // ---- historico -------------------------------------------------------
  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || !hasNext || loadingMore) {
      return;
    }

    setLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const response = await chatService.getMessages(conversationId, {
        page: nextPage,
        size: PAGE_SIZE,
      });
      pageRef.current = nextPage;
      mergeMessages(response.messages, "append");
      setHasNext(response.hasNext);
    } catch {
      // silencioso: o usuario pode tentar de novo rolando
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, hasNext, loadingMore, mergeMessages]);

  /** Insercao otimista do que o proprio usuario acabou de enviar. */
  const appendLocalMessage = useCallback(
    (message: ChatMessageResponse) => {
      mergeMessages([message], "prepend");
    },
    [mergeMessages]
  );

  return {
    appendLocalMessage,
    error,
    hasNext,
    loadOlderMessages,
    loading,
    loadingMore,
    messages,
  };
}
