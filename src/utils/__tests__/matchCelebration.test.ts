/**
 * Fila da tela "Deu match" para quem curtiu primeiro.
 */
import type { MutualMatchSummaryResponse } from "../../types/match";
import {
  buildMatchCelebrationHref,
  checkPendingMatchCelebrations,
  pickNextMatchCelebration,
  registerMatchCelebrationCheck,
} from "../matchCelebration";

jest.mock("../../services/profileService", () => ({
  profileService: {
    resolveProfileImageUrl: (url?: string | null) => (url ? `https://api.test${url}` : null),
  },
}));

function match(overrides: Partial<MutualMatchSummaryResponse> = {}): MutualMatchSummaryResponse {
  return {
    matchId: "m1",
    userId: "u1",
    userProfileId: "p1",
    fullName: "Bruno Lima",
    age: 31,
    profilePicture: null,
    ...overrides,
  };
}

describe("pickNextMatchCelebration", () => {
  it("devolve o primeiro da fila (o backend ordena do mais antigo)", () => {
    expect(pickNextMatchCelebration([match(), match({ matchId: "m2" })], new Set())?.matchId).toBe("m1");
  });

  it("pula o que já foi aberto nesta sessão, mesmo que o visto não tenha chegado", () => {
    expect(
      pickNextMatchCelebration([match(), match({ matchId: "m2" })], new Set(["m1"]))?.matchId
    ).toBe("m2");
    expect(pickNextMatchCelebration([match()], new Set(["m1"]))).toBeNull();
  });

  it("ignora item sem matchId e fila vazia ou ausente", () => {
    expect(pickNextMatchCelebration([match({ matchId: null })], new Set())).toBeNull();
    expect(pickNextMatchCelebration([], new Set())).toBeNull();
    expect(pickNextMatchCelebration(null, new Set())).toBeNull();
  });
});

describe("buildMatchCelebrationHref", () => {
  it("passa matchId, nome e foto resolvida, como o fluxo de descoberta", () => {
    expect(
      buildMatchCelebrationHref(
        match({
          fullName: "  Bruno Lima ",
          profilePicture: { id: "i1", profilePicture: true, active: true, url: "/users/me/matches/images/i1" },
        })
      )
    ).toEqual({
      pathname: "/matches/success",
      params: {
        matchId: "m1",
        name: "Bruno Lima",
        photo: "https://api.test/users/me/matches/images/i1",
      },
    });
  });

  it("sem nome e sem foto a tela usa os textos padrão", () => {
    expect(buildMatchCelebrationHref(match({ fullName: " " }))).toEqual({
      pathname: "/matches/success",
      params: { matchId: "m1" },
    });
  });
});

describe("checkPendingMatchCelebrations", () => {
  it("sem watcher montado não abre nada", async () => {
    await expect(checkPendingMatchCelebrations()).resolves.toBe(false);
  });

  it("delega ao watcher registrado e para de delegar ao desregistrar", async () => {
    const check = jest.fn().mockResolvedValue(true);
    const unregister = registerMatchCelebrationCheck(check);

    await expect(checkPendingMatchCelebrations()).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(1);

    unregister();
    await expect(checkPendingMatchCelebrations()).resolves.toBe(false);
  });

  it("erro na consulta vira false (quem chama mostra o banner)", async () => {
    const unregister = registerMatchCelebrationCheck(() => Promise.reject(new Error("rede")));

    await expect(checkPendingMatchCelebrations()).resolves.toBe(false);
    unregister();
  });

  it("desregistrar um watcher antigo não derruba o atual", async () => {
    const unregisterOld = registerMatchCelebrationCheck(() => Promise.resolve(false));
    const unregisterCurrent = registerMatchCelebrationCheck(() => Promise.resolve(true));

    unregisterOld();
    await expect(checkPendingMatchCelebrations()).resolves.toBe(true);
    unregisterCurrent();
  });
});
