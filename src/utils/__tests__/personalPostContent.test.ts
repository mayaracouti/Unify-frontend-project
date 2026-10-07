import { buildPersonalPostBody, getPersonalPostImageDescription, splitPersonalPostBody, splitPostSpeech } from "../personalPostContent";

describe("publicações com descrição de imagem", () => {
  it("persiste a descrição no texto sem depender de campos novos da API", () => {
    const body = buildPersonalPostBody(" No parque ", " Duas pessoas conversando. ", true);
    expect(body).toBe("No parque\n\nDescrição da imagem: Duas pessoas conversando.");
    expect(getPersonalPostImageDescription(body)).toBe("Duas pessoas conversando.");
  });

  it("não publica descrição de uma imagem removida", () => {
    expect(buildPersonalPostBody("Olá", "Uma foto", false)).toBe("Olá");
    expect(getPersonalPostImageDescription("Olá")).toBeNull();
  });

  it("edita e remove a descrição sem duplicar o marcador ou alterar o texto", () => {
    const original = buildPersonalPostBody("No parque", "Uma árvore", true);
    const content = splitPersonalPostBody(original);
    expect(content).toEqual({ body: "No parque", imageDescription: "Uma árvore" });
    expect(buildPersonalPostBody(content.body, "Duas árvores", true)).toBe("No parque\n\nDescrição da imagem: Duas árvores");
    expect(buildPersonalPostBody(content.body, "", true)).toBe("No parque");
    expect(splitPersonalPostBody("Texto sem descrição")).toEqual({ body: "Texto sem descrição", imageDescription: "" });
  });

  it("divide texto longo sem perder o final ou a descrição", () => {
    const body = buildPersonalPostBody("palavra ".repeat(60), "Uma praça arborizada.", true);
    const parts = splitPostSpeech(body);
    expect(parts.every((part) => part.length <= 350)).toBe(true);
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(body.replace(/\s+/g, " "));
    expect(parts.at(-1)).toContain("Uma praça arborizada.");
  });
});
