import { postImageLabel, postSpeechParts, resolvePostImageDescription } from "../post-content";
import { buildCommunityPostSpeech } from "../../accessibility/tts/speech-builders";
it("reads all text and a separate description without the 200-character cut", () => {
  const body = Array.from({ length: 120 }, () => "conteúdo").join(" ");
  const parts = postSpeechParts({ body, imageDescription: "Uma árvore", hasImage: true, origin: "COMMUNITY" });
  expect(parts.slice(0, -2).join(" ")).toBe(body);
  expect(parts.slice(-2)).toEqual(["Descrição da imagem.", "Uma árvore"]);
  expect(parts.every((part) => part.length <= 350)).toBe(true);
  expect(buildCommunityPostSpeech({ id: "p", author: { name: "Ana" }, body, mediaData: "/image", imageDescription: "Uma árvore" })).toContain("Uma árvore");
});
it("never parses a community description out of its body", () => {
  expect(resolvePostImageDescription({ body: "Texto\n\nDescrição da imagem: exemplo", hasImage: true, origin: "COMMUNITY" })).toBeNull();
});
it("preserves the personal legacy format and handles missing images", () => {
  expect(resolvePostImageDescription({ body: "Texto\n\nDescrição da imagem: árvore", hasImage: true, origin: "PERSONAL" })).toBe("árvore");
  expect(resolvePostImageDescription({ body: "Texto", imageDescription: "árvore", hasImage: false })).toBeNull();
  expect(postSpeechParts({ body: "Texto", hasImage: true, imageDescription: null })).toEqual(["Texto"]);
  expect(postImageLabel(null, "Ana")).toBe("Imagem da publicação de Ana, sem descrição");
});
