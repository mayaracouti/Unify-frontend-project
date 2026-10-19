import type { Href } from "expo-router";

import { profileService } from "../services/profileService";
import type { MutualMatchSummaryResponse } from "../types/match";

/**
 * Tela "Deu match" para os DOIS lados do par.
 *
 * Quem responde o convite ve a comemoracao na hora, pela resposta do POST
 * (fluxo de descoberta em `app/matches/index.tsx`). Quem curtiu primeiro so
 * fica sabendo depois: o backend guarda, por lado do par, se a tela ja foi
 * exibida (`GET /users/me/matches/mutual/unseen` + `PUT .../{matchId}/seen`).
 * O `MatchCelebrationWatcher` consulta essa fila ao abrir o app, ao voltar
 * para ele, em intervalos curtos com ele aberto e quando chega o push
 * NEW_MATCH. A propria tela de sucesso confirma o "visto".
 */
export const MATCH_CELEBRATION_PATHNAME = "/matches/success";

/** Proximo da fila que ainda nao foi aberto nesta sessao do app. */
export function pickNextMatchCelebration(
  queue: readonly MutualMatchSummaryResponse[] | null | undefined,
  presentedMatchIds: ReadonlySet<string>
): MutualMatchSummaryResponse | null {
  return (
    queue?.find(
      (match) =>
        typeof match.matchId === "string" &&
        match.matchId.length > 0 &&
        !presentedMatchIds.has(match.matchId)
    ) ?? null
  );
}

/** Mesmos parametros que o fluxo de descoberta passa para a tela de sucesso. */
export function buildMatchCelebrationHref(match: MutualMatchSummaryResponse): Href {
  const name = match.fullName?.trim();
  const photo = profileService.resolveProfileImageUrl(match.profilePicture?.url);

  return {
    pathname: MATCH_CELEBRATION_PATHNAME,
    params: {
      matchId: match.matchId ?? "",
      ...(name ? { name } : {}),
      ...(photo ? { photo } : {}),
    },
  };
}

type MatchCelebrationCheck = () => Promise<boolean>;

let registeredCheck: MatchCelebrationCheck | null = null;

/** Usado pelo watcher montado em `app/_layout.tsx`. Devolve o "desregistrar". */
export function registerMatchCelebrationCheck(check: MatchCelebrationCheck): () => void {
  registeredCheck = check;

  return () => {
    if (registeredCheck === check) {
      registeredCheck = null;
    }
  };
}

/**
 * Consulta a fila agora (ex.: chegou o push NEW_MATCH). `true` quando uma
 * tela "Deu match" foi aberta ou ja estava aberta; `false` sem watcher
 * montado, sem nada na fila ou com erro de rede.
 */
export function checkPendingMatchCelebrations(): Promise<boolean> {
  return registeredCheck ? registeredCheck().catch(() => false) : Promise.resolve(false);
}
