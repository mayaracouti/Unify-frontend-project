/**
 * Fala do perfil publico (Encontros / perfil de outra pessoa): idade e
 * distancia ocultadas pela privacidade somem da frase, e o audio de
 * apresentacao so e mencionado quando existe.
 */
import { buildPublicProfileSpeech, buildVisibleProfilePartsSpeech } from "../speech-builders";

const ALL_PARTS_HIDDEN = [
  "BIO",
  "GENDER",
  "PRONOUNS",
  "DISABILITIES",
  "ACCESSIBILITY_NEEDS",
  "AUTONOMY_LEVEL",
  "COMMUNICATION_FORMS",
  "LIFESTYLE_TYPES",
  "LOVE_LANGUAGES",
  "ENERGY_LEVEL",
  "INTEREST_TYPES",
  "GALLERY",
  "PRESENTATION_AUDIO",
] as const;

describe("buildPublicProfileSpeech", () => {
  it("fala nome, idade, distancia e bio", () => {
    expect(
      buildPublicProfileSpeech({
        name: "Ana",
        age: 28,
        distanceKm: 4.6,
        bio: "Gosto de trilhas.",
        presentationAudio: null,
      })
    ).toBe("Ana, 28 anos, a 5 quilômetros. Gosto de trilhas.");
  });

  it("omite idade e distancia nulas — nunca fala zero", () => {
    const speech = buildPublicProfileSpeech({
      name: "Ana",
      age: null,
      distanceKm: null,
      bio: "Gosto de trilhas.",
      presentationAudio: null,
    });

    expect(speech).toBe("Ana. Gosto de trilhas.");
    expect(speech).not.toMatch(/0 anos|0 quilômetros/);
  });

  it("avisa sobre o audio de apresentacao quando existe", () => {
    expect(
      buildPublicProfileSpeech({
        name: "Ana",
        age: 28,
        distanceKm: null,
        bio: null,
        presentationAudio: { id: "a1", durationSeconds: 42 },
      })
    ).toBe(
      "Ana, 28 anos. Tem áudio de apresentação de 42 segundos. Use o botão Ouvir apresentação"
    );
  });

  it("sem audio nao menciona apresentacao", () => {
    expect(
      buildPublicProfileSpeech({ name: "Ana", age: 28, bio: null, presentationAudio: null })
    ).not.toMatch(/apresentação/);
  });

  it("ignora bio e audio escondidos e avisa que ha partes privadas", () => {
    const speech = buildPublicProfileSpeech({
      name: "Ana",
      age: 28,
      distanceKm: null,
      // Mesmo que o backend mande algo, parte escondida nunca e falada.
      bio: "Segredo.",
      presentationAudio: { id: "a1", durationSeconds: 42 },
      hiddenFields: ["BIO", "PRESENTATION_AUDIO"],
    });

    expect(speech).toBe("Ana, 28 anos. Algumas informações deste perfil são privadas.");
    expect(speech).not.toMatch(/Segredo|apresentação/);
  });

  it("avisa sobre partes privadas mesmo quando a parte escondida nao e falada", () => {
    expect(
      buildPublicProfileSpeech({
        name: "Ana",
        age: null,
        bio: "Gosto de trilhas.",
        presentationAudio: null,
        hiddenFields: ["GENDER"],
      })
    ).toBe("Ana. Gosto de trilhas. Algumas informações deste perfil são privadas.");
  });

  it("hiddenFields vazio, nulo ou ausente nao muda a fala", () => {
    const base = { name: "Ana", age: 28, bio: "Oi", presentationAudio: null };

    expect(buildPublicProfileSpeech({ ...base, hiddenFields: [] })).toBe("Ana, 28 anos. Oi");
    expect(buildPublicProfileSpeech({ ...base, hiddenFields: null })).toBe("Ana, 28 anos. Oi");
    expect(buildPublicProfileSpeech(base)).toBe("Ana, 28 anos. Oi");
  });

  it("travado sem partes visiveis (visitante comum) diz so o nome e o aviso", () => {
    const speech = buildPublicProfileSpeech({
      name: "Ana",
      age: null,
      distanceKm: null,
      bio: null,
      presentationAudio: null,
      hiddenFields: [...ALL_PARTS_HIDDEN],
      locked: true,
    });

    expect(speech).toBe("Ana. Conta privada. Siga para ver o perfil.");
    expect(speech).not.toMatch(/Algumas informações|apresentação|completo/);
  });

  it("travado com match mutuo: aviso de perfil completo e as partes visiveis", () => {
    const speech = buildPublicProfileSpeech({
      name: "Ana",
      age: 28,
      distanceKm: 4.6,
      // Bio e audio nunca entram, mesmo se vierem preenchidos.
      bio: "Segredo.",
      presentationAudio: { id: "a1", durationSeconds: 42 },
      gender: { id: 1, description: "Mulher" },
      pronouns: null,
      interestTypes: [
        { id: 1, description: "Música" },
        { id: 2, description: "Trilhas" },
      ],
      // Escondida pelo dono na visibilidade granular: nao entra.
      communicationForms: [{ id: 3, description: "Libras" }],
      hiddenFields: ["BIO", "GALLERY", "PRESENTATION_AUDIO", "COMMUNICATION_FORMS"],
      locked: true,
    });

    expect(speech).toBe(
      "Ana. Conta privada. Siga para ver o perfil completo. 28 anos, a 5 quilômetros. Gênero: Mulher. Interesses: Música, Trilhas"
    );
    expect(speech).not.toMatch(/Segredo|apresentação|Libras/);
  });

  it("travado usa as frases prontas de visibleParts quando informadas", () => {
    expect(
      buildPublicProfileSpeech({
        name: "Ana",
        age: null,
        bio: null,
        locked: true,
        visibleParts: ["Pronomes: ela/dela"],
      })
    ).toBe("Ana. Conta privada. Siga para ver o perfil completo. Pronomes: ela/dela");
  });

  it("locked false mantem a fala completa", () => {
    expect(
      buildPublicProfileSpeech({ name: "Ana", age: 28, bio: "Oi", presentationAudio: null, locked: false })
    ).toBe("Ana, 28 anos. Oi");
  });

  it("perfil ausente nao gera fala", () => {
    expect(buildPublicProfileSpeech(null)).toBeNull();
  });
});

describe("buildVisibleProfilePartsSpeech", () => {
  it("lista idade/distancia e as partes nao escondidas, na ordem do perfil", () => {
    expect(
      buildVisibleProfilePartsSpeech({
        age: null,
        distanceKm: 2,
        pronouns: { id: 1, description: "ela/dela" },
        disabilities: [{ id: 2, description: "Visual", ionicIcon: null }],
        energyLevel: { id: 3, description: "Calma" },
        loveLanguages: [],
        hiddenFields: ["BIO"],
      })
    ).toEqual([
      "a 2 quilômetros",
      "Pronomes: ela/dela",
      "Tipo de deficiência: Visual",
      "Ritmo de energia: Calma",
    ]);
  });

  it("tudo escondido ou vazio nao gera partes", () => {
    expect(
      buildVisibleProfilePartsSpeech({
        age: null,
        distanceKm: null,
        gender: { id: 1, description: "Mulher" },
        hiddenFields: [...ALL_PARTS_HIDDEN],
      })
    ).toEqual([]);
    expect(buildVisibleProfilePartsSpeech(null)).toEqual([]);
  });
});
