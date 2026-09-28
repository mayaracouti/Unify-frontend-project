import { PROFILE_FIELD_OPTIONS, PROFILE_FIELD_VISIBILITY_OPTIONS } from "../../types/privacy";
import {
  buildProfileFieldRowLabel,
  buildUniformProfileFieldVisibility,
  getHiddenFields,
  isProfileFieldHidden,
  normalizePrivacySettings,
  normalizeProfileFieldVisibility,
  profileFieldLabel,
  profileFieldVisibilityDescription,
  profileFieldVisibilityLabel,
} from "../profileFieldVisibility";

describe("constantes de visibilidade do perfil", () => {
  it("lista as 13 partes, sem repetir, na ordem da tela", () => {
    const fields = PROFILE_FIELD_OPTIONS.map((option) => option.field);

    expect(fields).toHaveLength(13);
    expect(new Set(fields).size).toBe(13);
    expect(fields[0]).toBe("BIO");
    expect(fields[12]).toBe("PRESENTATION_AUDIO");
  });

  it("tem os 4 modos com descricao", () => {
    expect(PROFILE_FIELD_VISIBILITY_OPTIONS.map((option) => option.label)).toEqual([
      "Todos",
      "Só quem me segue",
      "Só quem eu sigo",
      "Ninguém",
    ]);
    PROFILE_FIELD_VISIBILITY_OPTIONS.forEach((option) =>
      expect(option.description.trim().length).toBeGreaterThan(0)
    );
  });
});

describe("rotulos", () => {
  it("traduz parte e modo", () => {
    expect(profileFieldLabel("DISABILITIES")).toBe("Tipo de deficiência");
    expect(profileFieldLabel("GALLERY")).toBe("Fotos da galeria");
    expect(profileFieldVisibilityLabel("PUBLIC")).toBe("Todos");
    expect(profileFieldVisibilityLabel("FOLLOWERS_ONLY")).toBe("Só quem me segue");
    expect(profileFieldVisibilityLabel("FOLLOWING_ONLY")).toBe("Só quem eu sigo");
    expect(profileFieldVisibilityLabel("HIDDEN")).toBe("Ninguém");
  });

  it("modo ausente cai no padrao Todos", () => {
    expect(profileFieldVisibilityLabel(undefined)).toBe("Todos");
    expect(profileFieldVisibilityLabel(null)).toBe("Todos");
    expect(profileFieldVisibilityDescription(null)).toBe(
      PROFILE_FIELD_VISIBILITY_OPTIONS[0].description
    );
  });

  it("monta o label acessivel da linha", () => {
    expect(buildProfileFieldRowLabel("GENDER", "HIDDEN")).toBe(
      "Gênero: Ninguém. Toque para alterar"
    );
  });
});

describe("normalizacao do mapa", () => {
  it("preenche partes faltantes ou invalidas com PUBLIC", () => {
    const map = normalizeProfileFieldVisibility({
      GENDER: "HIDDEN",
      BIO: "QUALQUER" as never,
    });

    expect(Object.keys(map)).toHaveLength(13);
    expect(map.GENDER).toBe("HIDDEN");
    expect(map.BIO).toBe("PUBLIC");
    expect(map.GALLERY).toBe("PUBLIC");
    expect(normalizeProfileFieldVisibility(null).PRESENTATION_AUDIO).toBe("PUBLIC");
  });

  it("completa a resposta de privacidade de backend antigo", () => {
    const settings = normalizePrivacySettings({
      discoverable: true,
      feedVisibility: "PUBLIC",
      showDistance: true,
      showAge: false,
    } as never);

    expect(settings.showAge).toBe(false);
    expect(settings.profileFieldVisibility.INTEREST_TYPES).toBe("PUBLIC");
    expect(settings.followApprovalRequired).toBe(false);
  });

  it("aplica o mesmo modo a todas as partes", () => {
    const map = buildUniformProfileFieldVisibility("FOLLOWERS_ONLY");

    expect(Object.keys(map)).toHaveLength(13);
    expect(new Set(Object.values(map))).toEqual(new Set(["FOLLOWERS_ONLY"]));
  });
});

describe("hiddenFields", () => {
  it("trata ausente, nulo e lixo sem quebrar", () => {
    expect(getHiddenFields(null)).toEqual([]);
    expect(getHiddenFields({})).toEqual([]);
    expect(getHiddenFields({ hiddenFields: null })).toEqual([]);
    expect(
      getHiddenFields({ hiddenFields: ["BIO", "BIO", "NOVO" as never, "GALLERY"] })
    ).toEqual(["BIO", "GALLERY"]);
  });

  it("indica se uma parte esta escondida", () => {
    const profile = { hiddenFields: ["PRESENTATION_AUDIO" as const] };

    expect(isProfileFieldHidden(profile, "PRESENTATION_AUDIO")).toBe(true);
    expect(isProfileFieldHidden(profile, "BIO")).toBe(false);
    expect(isProfileFieldHidden(undefined, "BIO")).toBe(false);
  });
});
