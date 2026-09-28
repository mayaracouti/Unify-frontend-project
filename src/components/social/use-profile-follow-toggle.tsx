import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { buildActionSpeech, useTTS } from "../../accessibility/tts";
import { followService } from "../../services/followService";
import type { FollowActionResponse } from "../../types/social";
import { announceForAccessibility } from "../../utils/accessibilityAnnouncements";
import {
  applyFollowResponse,
  describeFollowButton,
  followOutcomeAnnouncement,
  predictFollowState,
  resolveFollowRelation,
  type FollowState,
} from "../../utils/followRelation";
import { CancelFollowRequestSheet } from "./cancel-follow-request-sheet";

/**
 * Botao de seguir de UM perfil aberto (perfil publico, Encontros, cabecalho do
 * chat) com os tres estados: Seguir / Pedir para seguir -> Solicitado ->
 * Seguindo.
 *
 * - "Seguir"/"Pedir para seguir": `POST`; a resposta decide se virou
 *   "Seguindo" ou "Solicitado".
 * - "Solicitado": confirma e cancela o pedido (`DELETE /users/{id}/follow`).
 * - "Seguindo": deixa de seguir (`DELETE`).
 *
 * Otimista (volta ao estado anterior se falhar). `speak()` no toque; o anuncio
 * para o leitor do sistema so no sucesso. A tela continua dona do estado (ela
 * carrega as estatisticas do jeito dela) e renderiza `confirmSheet` uma vez.
 */
export function useProfileFollowToggle({
  onChanged,
  setState,
  state,
  targetName,
  targetProfileId,
}: {
  onChanged?: (response: FollowActionResponse) => void;
  setState: Dispatch<SetStateAction<FollowState | null>>;
  state: FollowState | null;
  targetName: string;
  targetProfileId: string | null;
}) {
  const { speak } = useTTS();
  const [busy, setBusy] = useState(false);
  const [confirmCancelVisible, setConfirmCancelVisible] = useState(false);
  // Alvo atual: a resposta de um perfil ja trocado (swipe no Encontros) nao
  // pode sobrescrever o estado do perfil que esta na tela agora.
  const targetRef = useRef(targetProfileId);

  useEffect(() => {
    targetRef.current = targetProfileId;
    setBusy(false);
    setConfirmCancelVisible(false);
  }, [targetProfileId]);

  const button = state ? describeFollowButton(state, targetName) : null;

  const run = useCallback(async () => {
    if (!state || !targetProfileId) {
      return;
    }

    const requestTarget = targetProfileId;
    const previousState = state;
    const previousRelation = resolveFollowRelation(state);

    setBusy(true);
    setState(predictFollowState(state));

    try {
      const response =
        previousRelation === "NONE"
          ? await followService.follow(requestTarget)
          : await followService.unfollow(requestTarget);

      if (targetRef.current !== requestTarget) {
        return;
      }

      setState((current) => (current ? applyFollowResponse(current, response) : current));
      announceForAccessibility(followOutcomeAnnouncement(previousRelation, response, targetName));
      onChanged?.(response);
    } catch {
      if (targetRef.current === requestTarget) {
        setState(previousState);
      }
      // Global API error toast already explains the failure.
    } finally {
      if (targetRef.current === requestTarget) {
        setBusy(false);
      }
    }
  }, [onChanged, setState, state, targetName, targetProfileId]);

  const press = useCallback(() => {
    if (!state || busy || !targetProfileId) {
      return;
    }

    const description = describeFollowButton(state, targetName);
    speak(buildActionSpeech(description.speechAction, targetName));

    if (description.relation === "REQUESTED") {
      setConfirmCancelVisible(true);
      return;
    }

    void run();
  }, [busy, run, speak, state, targetName, targetProfileId]);

  const confirmSheet = (
    <CancelFollowRequestSheet
      onClose={() => setConfirmCancelVisible(false)}
      onConfirm={() => {
        setConfirmCancelVisible(false);
        void run();
      }}
      targetName={confirmCancelVisible ? targetName : null}
    />
  );

  return { busy, button, confirmSheet, press };
}
