import type Ionicons from "@expo/vector-icons/Ionicons";

import type { FollowActionResponse, FollowStatsResponse } from "../types/social";
import { accessibilityAnnouncements } from "./accessibilityAnnouncements";

/**
 * Relacao de "seguir" entre mim e outro perfil, com seguir com aprovacao:
 * - `NONE`: nao sigo e nao pedi;
 * - `REQUESTED`: pedido pendente (o alvo aprova seguidores e ainda nao aceitou);
 * - `FOLLOWING`: sigo.
 */
export type FollowRelation = "NONE" | "REQUESTED" | "FOLLOWING";

export type FollowFlags = {
  following: boolean;
  followRequested?: boolean | null;
};

/** `following` sempre vence: um pedido pendente nunca convive com seguir. */
export function resolveFollowRelation(flags: FollowFlags): FollowRelation {
  if (flags.following) {
    return "FOLLOWING";
  }

  return flags.followRequested ? "REQUESTED" : "NONE";
}

/** Estado de seguir de UM perfil aberto (perfil publico, Encontros, chat). */
export type FollowState = {
  following: boolean;
  followRequested: boolean;
  /** O alvo so ganha seguidores depois de aceitar (muda o rotulo para "Pedir para seguir"). */
  followApprovalRequired: boolean;
  followersCount: number;
  followingCount: number;
};

export function followStateFromStats(stats: FollowStatsResponse): FollowState {
  const following = Boolean(stats.followedByCurrentUser);

  return {
    following,
    followRequested: !following && stats.followRequestedByCurrentUser === true,
    followApprovalRequired: stats.followApprovalRequired === true,
    followersCount: stats.followersCount,
    followingCount: stats.followingCount,
  };
}

/**
 * Estado otimista enquanto a requisicao anda. Seguir alguem que aprova
 * seguidores vira "Solicitado" (o contador nao muda); a resposta do backend
 * corrige depois (`applyFollowResponse`).
 */
export function predictFollowState(state: FollowState): FollowState {
  const relation = resolveFollowRelation(state);

  if (relation === "FOLLOWING") {
    return {
      ...state,
      following: false,
      followRequested: false,
      followersCount: Math.max(0, state.followersCount - 1),
    };
  }

  if (relation === "REQUESTED") {
    return { ...state, following: false, followRequested: false };
  }

  return state.followApprovalRequired
    ? { ...state, following: false, followRequested: true }
    : { ...state, following: true, followRequested: false, followersCount: state.followersCount + 1 };
}

/** O resultado do `POST`/`DELETE` decide o estado (nunca assumir `following=true`). */
export function applyFollowResponse(
  state: FollowState,
  response: Pick<FollowActionResponse, "following" | "followRequested" | "followersCount">
): FollowState {
  const following = Boolean(response.following);

  return {
    ...state,
    following,
    followRequested: !following && response.followRequested === true,
    followersCount:
      typeof response.followersCount === "number" ? response.followersCount : state.followersCount,
  };
}

export type FollowButtonIcon = keyof typeof Ionicons.glyphMap;

export type FollowButtonDescription = {
  relation: FollowRelation;
  /** Texto visivel do botao. */
  text: string;
  accessibilityLabel: string;
  accessibilityHint: string;
  /** Acao falada pelo TTS no toque (`buildActionSpeech(speechAction, name)`). */
  speechAction: string;
  icon: FollowButtonIcon;
  /** Estado "ativo" do botao (seguindo ou solicitado). */
  selected: boolean;
};

/**
 * Rotulos do botao de seguir nos tres estados. Tocar em "Solicitado" cancela o
 * pedido (a tela confirma antes); tocar em "Seguindo" deixa de seguir.
 */
export function describeFollowButton(
  input: FollowFlags & { followApprovalRequired?: boolean | null },
  name: string
): FollowButtonDescription {
  const relation = resolveFollowRelation(input);
  const target = name.trim() || "esta pessoa";

  if (relation === "FOLLOWING") {
    return {
      relation,
      text: "Seguindo",
      accessibilityLabel: `Seguindo ${target}. Deixar de seguir`,
      accessibilityHint: "As publicações desta pessoa saem do seu feed",
      speechAction: "Deixar de seguir",
      icon: "checkmark",
      selected: true,
    };
  }

  if (relation === "REQUESTED") {
    return {
      relation,
      text: "Solicitado",
      accessibilityLabel: `Solicitado. Pedido para seguir ${target} pendente`,
      accessibilityHint: "Toque para cancelar o pedido. Pede confirmação antes",
      speechAction: "Cancelar pedido para seguir",
      icon: "time-outline",
      selected: true,
    };
  }

  if (input.followApprovalRequired) {
    return {
      relation,
      text: "Pedir para seguir",
      accessibilityLabel: `Pedir para seguir ${target}`,
      accessibilityHint:
        "Envia um pedido. Você passa a seguir quando a pessoa aceitar",
      speechAction: "Pedir para seguir",
      icon: "person-add-outline",
      selected: false,
    };
  }

  return {
    relation,
    text: "Seguir",
    accessibilityLabel: `Seguir ${target}`,
    accessibilityHint: "As publicações desta pessoa passam a aparecer no seu feed",
    speechAction: "Seguir",
    icon: "person-add-outline",
    selected: false,
  };
}

/**
 * Anuncio de sucesso depois do `POST`/`DELETE`: segue ("Agora você segue X"),
 * pedido enviado, pedido cancelado ou deixou de seguir.
 */
export function followOutcomeAnnouncement(
  previous: FollowRelation,
  response: Pick<FollowActionResponse, "following" | "followRequested">,
  name: string
): string {
  if (response.following) {
    return accessibilityAnnouncements.followStarted(name);
  }

  if (response.followRequested) {
    return accessibilityAnnouncements.followRequestSent(name);
  }

  return previous === "REQUESTED"
    ? accessibilityAnnouncements.followRequestCanceled()
    : accessibilityAnnouncements.followStopped(name);
}
